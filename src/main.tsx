import { startOfDay } from "date-fns"
import LogoImg from "../icon.png"
import { setupL10N, t } from "./libs/l10n"
import { ensureInbox, groupBy } from "./libs/utils"
import type { Block, DbId, QueryDescription } from "./orca"
import {
  fragmentsToText,
  parseBlocks,
  parseInline,
  stripBlockPrefix,
} from "./parseBlocks"
import zhCN from "./translations/zhCN"

let pluginName: string

/**
 * 同步进行中标志（⑬）：防止连点导致两次同步并发写块 → 重复块。
 * 并发时查重表是启动快照，第二次看不到第一次的写入。
 */
let syncing = false

/** 连续失败轮次（②）：避免"有失败就不推进水位"演变成静默死锁 */
const FAIL_ROUNDS_KEY = "failRounds"

/** 本轮首条失败原因：直接带进结束提示，避免"只报失败数、查不到原因" */
let lastSyncError = ""

interface MemosMemo {
  name: string
  content: string
  createTime: string
  updateTime: string
  creator: string
  visibility: number
  tags: string[]
}

/** Memos v0.31.0 list 接口响应（grpc-gateway，camelCase） */
interface MemosListResponse {
  memos?: MemosMemo[]
  nextPageToken?: string
}

/** 增量查重表条目：只记根块 ID（① 更新方式＝核对后重建，再删旧根块） */
interface ExistingEntry {
  rootId: DbId
}

export async function load(_name: string) {
  pluginName = _name

  setupL10N(orca.state.locale, { "zh-CN": zhCN })

  const Button = orca.components.Button
  const HoverContextMenu = orca.components.HoverContextMenu
  const MenuText = orca.components.MenuText

  await orca.plugins.setSettingsSchema(pluginName, {
    memosApiUrl: {
      label: t("Memos API URL"),
      description: t("The base URL of your memos instance."),
      type: "string",
      defaultValue: "",
    },
    memosApiToken: {
      label: t("Memos API Token"),
      description: t("Your memos API token for authentication."),
      type: "string",
      defaultValue: "",
    },
    inboxName: {
      label: t("Inbox name"),
      description: t(
        "The text used for the block where imported notes are placed under.",
      ),
      type: "string",
      defaultValue: "Memos Inbox",
    },
    noteTag: {
      label: t("Note tag"),
      description: t("The tag applied to the imported notes."),
      type: "string",
      defaultValue: "Memos Note",
    },
    startDate: {
      label: t("Start date"),
      description: t(
        "Notes before this date won't be synced, even in full sync mode.",
      ),
      type: "date",
      defaultValue: null,
    },
    visibilityFilter: {
      label: t("Visibility filter"),
      description: t(
        "Select which visibility levels to sync. Unchecked items will be excluded.",
      ),
      type: "multiChoices",
      defaultValue: ["PRIVATE", "PROTECTED", "PUBLIC"],
      choices: [
        { label: t("PRIVATE"), value: "PRIVATE" },
        { label: t("PROTECTED"), value: "PROTECTED" },
        { label: t("PUBLIC"), value: "PUBLIC" },
      ],
    },
  })

  orca.themes.injectCSS(
    `.memos-button { width: 20px; height: 20px; object-fit: contain; }`,
    pluginName,
  )

  if (orca.state.commands["memos.sync"] == null) {
    orca.commands.registerCommand(
      "memos.sync",
      async (fullSync: boolean = false) => {
        await syncMemos(fullSync)
      },
      t("Sync Memos notes"),
    )
  }

  if (orca.state.commands["memos.cleanup"] == null) {
    orca.commands.registerCommand(
      "memos.cleanup",
      async () => {
        await checkDeletedMemos()
      },
      t("检查已删除的 Memo（干跑）"),
    )
  }

  if (orca.state.headbarButtons["memos.sync"] == null) {
    orca.headbar.registerHeadbarButton("memos.sync", () => (
      <HoverContextMenu
        menu={(closeMenu: () => void) => (
          <>
            <MenuText
              title={t("Incremental sync")}
              onClick={async () => {
                closeMenu()
                await orca.commands.invokeCommand("memos.sync")
              }}
            />
            <MenuText
              title={t("Full sync")}
              onClick={async () => {
                closeMenu()
                await orca.commands.invokeCommand("memos.sync", true)
              }}
            />
            <MenuText
              title={t("检查已删除的 Memo（干跑）")}
              onClick={async () => {
                closeMenu()
                await orca.commands.invokeCommand("memos.cleanup")
              }}
            />
          </>
        )}
      >
        <Button
          variant="plain"
          onClick={() => orca.commands.invokeCommand("memos.sync")}
        >
          <img className="memos-button" src={LogoImg} alt="Sync" />
        </Button>
      </HoverContextMenu>
    ))
  }

  console.log(`${pluginName} loaded.`)
}

