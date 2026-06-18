import { startOfDay } from "date-fns"
import LogoImg from "../icon.png"
import { setupL10N, t } from "./libs/l10n"
import { ensureInbox, groupBy } from "./libs/utils"
import type { Block, DbId, QueryDescription } from "./orca"
import zhCN from "./translations/zhCN"

let pluginName: string

interface MemosMemo {
  name: string
  content: string
  createTime: string
  updateTime: string
  creator: string
  visibility: number
  tags: string[]
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
  orca.themes.removeCSS(pluginName)

  console.log(`${pluginName} unloaded.`)
}

async function syncMemos(fullSync: boolean) {
  const settings = orca.state.plugins[pluginName]?.settings
  if (!settings) {
    orca.notify("error", t("Plugin settings not found."))
    return
  }
  const memosApiUrl = settings.memosApiUrl
  const memosApiToken = settings.memosApiToken
  const inboxName = settings.inboxName || "Memos Inbox"
  const noteTag = settings.noteTag || "Memos Note"
  const startDateValue = settings.startDate
  const visibilityFilter: string[] = settings.visibilityFilter ?? [
    "PRIVATE",
    "PROTECTED",
    "PUBLIC",
  ]

  if (!memosApiUrl || !memosApiToken) {
    orca.notify("warn", t("Please configure memos API URL and token first."))
    return
  }

  orca.notify("info", t("Starting to sync, please wait..."))

  try {
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

    // 批量查询已存在的 Memos Note 块，构建 ID 查找表（替代逐条 N+1 查询）
    const allExisting = (await orca.invokeBackend("query", {
      q: { kind: 1, conditions: [{ kind: 4, name: noteTag }] },
      pageSize: 100000,
    } as QueryDescription)) as DbId[]
    const existingBlocks = new Map<string, DbId>()
    if (allExisting?.length) {
      const existingBlocksData = await orca.invokeBackend("get-blocks", allExisting)
      if (existingBlocksData) {
        for (const b of existingBlocksData as Block[]) {
          if (!b) continue
          // 优先从根块 ID 属性读取（新格式）
          const idProp = b.properties?.find(p => p.name === "ID")
          if (idProp?.value) {
            existingBlocks.set(idProp.value as string, b.id)
          } else if (b.text) {
            // 回退：用根块文本作为 memoId（兼容旧格式块）
            existingBlocks.set(b.text, b.id)
          }
        }
      }
    }

    // 全量同步时：清除旧结构
    if (fullSync && existingBlocks.size > 0) {
      orca.notify("info", t("Cleaning up old data before full sync..."))
      const idsToDelete = [...existingBlocks.values()]
      for (let i = 0; i < idsToDelete.length; i += 100) {
        try {
          await orca.commands.invokeEditorCommand(
            "core.editor.deleteBlocks", null, idsToDelete.slice(i, i + 100),
          )
        } catch (e) {
          console.warn("MEMOS SYNC: Failed to delete batch", e)
        }
      }
      existingBlocks.clear()
    }

    for (const [date, memosInDate] of memosByDate.entries()) {
      const journal: Block = await orca.invokeBackend(
        "get-journal-block",
        new Date(date),
      )
      if (journal == null) continue
      const inbox = await ensureInbox(journal, inboxName)

      for (const memo of memosInDate) {
        await syncMemo(memo, inbox, noteTag, memosApiUrl, existingBlocks)
        syncedCount++
        // 每 20 条通知一次进度
        if (syncedCount % 20 === 0 || syncedCount === totalMemos) {
          orca.notify("info", `Syncing... ${syncedCount}/${totalMemos}`)
        }
      }
    }

    await orca.plugins.setData(pluginName, "lastSyncTime", Date.now())

    orca.notify("success", t("Memos notes synced successfully."))
  } catch (err) {
    console.error("MEMOS SYNC:", err)
    orca.notify("error", t("Failed to sync Memos notes."))
  }
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
  url.searchParams.set("page_size", "100")
  url.searchParams.set("order_by", "create_time desc")

  // Build server-side filter (CEL syntax — Memos uses Unix second timestamps for dates)
  // created_ts and updated_ts map to the DB's Unix timestamp columns.
  // The returned memo.createTime is still an ISO 8601 string — no conflict.
  const filters: string[] = []
  if (startDate) {
    const startTs = Math.floor(new Date(startDate).getTime() / 1000)
    filters.push(`created_ts >= ${startTs}`)
  }
  if (lastSyncTime) {
    const lastSyncTs = Math.floor(lastSyncTime / 1000)
    filters.push(`updated_ts >= ${lastSyncTs}`)
  }
  if (
    visibilityFilter?.length > 0 &&
    visibilityFilter.length < 3
  ) {
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
      url.searchParams.set("page_token", pageToken)
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

function xhrRequest(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.setRequestHeader("Accept", "application/json")
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${(xhr.responseText || "").substring(0, 200)}`))
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}. Response: ${(xhr.responseText || "").substring(0, 200)}`))
        }
      }
    }
    xhr.onerror = () => {
      reject(new Error(`Network error. Response: ${(xhr.responseText || "").substring(0, 200)}`))
    }
    xhr.send()
  })
}

