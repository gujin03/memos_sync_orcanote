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
): Promise<MemosMemo[]> {
  const baseUrl = apiUrl.replace(/\/$/, "")
  const url = new URL(`${baseUrl}/api/v1/memos`)
  url.searchParams.set("page_size", "100")
  url.searchParams.set("order_by", "create_time desc")

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

  // Client-side filtering
  let filteredMemos = allMemos

  // Filter by startDate
  if (startDate) {
    const startDateMs = new Date(startDate).getTime()
    filteredMemos = filteredMemos.filter(
      (m) => new Date(m.createTime).getTime() >= startDateMs,
    )
  }

  // Filter by lastSyncTime (only for incremental sync)
  if (lastSyncTime) {
    filteredMemos = filteredMemos.filter(
      (m) => new Date(m.updateTime).getTime() >= lastSyncTime,
    )
  }

  return filteredMemos
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

  let noteBlock: Block | null = null

  if (resultIds.length > 0) {
    const noteBlockId = resultIds[0]
    noteBlock = orca.state.blocks[noteBlockId] ?? null
    if (noteBlock == null) {
      noteBlock = await orca.invokeBackend("get-block", noteBlockId)
      if (noteBlock == null) return
      orca.state.blocks[noteBlock.id] = noteBlock
    }

    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [noteBlock.id],
      [{ name: "_tags", type: 2, value: [] }],
    )

    if (noteBlock.children.length > 0) {
      await orca.commands.invokeEditorCommand(
        "core.editor.deleteBlocks",
        null,
        [...noteBlock.children],
      )
    }
  } else {
    const noteBlockId = await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      inbox,
      "lastChild",
      [{ t: "t", v: memoId }],
      { type: "text" },
      new Date(memo.createTime),
      new Date(memo.updateTime),
    )
    noteBlock = orca.state.blocks[noteBlockId] ?? null
  }

  if (noteBlock == null) return

  const tagBlockId = await orca.commands.invokeEditorCommand(
    "core.editor.insertTag",
    null,
    noteBlock.id,
    noteTag,
    [{ name: "ID", type: 1, value: memoId }],
  )
  const tagBlock = orca.state.blocks[tagBlockId]
  if (tagBlock && !tagBlock.properties?.some((p) => p.name === "ID")) {
    await orca.commands.invokeEditorCommand(
      "core.editor.setProperties",
      null,
      [tagBlock.id],
      [{ name: "ID", type: 1 }],
    )
  }

  if (memo.tags?.length) {
    for (const tag of memo.tags) {
      await orca.commands.invokeEditorCommand(
        "core.editor.insertTag",
        null,
        noteBlock.id,
        tag,
      )
    }
  }

  // Strip tag hashtags from content to avoid duplication
  // (tags are already inserted as tag blocks above)
  let cleanContent = memo.content
  if (memo.tags?.length) {
    const escapedTags = memo.tags.map((tag) =>
      tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    const tagPattern = new RegExp(`#(?:${escapedTags.join("|")})\\s*`, "g")
    cleanContent = cleanContent.replace(tagPattern, "").trim()
  }

  // Prepend URL link to memo content for quick access back to Memos
  const memoUrl = `${memosApiUrl.replace(/\/$/, "")}/memos/${memoId}`
  cleanContent = `<p>🔗 <a href="${memoUrl}">Open in Memos</a></p>` + cleanContent

  await orca.commands.invokeEditorCommand(
    "core.editor.batchInsertHTML",
    null,
    noteBlock,
    "firstChild",
    cleanContent,
  )
}