export async function unload() {
  orca.headbar.unregisterHeadbarButton("memos.sync")
  orca.commands.unregisterCommand("memos.sync")
  orca.commands.unregisterCommand("memos.cleanup")
  orca.themes.removeCSS(pluginName)

  console.log(`${pluginName} unloaded.`)
}

/**
 * 同步入口（⑬ 并发闸门）：所有异常在此统一上报，避免"静默失败"。
 */

async function syncMemos(fullSync: boolean) {
  if (syncing) {
    orca.notify("warn", t("同步正在进行中，请稍候"))
    return
  }
  syncing = true
  try {
    await syncMemosInner(fullSync)
  } catch (err) {
    console.error("MEMOS SYNC:", err)
    orca.notify(
      "error",
      `${t("Failed to sync Memos notes.")} ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    syncing = false
  }
}

async function syncMemosInner(fullSync: boolean) {
  const settings = orca.state.plugins[pluginName]?.settings
  if (!settings) {
    orca.notify("error", t("Plugin settings not found."))
    return
  }
  const memosApiUrl: string = settings.memosApiUrl
  const memosApiToken: string = settings.memosApiToken
  const inboxName: string = settings.inboxName || "Memos Inbox"
  const noteTag: string = settings.noteTag || "Memos Note"
  const startDateValue: string | null = settings.startDate
  const visibilityFilter: string[] = settings.visibilityFilter ?? [
    "PRIVATE",
    "PROTECTED",
    "PUBLIC",
  ]

  if (!memosApiUrl || !memosApiToken) {
    orca.notify("warn", t("Please configure memos API URL and token first."))
    return
  }

  // ⑫ 可见性全不选 ≠ 不过滤：空数组时若直接往下走，会因"条件不成立"而同步全部可见性
  //    （与设置项文案「未勾选的将被排除」相反，属隐私/范围失控）。
  if (visibilityFilter.length === 0) {
    orca.notify("warn", t("未选择任何可见性，已取消同步"))
    return
  }

  lastSyncError = ""
  orca.notify("info", t("Starting to sync, please wait..."))

  let lastSyncTime: number | null = null
  if (!fullSync) {
    const saved = await orca.plugins.getData(pluginName, "lastSyncTime")
    if (saved) lastSyncTime = saved
  }

  const memos = await fetchMemos(
    memosApiUrl,
    memosApiToken,
    lastSyncTime,
    startDateValue,
    visibilityFilter,
  )

  if (!memos?.length) {
    orca.notify("info", t("Nothing to sync."))
    return
  }

  const memosByDate = groupBy<number, MemosMemo>(
    (memo) => startOfDay(new Date(memo.createTime)).getTime(),
    memos,
  )

  const totalMemos = memos.length
  let syncedCount = 0
  let failedCount = 0
  /** 本轮成功项里最大的 updateTime（毫秒），作为水位（②：不用本地时钟，避免漂移） */
  let maxOkUpdatedMs = 0

  const allExistingIds = await queryMemosNoteBlockIds(noteTag)

  let existingBlocks: Map<string, ExistingEntry>

  if (fullSync) {
    // ⑰ 只删插件产物（同时具备 ID 属性的根块），避免误删用户手工打的同名标签块
    const { ids: pluginRootIds, skipped } = await filterPluginRoots(allExistingIds)
    if (pluginRootIds.length) {
      orca.notify(
        "info",
        `清理旧数据：将删除 ${pluginRootIds.length} 块（已跳过 ${skipped} 块非插件块）`,
      )
      let deleteFailed = false
      for (let i = 0; i < pluginRootIds.length; i += 100) {
        try {
          await orca.commands.invokeEditorCommand(
            "core.editor.deleteBlocks",
            null,
            pluginRootIds.slice(i, i + 100),
          )
        } catch (e) {
          console.error("MEMOS SYNC: 删除旧块失败", e)
          deleteFailed = true
          break // ③ 失败即中断，避免"半删 + 新建"产生重复块
        }
      }
      if (deleteFailed) {
        throw new Error(
          `全量同步：删除旧块失败，已中断以避免产生重复块（已处理 ${pluginRootIds.length} 块中的一部分），请重试`,
        )
      }
    }
    existingBlocks = new Map()
  } else {
    existingBlocks = await buildExistingMap(allExistingIds)
  }

  for (const [date, memosInDate] of memosByDate.entries()) {
    const journal: Block = await orca.invokeBackend(
      "get-journal-block",
      new Date(date),
    )
    if (journal == null) continue
    const inbox = await ensureInbox(journal, inboxName)

    for (const memo of memosInDate) {
      const ok = await syncMemo(
        memo,
        inbox,
        noteTag,
        memosApiUrl,
        existingBlocks,
      )
      if (ok) {
        syncedCount++
        const ms = Date.parse(memo.updateTime || memo.createTime)
        if (!Number.isNaN(ms)) maxOkUpdatedMs = Math.max(maxOkUpdatedMs, ms)
      } else {
        failedCount++
      }
      const done = syncedCount + failedCount
      if (done % 20 === 0 || done === totalMemos) {
        orca.notify("info", `Syncing... ${done}/${totalMemos}`)
      }
    }
  }

  // ② 水位与失败处理：有失败则不推进（避免跳过失败项使其永不重试）
  if (failedCount === 0) {
    await orca.plugins.setData(
      pluginName,
      "lastSyncTime",
      maxOkUpdatedMs || Date.now(),
    )
    await orca.plugins.setData(pluginName, FAIL_ROUNDS_KEY, 0)
  } else {
    // ⚠️ 注意：getData 首次返回 undefined，Number(undefined) = NaN，`?? 0` 不会兜住 NaN，
    //    必须用 `|| 0`，否则 rounds 恒为 NaN，连续失败告警永不触发。
    const prevRounds =
      Number((await orca.plugins.getData(pluginName, FAIL_ROUNDS_KEY)) ?? 0) || 0
    const rounds = prevRounds + 1
    await orca.plugins.setData(pluginName, FAIL_ROUNDS_KEY, rounds)
    if (rounds >= 3) {
      // 连续失败不静默：明确告警，避免"水位永远不推进"变成无人发现的死锁
      orca.notify(
        "error",
        `已连续 ${rounds} 轮同步存在失败（本轮 ${failedCount} 条），同步水位未推进。请检查网络/服务可达性，或单条 memo 的数据格式。`,
      )
    }
  }

  if (failedCount === 0) {
    orca.notify("success", t("Memos notes synced successfully."))
  } else {
    const reason = lastSyncError
      ? `｜首条错误：${lastSyncError.slice(0, 160)}`
      : ""
    orca.notify(
      "warn",
      `同步完成：成功 ${syncedCount} 条，失败 ${failedCount} 条（水位未推进，下次会重试）${reason}`,
    )
  }
}

/**
 * ③ 查询插件的 Memos Note 块 ID。
 * 注意：`invokeBackend("query")` 返回 `DbId[]`，**没有 pageToken**（那是 Memos HTTP 的机制）。
 * 因此不照搬 HTTP 翻页：先用大 pageSize 一次取；只有命中上限才探测后端是否支持 `page`，
 * 并用"返回同一页"来检测 page 参数被忽略，避免死循环。
 */
async function queryMemosNoteBlockIds(noteTag: string): Promise<DbId[]> {
  const CAP = 100000
  const baseQuery = {
    q: { kind: 1, conditions: [{ kind: 4, name: noteTag }] },
    pageSize: CAP,
  } as QueryDescription

  const ids = ((await orca.invokeBackend("query", baseQuery)) ?? []) as DbId[]
  if (ids.length < CAP) return ids

  orca.notify(
    "warn",
    `查询命中上限 ${CAP}，可能被截断，正在尝试分页取全…`,
  )
  const out: DbId[] = []
  const seen = new Set<DbId>()
  for (let page = 1; page <= 500; page++) {
    const chunk = ((await orca.invokeBackend("query", {
      ...(baseQuery as object),
      pageSize: 1000,
      page,
    } as QueryDescription)) ?? []) as DbId[]
    if (!chunk.length) break
    const before = out.length
    for (const id of chunk) {
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
    if (out.length === before) break // page 被忽略（返回同一页）→ 停止，避免死循环
    if (chunk.length < 1000) break
  }
  if (out.length <= ids.length) {
    orca.notify("warn", "分页未生效，查询结果仍可能被截断，请留意是否有孤儿块。")
    return ids
  }
  return out
}

/** ⑰ 过滤出插件产物（带 ID 属性的根块）；其余计入 skipped 并告知用户 */
async function filterPluginRoots(
  allIds: DbId[],
): Promise<{ ids: DbId[]; skipped: number }> {
  if (!allIds?.length) return { ids: [], skipped: 0 }
  const blocks = ((await orca.invokeBackend("get-blocks", allIds)) ??
    []) as Block[]
  const ids: DbId[] = []
  let skipped = 0
  for (const b of blocks) {
    if (!b) continue
    if (b.properties?.some((p) => p.name === "ID")) ids.push(b.id)
    else skipped++
  }
  return { ids, skipped }
}

/**
 * ⑥ 构建增量查重表：只认 `ID` 属性，不再用 `b.text` 兜底（文本兜底会误判）。
 * 无 ID 属性的块（手工创建/旧版导入）跳过并留痕，不混入查重。
 * ① 只记根块 ID：更新时按「新建整棵子树 + 删旧根块」重建，不再依赖 children 定位标题块。
 */
async function buildExistingMap(
  allIds: DbId[],
): Promise<Map<string, ExistingEntry>> {
  const map = new Map<string, ExistingEntry>()
  if (!allIds?.length) return map
  const blocks = ((await orca.invokeBackend("get-blocks", allIds)) ??
    []) as Block[]
  for (const b of blocks) {
    if (!b) continue
    const idProp = b.properties?.find((p) => p.name === "ID")
    if (!idProp?.value) {
      console.warn("MEMOS SYNC: 跳过无 ID 属性的块", b.id)
      continue
    }
    const memoId = String(idProp.value).trim()
    if (!memoId || map.has(memoId)) continue
    map.set(memoId, { rootId: b.id })
  }
  return map
}

/**
 * ⑭ 检查「Memos 已删除、但 Orca 仍保留」的 memo —— **干跑：只报告，不删除**。
 *
 * ⚠️ 不能用增量拉取的集合做差集：增量只拉 `updated_ts >= 水位` 的条目，
 *    集合本身不完整，会把大量正常块误判成"已删除"。这里**全量拉** memo id（不带任何 filter），
 *    并且只与「带 ID 属性的插件根块」比对。
 * 删除动作留给人来确认（或走全量同步），不在本函数内自动执行。
 */
async function checkDeletedMemos() {
  if (syncing) {
    orca.notify("warn", t("同步正在进行中，请稍候"))
    return
  }
  syncing = true
  try {
    const settings = orca.state.plugins[pluginName]?.settings
    if (!settings) {
      orca.notify("error", t("Plugin settings not found."))
      return
    }
    const memosApiUrl: string = settings.memosApiUrl
    const memosApiToken: string = settings.memosApiToken
    const noteTag: string = settings.noteTag || "Memos Note"
    if (!memosApiUrl || !memosApiToken) {
      orca.notify("warn", t("Please configure memos API URL and token first."))
      return
    }

    orca.notify("info", "正在拉取 Memos 全量 id（用于对比）…")
    const remoteIds = await fetchAllMemoIds(memosApiUrl, memosApiToken)

    const allExistingIds = await queryMemosNoteBlockIds(noteTag)
    const blocks = ((await orca.invokeBackend("get-blocks", allExistingIds)) ??
      []) as Block[]

    const orphans: Array<{ blockId: DbId; memoId: string }> = []
    for (const b of blocks) {
      if (!b) continue
      const idProp = b.properties?.find((p) => p.name === "ID")
      if (!idProp?.value) continue
      const memoId = String(idProp.value).trim()
      if (memoId && !remoteIds.has(memoId)) {
        orphans.push({ blockId: b.id, memoId })
      }
    }

    console.log("MEMOS SYNC: 疑似已删除清单", orphans)

    if (!orphans.length) {
      orca.notify(
        "success",
        `检查完成：Memos ${remoteIds.size} 条 / Orca ${blocks.length} 块，未发现已删除的残留。`,
      )
      return
    }
    const preview = orphans
      .slice(0, 5)
      .map((o) => `${o.memoId}(块${o.blockId})`)
      .join("、")
    orca.notify(
      "warn",
      `发现 ${orphans.length} 条 Memos 已删除但 Orca 仍保留：${preview}${orphans.length > 5 ? " …" : ""}（仅检测，未删除；完整清单见控制台）`,
    )
  } catch (err) {
    console.error("MEMOS CLEANUP:", err)
    orca.notify(
      "error",
      `检查失败：${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    syncing = false
  }
}

/** 全量拉取 Memos 的 memo id（不带 filter，避免把"未同步/被可见性过滤"误判成"已删除"） */
async function fetchAllMemoIds(
  apiUrl: string,
  token: string,
): Promise<Set<string>> {
  const baseUrl = apiUrl.replace(/\/$/, "")
  const url = new URL(`${baseUrl}/api/v1/memos`)
  url.searchParams.set("pageSize", "100")
  const ids = new Set<string>()
  let pageToken: string | undefined
  let pages = 0
  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken)
    } else {
      url.searchParams.delete("page_token")
    }
    const data = await xhrRequest(url.toString(), token)
    for (const m of data.memos ?? []) {
      const id = /^memos\/(.+)$/.exec(m.name ?? "")?.[1]?.trim()
      if (id) ids.add(id)
    }
    pageToken = data.nextPageToken
    pages++
    if (pages % 10 === 0) orca.notify("info", `已拉取 ${ids.size} 条…`)
  } while (pageToken)
  return ids
}