async function syncMemo(
  memo: MemosMemo,
  inbox: Block,
  noteTag: string,
  memosApiUrl: string,
  existingBlocks: Map<string, DbId>,
) {
  try {
    const memoId = memo.name.replace("memos/", "")

    // 查重：从批量查询的 Map 中 O(1) 查找（替代逐条 API 查询）
    if (existingBlocks.has(memoId)) {
      return
    }

    // 2. 准备内容：去标签文本
    let cleanContent = memo.content
    if (memo.tags?.length) {
      const escapedTags = memo.tags.map((tag) =>
        tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      const tagPattern = new RegExp(`#(?:${escapedTags.join("|")})\\s*`, "g")
      cleanContent = cleanContent.replace(tagPattern, "").trim()
    }

    // 提取标题（第2层用）：第一行/首句，最多100字符
    const paragraphs = cleanContent.split("\n").filter((p) => p.trim())
    const titleText = (paragraphs[0] || memoId).substring(0, 100)
    const bodyParas = paragraphs.slice(1).filter((p) => p.trim())

    // ===== 第1层：根块（纯 ID 文本，不含 # 以免被 Orca 当作标签引用解析） =====
    const rootId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock", null as any, inbox, "lastChild",
      [{ t: "t", v: memoId }],
    )
    let noteBlock = orca.state.blocks[rootId] ?? null
    if (!noteBlock) return

    // 在根块上存一份 ID 属性（供批量查重使用，get-blocks 可读取）
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties", null, [rootId],
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
    if (!titleId) return

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
    if (bodyParas.length > 0) {
      const titleBlock = orca.state.blocks[titleId]
      if (titleBlock) {
        let prevContentId: DbId | null = null
        for (const para of bodyParas) {
          const paraId = await orca.commands.invokeEditorCommand(
            "core.editor.insertBlock",
            null,
            prevContentId ? orca.state.blocks[prevContentId] : titleBlock,
            prevContentId ? "after" : "firstChild",
            [{ t: "t", v: para.trim() }],
          )
          if (paraId) prevContentId = paraId
        }
      }
    }

    // ===== 第4层：链接块（最后，溯源用） =====
    // 重新获取根块（title 插入后 children 已变，旧引用 stale）
    noteBlock = orca.state.blocks[rootId] ?? noteBlock
    const memoUrl = `${memosApiUrl.replace(/\/$/, "")}/m/${memoId}`
    await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      noteBlock,
      "lastChild",
      // t:"l" = 内联链接片段，v=显示文本，l=跳转URL
      [{ t: "l", v: "🔗 Open in Memos", l: memoUrl }],
    )
  } catch (e) {
    console.error("MEMOS SYNC: syncMemo error for", memo.name, e)
  }
}
