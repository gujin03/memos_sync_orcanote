const constructFromSymbol = Symbol.for("constructDateFrom");
function constructFrom(date, value) {
  if (typeof date === "function") return date(value);
  if (date && typeof date === "object" && constructFromSymbol in date)
    return date[constructFromSymbol](value);
  if (date instanceof Date) return new date.constructor(value);
  return new Date(value);
}
function toDate(argument, context) {
  return constructFrom(argument, argument);
}
function startOfDay(date, options) {
  const _date = toDate(date);
  _date.setHours(0, 0, 0, 0);
  return _date;
}
const LogoImg = "data:image/png;base64,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";
let _locale = "en";
let _translations = {};
function setupL10N(locale, builtinTranslations) {
  _locale = locale;
  _translations = builtinTranslations;
}
function t(key, args, locale) {
  var _a;
  const template = ((_a = _translations[locale ?? _locale]) == null ? void 0 : _a[key]) ?? key;
  return template;
}
function groupBy(keyFn, values) {
  const map = /* @__PURE__ */ new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(value);
  }
  return map;
}
async function ensureInbox(container, inboxName) {
  var _a;
  const notInMemoryBlockIds = [];
  for (const blockId of container.children) {
    const block = orca.state.blocks[blockId];
    if (block != null) {
      if (((_a = block.text) == null ? void 0 : _a.trim()) === inboxName) {
        return block;
      }
    } else {
      notInMemoryBlockIds.push(blockId);
    }
  }
  const blocks = await orca.invokeBackend("get-blocks", notInMemoryBlockIds);
  const inbox = blocks.find((block) => {
    var _a2;
    return ((_a2 = block.text) == null ? void 0 : _a2.trim()) === inboxName;
  });
  if (inbox == null) {
    const inboxBlockId = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, container, "lastChild", [
      {
        t: "t",
        v: inboxName
      }
    ]);
    return orca.state.blocks[inboxBlockId];
  }
  return inbox;
}
const QUOTE_LINE_RE = /^(?:>\s*)+/;
const INLINE_QUOTE_RE = /[：:。；;，,、]\s*>+\s*/;
const FENCE_RE = /^(`{3,}|~{3,})\s*(\S*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const UL_RE = /^[-*+]\s+(.+)$/;
const OL_RE = /^\d+[.)]\s+(.+)$/;
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const INLINE_RE = new RegExp("\\[([^\\]]*)\\]\\(([^)\\s]+)\\)|`([^`]+)`|\\*\\*([^*]+)\\*\\*|\\*([^*]+)\\*|(?<![\\w])_([^_]+)_(?![\\w])", "g");
const ORCA_LANG_NAMES = [
  "APL",
  "ASN.1",
  "Asterisk",
  "Brainfuck",
  "C",
  "C#",
  "C++",
  "CMake",
  "CQL",
  "CSS",
  "Clojure",
  "ClojureScript",
  "Cobol",
  "CoffeeScript",
  "Common Lisp",
  "Crystal",
  "Cypher",
  "Cython",
  "D",
  "DTD",
  "Dart",
  "Dockerfile",
  "Dylan",
  "EBNF",
  "ECL",
  "Eiffel",
  "Elm",
  "Erlang",
  "Esper",
  "F#",
  "FCL",
  "Factor",
  "Forth",
  "Fortran",
  "Gas",
  "Gherkin",
  "Go",
  "Groovy",
  "HTML",
  "HTTP",
  "HXML",
  "Haskell",
  "Haxe",
  "IDL",
  "JSON",
  "JSON-LD",
  "JSX",
  "Java",
  "JavaScript",
  "Jinja2",
  "Julia",
  "Kotlin",
  "LESS",
  "LaTeX",
  "Liquid",
  "LiveScript",
  "Lua",
  "MS SQL",
  "MUMPS",
  "MariaDB SQL",
  "Markdown",
  "Mathematica",
  "Mbox",
  "Modelica",
  "MsGenny",
  "MscGen",
  "MySQL",
  "NSIS",
  "NTriples",
  "Nginx",
  "OCaml",
  "Objective-C",
  "Objective-C++",
  "Octave",
  "Oz",
  "PGP",
  "PHP",
  "PLSQL",
  "Pascal",
  "Perl",
  "Pig",
  "Plain Text",
  "PostgreSQL",
  "PowerShell",
  "Properties files",
  "ProtoBuf",
  "Pug",
  "Puppet",
  "Python",
  "Q",
  "R",
  "RPM Changes",
  "RPM Spec",
  "Ruby",
  "Rust",
  "SAS",
  "SCSS",
  "SML",
  "SPARQL",
  "SQL",
  "SQLite",
  "Sass",
  "Scala",
  "Scheme",
  "Shell",
  "Sieve",
  "Smalltalk",
  "Solr",
  "Spreadsheet",
  "Squirrel",
  "Stata",
  "Stylus",
  "Swift",
  "SystemVerilog",
  "TOML",
  "TSX",
  "TTCN",
  "TTCN_CFG",
  "Tcl",
  "Textile",
  "TiddlyWiki",
  "Tiki wiki",
  "Troff",
  "Turtle",
  "TypeScript",
  "VB.NET",
  "VBScript",
  "VHDL",
  "Velocity",
  "Verilog",
  "Vue",
  "Web IDL",
  "WebAssembly",
  "XML",
  "XQuery",
  "YAML",
  "Yacas",
  "Z80",
  "diff",
  "edn",
  "mIRC",
  "sTeX"
];
const LANG_ALIASES = {
  py: "Python",
  python3: "Python",
  py3: "Python",
  ipython: "Python",
  js: "JavaScript",
  javascript: "JavaScript",
  node: "JavaScript",
  nodejs: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  sh: "Shell",
  bash: "Shell",
  shell: "Shell",
  zsh: "Shell",
  console: "Shell",
  "shell-session": "Shell",
  yml: "YAML",
  yaml: "YAML",
  htm: "HTML",
  html: "HTML",
  xhtml: "HTML",
  md: "Markdown",
  markdown: "Markdown",
  cpp: "C++",
  "c++": "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  c: "C",
  h: "C",
  cs: "C#",
  csharp: "C#",
  "c#": "C#",
  rs: "Rust",
  rust: "Rust",
  golang: "Go",
  go: "Go",
  kt: "Kotlin",
  kts: "Kotlin",
  rb: "Ruby",
  ruby: "Ruby",
  pl: "Perl",
  perl: "Perl",
  ps1: "PowerShell",
  powershell: "PowerShell",
  pwsh: "PowerShell",
  dockerfile: "Dockerfile",
  docker: "Dockerfile",
  ini: "Properties files",
  properties: "Properties files",
  txt: "Plain Text",
  text: "Plain Text",
  plaintext: "Plain Text",
  plain: "Plain Text",
  objc: "Objective-C",
  "objective-c": "Objective-C",
  "objective-c++": "Objective-C++",
  mysql: "MySQL",
  pgsql: "PostgreSQL",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  sqlite: "SQLite",
  sqlite3: "SQLite",
  mssql: "MS SQL",
  plsql: "PLSQL",
  mariadb: "MariaDB SQL",
  proto: "ProtoBuf",
  protobuf: "ProtoBuf",
  tex: "LaTeX",
  latex: "LaTeX",
  diff: "diff",
  patch: "diff",
  vb: "VB.NET",
  vbnet: "VB.NET",
  vbs: "VBScript",
  json5: "JSON",
  jsonc: "JSON",
  scss: "SCSS",
  sass: "Sass",
  less: "LESS",
  stylus: "Stylus",
  clj: "Clojure",
  cljs: "ClojureScript",
  hs: "Haskell",
  erl: "Erlang",
  jl: "Julia",
  dart: "Dart",
  lua: "Lua",
  scala: "Scala",
  fs: "F#",
  fsharp: "F#",
  vue: "Vue",
  jsx: "JSX",
  tsx: "TSX",
  toml: "TOML",
  xml: "XML"
};
const LANG_BY_LOWER = new Map(ORCA_LANG_NAMES.map((n) => [
  n.toLowerCase(),
  n
]));
function normalizeLang(raw) {
  const key = (raw ?? "").trim();
  if (!key) return "";
  const lower = key.toLowerCase();
  const byName = LANG_BY_LOWER.get(lower);
  if (byName) return byName;
  const byAlias = LANG_ALIASES[lower];
  if (byAlias) return byAlias;
  return key;
}
function stripQuotePrefix(s) {
  return s.replace(QUOTE_LINE_RE, "").trim();
}
function isQuoteLine(s) {
  return s.startsWith(">");
}
function stripBlockPrefix(s) {
  return stripQuotePrefix(s).replace(/^#{1,6}\s+/, "").trim();
}
function parseInline(text) {
  const out = [];
  let last = 0;
  let m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({
      t: "t",
      v: text.slice(last, m.index)
    });
    if (m[1] !== void 0) {
      out.push({
        t: "l",
        v: m[1] || m[2],
        l: m[2]
      });
    } else if (m[3] !== void 0) {
      out.push({
        t: "t",
        v: m[3],
        f: "c"
      });
    } else if (m[4] !== void 0) {
      out.push({
        t: "t",
        v: m[4],
        f: "b"
      });
    } else if (m[5] !== void 0) {
      out.push({
        t: "t",
        v: m[5],
        f: "i"
      });
    } else if (m[6] !== void 0) {
      out.push({
        t: "t",
        v: m[6],
        f: "i"
      });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({
    t: "t",
    v: text.slice(last)
  });
  return out.filter((f) => f.v !== "" || f.t === "l");
}
function fragmentsToText(frags) {
  return frags.map((f) => f.v).join("");
}
function splitImages(line) {
  const out = [];
  let last = 0;
  let m;
  IMAGE_RE.lastIndex = 0;
  while ((m = IMAGE_RE.exec(line)) !== null) {
    if (m.index > last) out.push({
      kind: "text",
      value: line.slice(last, m.index)
    });
    out.push({
      kind: "image",
      value: m[2]
    });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({
    kind: "text",
    value: line.slice(last)
  });
  return out.length ? out : [
    {
      kind: "text",
      value: line
    }
  ];
}
function splitInlineQuotes(para) {
  const out = [];
  let rest = para;
  let quoteMode = false;
  while (true) {
    const m = INLINE_QUOTE_RE.exec(rest);
    if (!m) break;
    const gt = m.index + m[0].lastIndexOf(">");
    const head = rest.slice(0, gt).trim();
    if (head) out.push({
      quote: quoteMode,
      text: head
    });
    rest = rest.slice(gt + 1).trim();
    quoteMode = true;
    if (!INLINE_QUOTE_RE.test(rest)) break;
  }
  if (rest.trim()) out.push({
    quote: quoteMode,
    text: rest.trim()
  });
  return out.length ? out : [
    {
      quote: false,
      text: para
    }
  ];
}
function parseBlocks(paras) {
  const out = [];
  let i = 0;
  while (i < paras.length) {
    const line = (paras[i] ?? "").trim();
    if (!line) {
      i++;
      continue;
    }
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const lang = (fence[2] ?? "").trim();
      const buf = [];
      i++;
      while (i < paras.length) {
        const cur = paras[i] ?? "";
        const close = FENCE_RE.exec(cur.trim());
        if (close && close[1][0] === marker) {
          i++;
          break;
        }
        buf.push(cur.replace(/\s+$/, ""));
        i++;
      }
      out.push({
        kind: "code",
        lang: normalizeLang(lang),
        text: buf.join("\n")
      });
      continue;
    }
    if (HR_RE.test(line)) {
      out.push({
        kind: "hr"
      });
      i++;
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      out.push({
        kind: "heading",
        level: Math.min(heading[1].length, 6),
        content: parseInline(heading[2].trim())
      });
      i++;
      continue;
    }
    const ul = UL_RE.exec(line);
    if (ul) {
      out.push({
        kind: "ul",
        content: parseInline(ul[1].trim())
      });
      i++;
      continue;
    }
    const ol = OL_RE.exec(line);
    if (ol) {
      out.push({
        kind: "ol",
        content: parseInline(ol[1].trim())
      });
      i++;
      continue;
    }
    if (isQuoteLine(line)) {
      const lines = [];
      while (i < paras.length && isQuoteLine((paras[i] ?? "").trim())) {
        const t2 = stripQuotePrefix((paras[i] ?? "").trim());
        if (t2) lines.push(parseInline(t2));
        i++;
      }
      if (lines.length) out.push({
        kind: "quote",
        lines
      });
      continue;
    }
    for (const part of splitImages(line)) {
      if (part.kind === "image") {
        out.push({
          kind: "image",
          src: part.value
        });
        continue;
      }
      const textPart = part.value.trim();
      if (!textPart) continue;
      for (const seg of splitInlineQuotes(textPart)) {
        const t2 = seg.text.trim();
        if (!t2) continue;
        const content = parseInline(t2);
        if (!content.length) continue;
        out.push(seg.quote ? {
          kind: "quote",
          lines: [
            content
          ]
        } : {
          kind: "text",
          content
        });
      }
    }
    i++;
  }
  return out;
}
const zhCN = {
  // Settings
  "Memos API URL": "Memos API 地址",
  "The base URL of your memos instance.": "你的 memos 实例的基础地址。",
  "Memos API Token": "Memos API Token",
  "Your memos API token for authentication.": "你的 memos API token 用于认证。",
  "Inbox name": "收件箱名称",
  "The text used for the block where imported notes are placed under.": "收件箱描述文字，导入的笔记将放在该块下。",
  "Note tag": "笔记标签",
  "The tag applied to the imported notes.": "导入的笔记将使用该标签。",
  "Start date": "起始日期",
  "Notes before this date won't be synced, even in full sync mode.": "该日期之前的笔记将不会被同步，即使在全量同步模式下也是如此。",
  // Visibility filter
  "Visibility filter": "可见性过滤",
  "Select which visibility levels to sync. Unchecked items will be excluded.": "选择要同步的可见性级别，未勾选的类型将被排除。",
  "PRIVATE": "私有",
  "PROTECTED": "工作区",
  "PUBLIC": "公开",
  // Actions
  "Incremental sync": "增量同步",
  "Full sync": "全量同步",
  "Sync Memos notes": "同步 Memos 笔记",
  // Messages
  "Please configure memos API URL and token first.": "请先配置 memos API 地址和 token。",
  "Failed to sync Memos notes.": "Memos 笔记同步失败。",
  "Memos notes synced successfully.": "Memos 笔记同步成功。",
  "Nothing to sync.": "没有需要同步的内容。",
  "Starting to sync, please wait...": "开始同步，请稍后……"
};
let pluginName;
let syncing = false;
const FAIL_ROUNDS_KEY = "failRounds";
let lastSyncError = "";
async function load(_name) {
  pluginName = _name;
  setupL10N(orca.state.locale, {
    "zh-CN": zhCN
  });
  const Button = orca.components.Button;
  const HoverContextMenu = orca.components.HoverContextMenu;
  const MenuText = orca.components.MenuText;
  await orca.plugins.setSettingsSchema(pluginName, {
    memosApiUrl: {
      label: t("Memos API URL"),
      description: t("The base URL of your memos instance."),
      type: "string",
      defaultValue: ""
    },
    memosApiToken: {
      label: t("Memos API Token"),
      description: t("Your memos API token for authentication."),
      type: "string",
      defaultValue: ""
    },
    inboxName: {
      label: t("Inbox name"),
      description: t("The text used for the block where imported notes are placed under."),
      type: "string",
      defaultValue: "Memos Inbox"
    },
    noteTag: {
      label: t("Note tag"),
      description: t("The tag applied to the imported notes."),
      type: "string",
      defaultValue: "Memos Note"
    },
    startDate: {
      label: t("Start date"),
      description: t("Notes before this date won't be synced, even in full sync mode."),
      type: "date",
      defaultValue: null
    },
    visibilityFilter: {
      label: t("Visibility filter"),
      description: t("Select which visibility levels to sync. Unchecked items will be excluded."),
      type: "multiChoices",
      defaultValue: [
        "PRIVATE",
        "PROTECTED",
        "PUBLIC"
      ],
      choices: [
        {
          label: t("PRIVATE"),
          value: "PRIVATE"
        },
        {
          label: t("PROTECTED"),
          value: "PROTECTED"
        },
        {
          label: t("PUBLIC"),
          value: "PUBLIC"
        }
      ]
    }
  });
  orca.themes.injectCSS(`.memos-button { width: 20px; height: 20px; object-fit: contain; }`, pluginName);
  if (orca.state.commands["memos.sync"] == null) {
    orca.commands.registerCommand("memos.sync", async (fullSync = false) => {
      await syncMemos(fullSync);
    }, t("Sync Memos notes"));
  }
  if (orca.state.commands["memos.cleanup"] == null) {
    orca.commands.registerCommand("memos.cleanup", async () => {
      await checkDeletedMemos();
    }, t("检查已删除的 Memo（干跑）"));
  }
  if (orca.state.headbarButtons["memos.sync"] == null) {
    orca.headbar.registerHeadbarButton("memos.sync", () => /* @__PURE__ */ React.createElement(HoverContextMenu, {
      menu: (closeMenu) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(MenuText, {
        title: t("Incremental sync"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand("memos.sync");
        }
      }), /* @__PURE__ */ React.createElement(MenuText, {
        title: t("Full sync"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand("memos.sync", true);
        }
      }), /* @__PURE__ */ React.createElement(MenuText, {
        title: t("检查已删除的 Memo（干跑）"),
        onClick: async () => {
          closeMenu();
          await orca.commands.invokeCommand("memos.cleanup");
        }
      }))
    }, /* @__PURE__ */ React.createElement(Button, {
      variant: "plain",
      onClick: () => orca.commands.invokeCommand("memos.sync")
    }, /* @__PURE__ */ React.createElement("img", {
      className: "memos-button",
      src: LogoImg,
      alt: "Sync"
    }))));
  }
  console.log(`${pluginName} loaded.`);
}
async function unload() {
  orca.headbar.unregisterHeadbarButton("memos.sync");
  orca.commands.unregisterCommand("memos.sync");
  orca.commands.unregisterCommand("memos.cleanup");
  orca.themes.removeCSS(pluginName);
  console.log(`${pluginName} unloaded.`);
}
async function syncMemos(fullSync) {
  if (syncing) {
    orca.notify("warn", t("同步正在进行中，请稍候"));
    return;
  }
  syncing = true;
  try {
    await syncMemosInner(fullSync);
  } catch (err) {
    console.error("MEMOS SYNC:", err);
    orca.notify("error", `${t("Failed to sync Memos notes.")} ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    syncing = false;
  }
}
async function syncMemosInner(fullSync) {
  var _a;
  const settings = (_a = orca.state.plugins[pluginName]) == null ? void 0 : _a.settings;
  if (!settings) {
    orca.notify("error", t("Plugin settings not found."));
    return;
  }
  const memosApiUrl = settings.memosApiUrl;
  const memosApiToken = settings.memosApiToken;
  const inboxName = settings.inboxName || "Memos Inbox";
  const noteTag = settings.noteTag || "Memos Note";
  const startDateValue = settings.startDate;
  const visibilityFilter = settings.visibilityFilter ?? [
    "PRIVATE",
    "PROTECTED",
    "PUBLIC"
  ];
  if (!memosApiUrl || !memosApiToken) {
    orca.notify("warn", t("Please configure memos API URL and token first."));
    return;
  }
  if (visibilityFilter.length === 0) {
    orca.notify("warn", t("未选择任何可见性，已取消同步"));
    return;
  }
  lastSyncError = "";
  orca.notify("info", t("Starting to sync, please wait..."));
  let lastSyncTime = null;
  if (!fullSync) {
    const saved = await orca.plugins.getData(pluginName, "lastSyncTime");
    if (saved) lastSyncTime = saved;
  }
  const memos = await fetchMemos(memosApiUrl, memosApiToken, lastSyncTime, startDateValue, visibilityFilter);
  if (!(memos == null ? void 0 : memos.length)) {
    orca.notify("info", t("Nothing to sync."));
    return;
  }
  const memosByDate = groupBy((memo) => startOfDay(new Date(memo.createTime)).getTime(), memos);
  const totalMemos = memos.length;
  let syncedCount = 0;
  let failedCount = 0;
  let maxOkUpdatedMs = 0;
  const allExistingIds = await queryMemosNoteBlockIds(noteTag);
  let existingBlocks;
  if (fullSync) {
    const { ids: pluginRootIds, skipped } = await filterPluginRoots(allExistingIds);
    if (pluginRootIds.length) {
      orca.notify("info", `清理旧数据：将删除 ${pluginRootIds.length} 块（已跳过 ${skipped} 块非插件块）`);
      let deleteFailed = false;
      for (let i = 0; i < pluginRootIds.length; i += 100) {
        try {
          await orca.commands.invokeEditorCommand("core.editor.deleteBlocks", null, pluginRootIds.slice(i, i + 100));
        } catch (e) {
          console.error("MEMOS SYNC: 删除旧块失败", e);
          deleteFailed = true;
          break;
        }
      }
      if (deleteFailed) {
        throw new Error(`全量同步：删除旧块失败，已中断以避免产生重复块（已处理 ${pluginRootIds.length} 块中的一部分），请重试`);
      }
    }
    existingBlocks = /* @__PURE__ */ new Map();
  } else {
    existingBlocks = await buildExistingMap(allExistingIds);
  }
  for (const [date, memosInDate] of memosByDate.entries()) {
    const journal = await orca.invokeBackend("get-journal-block", new Date(date));
    if (journal == null) continue;
    const inbox = await ensureInbox(journal, inboxName);
    for (const memo of memosInDate) {
      const ok = await syncMemo(memo, inbox, noteTag, memosApiUrl, existingBlocks);
      if (ok) {
        syncedCount++;
        const ms = Date.parse(memo.updateTime || memo.createTime);
        if (!Number.isNaN(ms)) maxOkUpdatedMs = Math.max(maxOkUpdatedMs, ms);
      } else {
        failedCount++;
      }
      const done = syncedCount + failedCount;
      if (done % 20 === 0 || done === totalMemos) {
        orca.notify("info", `Syncing... ${done}/${totalMemos}`);
      }
    }
  }
  if (failedCount === 0) {
    await orca.plugins.setData(pluginName, "lastSyncTime", maxOkUpdatedMs || Date.now());
    await orca.plugins.setData(pluginName, FAIL_ROUNDS_KEY, 0);
  } else {
    const prevRounds = Number(await orca.plugins.getData(pluginName, FAIL_ROUNDS_KEY) ?? 0) || 0;
    const rounds = prevRounds + 1;
    await orca.plugins.setData(pluginName, FAIL_ROUNDS_KEY, rounds);
    if (rounds >= 3) {
      orca.notify("error", `已连续 ${rounds} 轮同步存在失败（本轮 ${failedCount} 条），同步水位未推进。请检查网络/服务可达性，或单条 memo 的数据格式。`);
    }
  }
  if (failedCount === 0) {
    orca.notify("success", t("Memos notes synced successfully."));
  } else {
    const reason = lastSyncError ? `｜首条错误：${lastSyncError.slice(0, 160)}` : "";
    orca.notify("warn", `同步完成：成功 ${syncedCount} 条，失败 ${failedCount} 条（水位未推进，下次会重试）${reason}`);
  }
}
async function queryMemosNoteBlockIds(noteTag) {
  const CAP = 1e5;
  const baseQuery = {
    q: {
      kind: 1,
      conditions: [
        {
          kind: 4,
          name: noteTag
        }
      ]
    },
    pageSize: CAP
  };
  const ids = await orca.invokeBackend("query", baseQuery) ?? [];
  if (ids.length < CAP) return ids;
  orca.notify("warn", `查询命中上限 ${CAP}，可能被截断，正在尝试分页取全…`);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let page = 1; page <= 500; page++) {
    const chunk = await orca.invokeBackend("query", {
      ...baseQuery,
      pageSize: 1e3,
      page
    }) ?? [];
    if (!chunk.length) break;
    const before = out.length;
    for (const id of chunk) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    if (out.length === before) break;
    if (chunk.length < 1e3) break;
  }
  if (out.length <= ids.length) {
    orca.notify("warn", "分页未生效，查询结果仍可能被截断，请留意是否有孤儿块。");
    return ids;
  }
  return out;
}
async function filterPluginRoots(allIds) {
  var _a;
  if (!(allIds == null ? void 0 : allIds.length)) return {
    ids: [],
    skipped: 0
  };
  const blocks = await orca.invokeBackend("get-blocks", allIds) ?? [];
  const ids = [];
  let skipped = 0;
  for (const b of blocks) {
    if (!b) continue;
    if ((_a = b.properties) == null ? void 0 : _a.some((p) => p.name === "ID")) ids.push(b.id);
    else skipped++;
  }
  return {
    ids,
    skipped
  };
}
async function buildExistingMap(allIds) {
  var _a;
  const map = /* @__PURE__ */ new Map();
  if (!(allIds == null ? void 0 : allIds.length)) return map;
  const blocks = await orca.invokeBackend("get-blocks", allIds) ?? [];
  for (const b of blocks) {
    if (!b) continue;
    const idProp = (_a = b.properties) == null ? void 0 : _a.find((p) => p.name === "ID");
    if (!(idProp == null ? void 0 : idProp.value)) {
      console.warn("MEMOS SYNC: 跳过无 ID 属性的块", b.id);
      continue;
    }
    const memoId = String(idProp.value).trim();
    if (!memoId || map.has(memoId)) continue;
    map.set(memoId, {
      rootId: b.id
    });
  }
  return map;
}
async function checkDeletedMemos() {
  var _a, _b;
  if (syncing) {
    orca.notify("warn", t("同步正在进行中，请稍候"));
    return;
  }
  syncing = true;
  try {
    const settings = (_a = orca.state.plugins[pluginName]) == null ? void 0 : _a.settings;
    if (!settings) {
      orca.notify("error", t("Plugin settings not found."));
      return;
    }
    const memosApiUrl = settings.memosApiUrl;
    const memosApiToken = settings.memosApiToken;
    const noteTag = settings.noteTag || "Memos Note";
    if (!memosApiUrl || !memosApiToken) {
      orca.notify("warn", t("Please configure memos API URL and token first."));
      return;
    }
    orca.notify("info", "正在拉取 Memos 全量 id（用于对比）…");
    const remoteIds = await fetchAllMemoIds(memosApiUrl, memosApiToken);
    const allExistingIds = await queryMemosNoteBlockIds(noteTag);
    const blocks = await orca.invokeBackend("get-blocks", allExistingIds) ?? [];
    const orphans = [];
    for (const b of blocks) {
      if (!b) continue;
      const idProp = (_b = b.properties) == null ? void 0 : _b.find((p) => p.name === "ID");
      if (!(idProp == null ? void 0 : idProp.value)) continue;
      const memoId = String(idProp.value).trim();
      if (memoId && !remoteIds.has(memoId)) {
        orphans.push({
          blockId: b.id,
          memoId
        });
      }
    }
    console.log("MEMOS SYNC: 疑似已删除清单", orphans);
    if (!orphans.length) {
      orca.notify("success", `检查完成：Memos ${remoteIds.size} 条 / Orca ${blocks.length} 块，未发现已删除的残留。`);
      return;
    }
    const preview = orphans.slice(0, 5).map((o) => `${o.memoId}(块${o.blockId})`).join("、");
    orca.notify("warn", `发现 ${orphans.length} 条 Memos 已删除但 Orca 仍保留：${preview}${orphans.length > 5 ? " …" : ""}（仅检测，未删除；完整清单见控制台）`);
  } catch (err) {
    console.error("MEMOS CLEANUP:", err);
    orca.notify("error", `检查失败：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    syncing = false;
  }
}
async function fetchAllMemoIds(apiUrl, token) {
  var _a, _b;
  const baseUrl = apiUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/memos`);
  url.searchParams.set("pageSize", "100");
  const ids = /* @__PURE__ */ new Set();
  let pageToken;
  let pages = 0;
  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    } else {
      url.searchParams.delete("page_token");
    }
    const data = await xhrRequest(url.toString(), token);
    for (const m of data.memos ?? []) {
      const id = (_b = (_a = /^memos\/(.+)$/.exec(m.name ?? "")) == null ? void 0 : _a[1]) == null ? void 0 : _b.trim();
      if (id) ids.add(id);
    }
    pageToken = data.nextPageToken;
    pages++;
    if (pages % 10 === 0) orca.notify("info", `已拉取 ${ids.size} 条…`);
  } while (pageToken);
  return ids;
}
async function fetchMemos(apiUrl, token, lastSyncTime, startDate, visibilityFilter) {
  const baseUrl = apiUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/api/memos`);
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("orderBy", "create_time desc");
  const filters = [];
  if (startDate) {
    const startTs = Math.floor(new Date(startDate).getTime() / 1e3);
    filters.push(`created_ts >= timestamp(${startTs})`);
  }
  if (lastSyncTime) {
    const lastSyncTs = Math.floor(lastSyncTime / 1e3);
    filters.push(`updated_ts >= timestamp(${lastSyncTs})`);
  }
  if (visibilityFilter.length > 0 && visibilityFilter.length < 3) {
    const visList = visibilityFilter.map((v) => `"${v}"`).join(", ");
    filters.push(`visibility in [${visList}]`);
  }
  if (filters.length > 0) {
    url.searchParams.set("filter", filters.join(" && "));
  }
  const allMemos = [];
  let pageToken;
  do {
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    } else {
      url.searchParams.delete("page_token");
    }
    const data = await xhrRequest(url.toString(), token);
    if (data.memos && Array.isArray(data.memos)) {
      allMemos.push(...data.memos);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allMemos;
}
async function xhrRequest(url, token) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 3e4;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      const body = (xhr.responseText || "").substring(0, 200);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error(`响应不是合法 JSON：${body}`));
        }
        return;
      }
      switch (xhr.status) {
        case 0:
          reject(new Error("网络不可达：请检查 API 地址 / 代理 / 证书"));
          return;
        case 400:
          reject(new Error(`请求参数错误（filter 语法）：${body}`));
          return;
        case 401:
          reject(new Error("API Token 无效或已过期（401）"));
          return;
        case 403:
          reject(new Error("无权限访问该资源（403）"));
          return;
        case 429:
          reject(new Error("请求过于频繁（429），请稍后重试"));
          return;
        default:
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}。${body}`));
      }
    };
    xhr.ontimeout = () => reject(new Error("请求超时（30s）：请检查 Memos 服务是否可达"));
    xhr.onerror = () => reject(new Error("网络不可达：请检查 API 地址 / 代理 / 证书"));
    xhr.send();
  });
}
function parseMemosContent(memo, memoId) {
  var _a;
  let cleanContent = memo.content ?? "";
  if ((_a = memo.tags) == null ? void 0 : _a.length) {
    const escapedTags = memo.tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const tagPattern = new RegExp(`#(?:${escapedTags.join("|")})\\s*`, "g");
    cleanContent = cleanContent.replace(tagPattern, "").trim();
  }
  const paragraphs = cleanContent.split("\n").filter((p) => p.trim());
  const first = paragraphs[0] ?? memoId;
  const titleText = fragmentsToText(parseInline(stripBlockPrefix(first))).substring(0, 100);
  const bodyParas = paragraphs.slice(1).filter((p) => p.trim());
  return {
    titleText,
    bodyParas
  };
}
async function syncMemo(memo, inbox, noteTag, memosApiUrl, existingBlocks) {
  var _a, _b, _c;
  try {
    const memoId = ((_b = (_a = /^memos\/(.+)$/.exec(memo.name ?? "")) == null ? void 0 : _a[1]) == null ? void 0 : _b.trim()) ?? "";
    if (!memoId) {
      console.warn("MEMOS SYNC: 非法的 memo.name", memo.name);
      return false;
    }
    let oldRootId = null;
    let beforeAnchor = null;
    const hit = existingBlocks.get(memoId);
    if (hit) {
      oldRootId = hit.rootId;
      beforeAnchor = orca.state.blocks[hit.rootId] ?? null;
      if (!beforeAnchor) {
        const fetched = await orca.invokeBackend("get-blocks", [
          hit.rootId
        ]) ?? [];
        beforeAnchor = (fetched == null ? void 0 : fetched[0]) ?? null;
      }
    }
    const { titleText, bodyParas } = parseMemosContent(memo, memoId);
    let rootId = beforeAnchor ? await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, beforeAnchor, "before", [
      {
        t: "t",
        v: memoId
      }
    ]) : null;
    if (!rootId) {
      rootId = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, inbox, "lastChild", [
        {
          t: "t",
          v: memoId
        }
      ]);
    }
    let noteBlock = orca.state.blocks[rootId] ?? null;
    if (!noteBlock) return false;
    await orca.commands.invokeEditorCommand("core.editor.setProperties", null, [
      rootId
    ], [
      {
        name: "ID",
        type: 1,
        value: memoId
      }
    ]);
    await orca.commands.invokeEditorCommand("core.editor.insertTag", null, rootId, noteTag, [
      {
        name: "ID",
        type: 1,
        value: memoId
      }
    ]);
    const titleId = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, noteBlock, "lastChild", [
      {
        t: "t",
        v: titleText
      }
    ]);
    if (!titleId) return false;
    if ((_c = memo.tags) == null ? void 0 : _c.length) {
      for (const tag of memo.tags) {
        await orca.commands.invokeEditorCommand("core.editor.insertTag", null, titleId, tag);
      }
    }
    await writeBody(titleId, bodyParas);
    noteBlock = orca.state.blocks[rootId] ?? noteBlock;
    const memoUrl = `${memosApiUrl.replace(/\/$/, "")}/memos/${memoId}`;
    await orca.commands.invokeEditorCommand(
      "core.editor.insertBlock",
      null,
      noteBlock,
      "lastChild",
      // t:"l" = 内联链接片段，v=显示文本，l=跳转URL
      [
        {
          t: "l",
          v: "🔗 Open in Memos",
          l: memoUrl
        }
      ]
    );
    if (oldRootId) {
      try {
        await orca.commands.invokeEditorCommand("core.editor.deleteBlocks", null, [
          oldRootId
        ]);
      } catch (e) {
        console.warn("MEMOS SYNC: 删除旧根块失败（将留下重复块）", oldRootId, e);
      }
    }
    return true;
  } catch (e) {
    console.error("MEMOS SYNC: syncMemo error for", memo.name, e);
    if (!lastSyncError) {
      lastSyncError = `${memo.name}: ${e instanceof Error ? e.message : String(e)}`;
    }
    return false;
  }
}
async function writeBody(titleId, bodyParas) {
  const titleBlock = orca.state.blocks[titleId];
  if (!titleBlock) return;
  const oldChildren = titleBlock.children ?? [];
  if (oldChildren.length) {
    await orca.commands.invokeEditorCommand("core.editor.deleteBlocks", null, oldChildren);
  }
  const specs = parseBlocks(bodyParas);
  let prev = null;
  for (const spec of specs) {
    const anchor = prev ? orca.state.blocks[prev] ?? orca.state.blocks[titleId] : orca.state.blocks[titleId];
    const position = prev ? "after" : "firstChild";
    if (!anchor) break;
    if (spec.kind === "quote") {
      const quoteId = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, anchor, position, null, {
        type: "quote2"
      });
      if (!quoteId) continue;
      const quoteBlock = orca.state.blocks[quoteId];
      if (quoteBlock) {
        for (const line of spec.lines) {
          await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, quoteBlock, "lastChild", line, {
            type: "text"
          });
        }
      }
      prev = quoteId;
      continue;
    }
    let content = null;
    let repr = {
      type: "text"
    };
    switch (spec.kind) {
      case "text":
        content = spec.content;
        repr = {
          type: "text"
        };
        break;
      case "ul":
        content = spec.content;
        repr = {
          type: "ul"
        };
        break;
      case "ol":
        content = spec.content;
        repr = {
          type: "ol"
        };
        break;
      case "heading":
        content = spec.content;
        repr = {
          type: "heading",
          level: spec.level
        };
        break;
      case "code":
        content = [
          {
            t: "t",
            v: spec.text
          }
        ];
        repr = {
          type: "code",
          lang: spec.lang,
          wrap: false
        };
        break;
      case "hr":
        content = null;
        repr = {
          type: "hr"
        };
        break;
      case "image":
        content = null;
        repr = {
          type: "image",
          src: spec.src
        };
        break;
    }
    const id = await orca.commands.invokeEditorCommand("core.editor.insertBlock", null, anchor, position, content, repr);
    if (id) prev = id;
  }
}
export {
  load,
  unload
};