async function fetchMemos(
  apiUrl: string,
  token: string,
  lastSyncTime: number | null,
  startDate: string | null,
  visibilityFilter: string[],
): Promise<MemosMemo[]> {
  const baseUrl = apiUrl.replace(/\/$/, "")
  const url = new URL(`${baseUrl}/api/v1/memos`)
  // v0.31.0 的 grpc-gateway 按 json_name（camelCase）匹配 query key，
  // 实测 page_size / order_by 在本实例也能工作，但 camelCase 是规范写法、对其他实例更稳。
  url.searchParams.set("pageSize", "100")
  url.searchParams.set("orderBy", "create_time desc")

  // Build server-side filter (CEL syntax — Memos uses Unix second timestamps for dates)
  // created_ts and updated_ts map to the DB's Unix timestamp columns.
  // ⚠️ 关键修复（实测验证）：CEL 中 created_ts 是 timestamp 类型，裸整数比较
  //   `created_ts >= 1700000000` 会报
  //   "found no matching overload for '_>=_' applied to '(timestamp, int)'" → HTTP 400，
  //   导致每次 fetchMemos 都失败、整轮同步报错。必须用 timestamp() 包裹：
  //   `created_ts >= timestamp(1700000000)`（参数仍为 Unix 秒）。
  // The returned memo.createTime is still an ISO 8601 string — no conflict.
  const filters: string[] = []
  if (startDate) {
    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    filters.push(`created_ts >= timestamp(${startTs})`)
  }
  if (lastSyncTime) {
    const lastSyncTs = Math.floor(lastSyncTime / 1000)
    filters.push(`updated_ts >= timestamp(${lastSyncTs})`)
  }
  if (visibilityFilter.length > 0 && visibilityFilter.length < 3) {
    const visList = visibilityFilter.map((v) => `"${v}"`).join(", ")
    filters.push(`visibility in [${visList}]`)
  }
  if (filters.length > 0) {
    url.searchParams.set("filter", filters.join(" && "))
  }

  const allMemos: MemosMemo[] = []
  let pageToken: string | undefined

  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken)
    } else {
      url.searchParams.delete("page_token")
    }

    const data = await xhrRequest(url.toString(), token)
    if (data.memos && Array.isArray(data.memos)) {
      allMemos.push(...data.memos)
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return allMemos
}

