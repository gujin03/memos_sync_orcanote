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

    await orca.commands.invokeGroup(async () => {
      for (const [date, memosInDate] of memosByDate.entries()) {
        const journal: Block = await orca.invokeBackend(
          "get-journal-block",
          new Date(date),
        )
        if (journal == null) continue
        const inbox = await ensureInbox(journal, inboxName)

        for (const memo of memosInDate) {
          await syncMemo(memo, inbox, noteTag, memosApiUrl)
        }
      }
    })

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
            reject(new Error(`Failed to parse JSON: ${xhr.responseText.substring(0, 200)}`))
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}. Response: ${xhr.responseText.substring(0, 200)}`))
        }
      }
    }
    xhr.onerror = () => {
      reject(new Error(`Network error. Response: ${xhr.responseText.substring(0, 200)}`))
    }
    xhr.send()
  })
}

async function syncMemo(
  memo: MemosMemo,
  inbox: Block,
  noteTag: string,
  memosApiUrl: string,
) {
  const memoId = memo.name.replace("memos/", "")

  // 1. 查重：按 #Memos Note 标签的 ID 属性查找
  const resultIds = (await orca.invokeBackend("query", {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 4,
          name: noteTag,
          properties: [{ name: "ID", op: 1, value: memoId }],
        },
      ],
    },
    pageSize: 1,
  } as QueryDescription)) as DbId[]

  // 已有块：删除整个旧结构（不兼容新规则），下方重建
  if (resultIds.length > 0) {
    const oldBlockId = resultIds[0]
    await orca.commands.invokeEditorCommand("core.editor.deleteBlocks", null, [oldBlockId])
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

  // ===== 第1层：根块 =====
  const rootId = await orca.commands.invokeEditorCommand(
    "core.editor.insertBlock",
    null,
    inbox,
    "lastChild",
    [{ t: "t", v: `${memoId} #Memos Note` }],
    { type: "text" },
    new Date(memo.createTime),
    new Date(memo.updateTime),
  )
  let noteBlock = orca.state.blocks[rootId] ?? null
  if (!noteBlock) return

  // 根块标签：仅 #Memos Note，ID 存于标签属性
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
  const memoUrl = `${memosApiUrl.replace(/\/$/, "")}/m/${memoId}`
  await orca.commands.invokeEditorCommand(
    "core.editor.insertBlock",
    null,
    noteBlock,
    "lastChild",
    [{ t: "t", v: `🔗 Open in Memos：${memoUrl}` }],
  )
}