/** ⑤ 带超时 + 按状态码分类报错（401/403/400/429/网络不可达 各自可定位） */
async function xhrRequest(
  url: string,
  token: string,
): Promise<MemosListResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.timeout = 30000
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("Accept", "application/json")
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return
      const body = (xhr.responseText || "").substring(0, 200)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MemosListResponse)
        } catch (e) {
          reject(new Error(`响应不是合法 JSON：${body}`))
        }
        return
      }
      switch (xhr.status) {
        case 0:
          reject(new Error("网络不可达：请检查 API 地址 / 代理 / 证书"))
          return
        case 400:
          reject(new Error(`请求参数错误（filter 语法）：${body}`))
          return
        case 401:
          reject(new Error("API Token 无效或已过期（401）"))
          return
        case 403:
          reject(new Error("无权限访问该资源（403）"))
          return
        case 429:
          reject(new Error("请求过于频繁（429），请稍后重试"))
          return
        default:
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}。${body}`))
      }
    }
    xhr.ontimeout = () =>
      reject(new Error("请求超时（30s）：请检查 Memos 服务是否可达"))
    xhr.onerror = () =>
      reject(new Error("网络不可达：请检查 API 地址 / 代理 / 证书"))
    xhr.send()
  })
}

/** 解析 memo：标题（首段，剥引用前缀）+ 正文段落 */
function parseMemosContent(
  memo: MemosMemo,
  memoId: string,
): { titleText: string; bodyParas: string[] } {
  let cleanContent = memo.content ?? ""
  if (memo.tags?.length) {
    const escapedTags = memo.tags.map((tag) =>
      tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    const tagPattern = new RegExp(`#(?:${escapedTags.join("|")})\\s*`, "g")
    cleanContent = cleanContent.replace(tagPattern, "").trim()
  }
  const paragraphs = cleanContent.split("\n").filter((p) => p.trim())
  const first = paragraphs[0] ?? memoId
  // 首行若是引用（`> ` 开头），剥掉前缀，避免标题带上引号符号
  const titleText = fragmentsToText(
    parseInline(stripBlockPrefix(first)),
  ).substring(0, 100)
  const bodyParas = paragraphs.slice(1).filter((p) => p.trim())
  return { titleText, bodyParas }
}

/**
 * 单条 memo：命中则更新（①），否则新建。返回是否成功（②：不再静默吞错）。
 */
async function syncMemo(
  memo: MemosMemo,
  inbox: Block,
  noteTag: string,
  memosApiUrl: string,
  existingBlocks: Map<string, ExistingEntry>,
): Promise<boolean> {
  try {
    // ④ 严格解析 memoId：只认 `memos/<id>`，异常格式直接判失败，不污染查重/ID 属性
    const memoId = /^memos\/(.+)$/.exec(memo.name ?? "")?.[1]?.trim() ?? ""
    if (!memoId) {
      console.warn("MEMOS SYNC: 非法的 memo.name", memo.name)
      return false
    }

    // ① 命中已有块 → 重建：先在新位置建好整棵子树，成功后再删旧根块。
    //    ⚠️ 不原地更新：`core.editor.setBlocksContent` / `removeTag` 内部会读
    //    `orca.state.blocks[id]`，而未打开的日记页里的块并不在内存中，
    //    `getRepr(undefined)` 会直接抛错（实测：改正文后同步「成功 0 条，失败 1 条」）。
    //    `deleteBlocks` 只按 ID 操作，不依赖内存态，安全。
    let oldRootId: DbId | null = null
    let beforeAnchor: Block | null = null
    const hit = existingBlocks.get(memoId)
    if (hit) {
      oldRootId = hit.rootId
      beforeAnchor = orca.state.blocks[hit.rootId] ?? null
      if (!beforeAnchor) {
        const fetched = ((await orca.invokeBackend("get-blocks", [
          hit.rootId,
        ])) ?? []) as Block[]
        beforeAnchor = fetched?.[0] ?? null
      }
    }

    const { titleText, bodyParas } = parseMemosContent(memo, memoId)

    // ===== 第1层：根块（纯 ID 文本，不含 # 以免被 Orca 当作标签引用解析） =====
    // 更新时插到旧根块「之前」以保持顺序；anchor 不可用则退回追加到 Inbox 末尾
    let rootId = beforeAnchor
      ? await orca.commands.invokeEditorCommand(
          "core.editor.insertBlock",
          null,
          beforeAnchor,
          "before",
          [{ t: "t", v: memoId }],
        )
      : null
    if (!rootId) {
      rootId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        inbox,
        "lastChild",
        [{ t: "t", v: memoId }],
      )
    }
    let noteBlock = orca.state.blocks[rootId] ?? null
    if (!noteBlock) return false

    // 在根块上存一份 ID 属性（供批量查重使用，get-blocks 可读取）
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [rootId],
      [{ name: "ID", type: 1, value: memoId }],
    )

    // 根块标签：仅 #Memos Note，ID 存于标签属性（供精确查询使用）
    await orca.commands.invokeEditorCommand(
      "core.editor.insertTag",
      null,
      rootId,
      noteTag,
      [{ name: "ID", type: 1, value: memoId }],
    )

    // ===== 第2层：标题块（含核心标签） =====
    const titleId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      noteBlock,
      "lastChild",
      [{ t: "t", v: titleText }],
    )
    if (!titleId) return false

    // Memos 原始标签打在标题块上
    if (memo.tags?.length) {
      for (const tag of memo.tags) {
        await orca.commands.invokeEditorCommand(
          "core.editor.insertTag",
          null,
          titleId,
          tag,
        )
      }
    }

    // ===== 第3层：内容块（标题块的子块） =====
    await writeBody(titleId, bodyParas)

    // ===== 第4层：链接块（最后，溯源用） =====
    noteBlock = orca.state.blocks[rootId] ?? noteBlock
    // v0.31.0 网页路由为 /memos/{uid}（navigation.ts: directMemoPrefix = "/memos/"），
    // 旧路由 /m/{uid} 在新实例中会 404，故改为 /memos/。
    const memoUrl = `${memosApiUrl.replace(/\/$/, "")}/memos/${memoId}`
    await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      noteBlock,
      "lastChild",
      // t:"l" = 内联链接片段，v=显示文本，l=跳转URL
      [{ t: "l", v: "🔗 Open in Memos", l: memoUrl }],
    )

    // 整棵新子树建好后再删旧根块：中途失败只会留下旧块（可见、可重试），不会丢数据
    if (oldRootId) {
      try {
        await orca.commands.invokeEditorCommand(
          "core.editor.deleteBlocks",
          null,
          [oldRootId],
        )
      } catch (e) {
        console.warn("MEMOS SYNC: 删除旧根块失败（将留下重复块）", oldRootId, e)
      }
    }

    return true
  } catch (e) {
    console.error("MEMOS SYNC: syncMemo error for", memo.name, e)
    if (!lastSyncError) {
      lastSyncError = `${memo.name}: ${e instanceof Error ? e.message : String(e)}`
    }
    return false
  }
}

// 说明：早期版本在这里有 updateMemo()（setBlocksContent + removeTag 原地更新）与 syncTags()
// （`_tags` → ref → 标签块文本的差分）。二者都已移除：
//   - setBlocksContent 依赖 `orca.state.blocks[id]` 已在内存中，未打开的页面会抛错；
//   - 重建整棵子树（新建 + deleteBlocks 旧根块）能同时覆盖标题/标签/正文，且只用按 ID 操作的命令。
// 若将来需要「原地更新」（保留块 ID），必须先解决"把目标块载入 orca.state"这件事。

/**
 * 正文写入（①⑮⑯ 三路径共用）。
 * - 若标题块已有子块（更新路径），先整体删除再重建。
 * - `quote2` 是**容器块**：只渲染子块、不渲染内联 content → 必须「空容器 + text 子块」。
 * - ⑮ 连续引用行 → 同一个容器内**每行一个子块**（与 Orca 原生多段引用一致）。
 * - ⑯ 行内 `> 引文` → 拆成文本块 + 引用块，避免残留字面 `>`。
 */
async function writeBody(titleId: DbId, bodyParas: string[]) {
  const titleBlock = orca.state.blocks[titleId]
  if (!titleBlock) return

  const oldChildren = titleBlock.children ?? []
  if (oldChildren.length) {
    await orca.commands.invokeEditorCommand(
      "core.editor.deleteBlocks",
      null,
      oldChildren,
    )
  }

  // 解析成「块规格」后逐块渲染（块级 Markdown：标题/列表/代码/分隔线/引用）
  const specs = parseBlocks(bodyParas)

  let prev: DbId | null = null
  for (const spec of specs) {
    const anchor = prev
      ? orca.state.blocks[prev] ?? orca.state.blocks[titleId]
      : orca.state.blocks[titleId]
    const position = prev ? "after" : "firstChild"
    if (!anchor) break

    // 引用是容器：空 quote2 + 每行一个 text 子块
    if (spec.kind === "quote") {
      const quoteId = await orca.commands.invokeEditorCommand(
        "core.editor.insertBlock",
        null,
        anchor,
        position,
        null, // 容器 content 必须为 null
        { type: "quote2" },
      )
      if (!quoteId) continue
      const quoteBlock = orca.state.blocks[quoteId]
      if (quoteBlock) {
        for (const line of spec.lines) {
          await orca.commands.invokeEditorCommand(
            "core.editor.insertBlock",
            null,
            quoteBlock,
            "lastChild",
            line, // 已是片段数组（可含粗体/链接）
            { type: "text" },
          )
        }
      }
      prev = quoteId
      continue
    }

    // 其余类型都是内联 repr：content 直接放片段数组（可含粗体/斜体/代码/链接）
    let content: Record<string, unknown>[] | null = null
    let repr: Record<string, unknown> = { type: "text" }
    switch (spec.kind) {
      case "text":
        content = spec.content
        repr = { type: "text" }
        break
      case "ul":
        content = spec.content
        repr = { type: "ul" }
        break
      case "ol":
        content = spec.content
        repr = { type: "ol" }
        break
      case "heading":
        content = spec.content
        repr = { type: "heading", level: spec.level }
        break
      case "code":
        content = [{ t: "t", v: spec.text }]
        repr = { type: "code", lang: spec.lang, wrap: false }
        break
      case "hr":
        content = null
        repr = { type: "hr" }
        break
      case "image":
        content = null
        repr = { type: "image", src: spec.src }
        break
    }

    const id = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      anchor,
      position,
      content,
      repr,
    )
    if (id) prev = id
  }
}
