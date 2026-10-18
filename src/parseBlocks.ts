/**
 * 块级 Markdown 解析（纯函数，无 orca 依赖，可离线测试）。
 *
 * 目的：把 Memos 正文段落解析成「块规格」，再由 writeBody 用**已验证的**
 * `core.editor.insertBlock(anchor, position, content, repr)` 渲染。
 *
 * 依据 2026-10-18 实测的 repr 形态（block 37841 子树）：
 *   text      {"type":"text"}
 *   quote2    {"type":"quote2"}                        容器，正文在子块
 *   ul        {"type":"ul"}                            内联，每项一个块
 *   code      {"type":"code","lang":"Python","wrap":false}  内联
 *   heading   {"type":"heading","level":N}             内联
 *
 * 设计取舍：
 * - 只做**块级**语法（标题/列表/代码/分隔线/引用）。内联样式（粗体/链接）不在本层，
 *   需要 inline fragments 或 HTML 通道（见方案 M4 的已知阻塞）。
 * - 列表按 Memos 的逐行形态解析：每行一个 ul/ol 块（Orca 本身就是每项一个块）。
 */

export type BlockSpec =
  | { kind: "text"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul"; text: string }
  | { kind: "ol"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; lang: string; text: string }
  | { kind: "hr" }

/** 段首引用标记，可重复（`>> `） */
const QUOTE_LINE_RE = /^(?:>\s*)+/
/**
 * 行内引用切分：Memos 正文里「他说： > 这句话」这种引用被软换行压平到同一段。
 * 切点放在 `>` 本身，前方标点保留在文本段。
 */
const INLINE_QUOTE_RE = /[：:。；;，,、]\s*>+\s*/
const FENCE_RE = /^(`{3,}|~{3,})\s*(\S*)\s*$/
const HEADING_RE = /^(#{1,6})\s+(.+)$/
const UL_RE = /^[-*+]\s+(.+)$/
const OL_RE = /^\d+[.)]\s+(.+)$/
const HR_RE = /^(?:-{3,}|\*{3,}|_{3,})$/

/**
 * Orca 的代码块语言注册表（从 app.asar 的 `LanguageDescription.of({name:…})` 提取，145 项）。
 * ⚠️ 关键：Orca 语言选择器按 **name 精确匹配**（大小写敏感），
 *    Markdown 围栏里写 `python` 而 name 是 `Python` 时，界面会显示「请选择」。
 *    实测：同步后 `_repr={"type":"code","lang":"python"}` → 编辑器识别不到语言。
 */
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
]

/** 常见 Markdown 围栏简写 → Orca 规范名（仅覆盖高频项，其余走规范名兜底） */
const LANG_ALIASES: Record<string, string> = {
  "py": "Python",
  "python3": "Python",
  "py3": "Python",
  "ipython": "Python",
  "jupyter": "Python",
  "js": "JavaScript",
  "javascript": "JavaScript",
  "node": "JavaScript",
  "nodejs": "JavaScript",
  "mjs": "JavaScript",
  "cjs": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "sh": "Shell",
  "bash": "Shell",
  "shell": "Shell",
  "zsh": "Shell",
  "console": "Shell",
  "shell-session": "Shell",
  "yml": "YAML",
  "yaml": "YAML",
  "htm": "HTML",
  "html": "HTML",
  "xhtml": "HTML",
  "md": "Markdown",
  "markdown": "Markdown",
  "cpp": "C++",
  "c++": "C++",
  "cc": "C++",
  "cxx": "C++",
  "hpp": "C++",
  "c": "C",
  "h": "C",
  "cs": "C#",
  "csharp": "C#",
  "c#": "C#",
  "rs": "Rust",
  "rust": "Rust",
  "golang": "Go",
  "go": "Go",
  "kt": "Kotlin",
  "kts": "Kotlin",
  "rb": "Ruby",
  "ruby": "Ruby",
  "pl": "Perl",
  "perl": "Perl",
  "ps1": "PowerShell",
  "powershell": "PowerShell",
  "pwsh": "PowerShell",
  "dockerfile": "Dockerfile",
  "docker": "Dockerfile",
  "ini": "Properties files",
  "properties": "Properties files",
  "txt": "Plain Text",
  "text": "Plain Text",
  "plaintext": "Plain Text",
  "plain": "Plain Text",
  "objc": "Objective-C",
  "objective-c": "Objective-C",
  "objective-c++": "Objective-C++",
  "mysql": "MySQL",
  "pgsql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "sqlite": "SQLite",
  "sqlite3": "SQLite",
  "mssql": "MS SQL",
  "plsql": "PLSQL",
  "mariadb": "MariaDB SQL",
  "proto": "ProtoBuf",
  "protobuf": "ProtoBuf",
  "tex": "LaTeX",
  "latex": "LaTeX",
  "diff": "diff",
  "patch": "diff",
  "vb": "VB.NET",
  "vbnet": "VB.NET",
  "vbs": "VBScript",
  "json5": "JSON",
  "jsonc": "JSON",
  "scss": "SCSS",
  "sass": "Sass",
  "less": "LESS",
  "stylus": "Stylus",
  "clj": "Clojure",
  "cljs": "ClojureScript",
  "hs": "Haskell",
  "erl": "Erlang",
  "ex": "Elixir",
  "rs1": "Rust",
  "r": "R",
  "jl": "Julia",
  "dart": "Dart",
  "lua": "Lua",
  "scala": "Scala",
  "fs": "F#",
  "fsharp": "F#",
  "vue": "Vue",
  "jsx": "JSX",
  "tsx": "TSX",
  "toml": "TOML",
  "xml": "XML",
  "graphql": "Plain Text"
}

const LANG_BY_LOWER = new Map<string, string>(
  ORCA_LANG_NAMES.map((n) => [n.toLowerCase(), n]),
)

/** 把围栏语言标记规范化为 Orca 能识别的 name；未识别则原样返回（保留信息，不丢） */
export function normalizeLang(raw: string): string {
  const key = (raw ?? "").trim()
  if (!key) return ""
  const lower = key.toLowerCase()
  const byName = LANG_BY_LOWER.get(lower)
  if (byName) return byName
  const byAlias = LANG_ALIASES[lower]
  if (byAlias) return byAlias
  return key
}

export function stripQuotePrefix(s: string): string {
  return s.replace(QUOTE_LINE_RE, "").trim()
}

export function isQuoteLine(s: string): boolean {
  return s.startsWith(">")
}

/** 标题用：剥掉引用前缀与标题井号（首段若写成 `# 标题`，标题不应带 `#`） */
export function stripBlockPrefix(s: string): string {
  return stripQuotePrefix(s)
    .replace(/^#{1,6}\s+/, "")
    .trim()
}

/**
 * 把一段文字按「标点 + `>`」切成 文本/引用 片段。
 * 说明：扁平化后的段落里，引用之后的叙述无法与引用本身区分，
 * 因此按「引用持续到下一个 `>` 之前」处理（保真但不精确）。
 */
export function splitInlineQuotes(para: string): Array<{
  quote: boolean
  text: string
}> {
  const out: Array<{ quote: boolean; text: string }> = []
  let rest = para
  let quoteMode = false

  while (true) {
    const m = INLINE_QUOTE_RE.exec(rest)
    if (!m) break
    const gt = m.index + m[0].lastIndexOf(">")
    const head = rest.slice(0, gt).trim()
    if (head) out.push({ quote: quoteMode, text: head })
    rest = rest.slice(gt + 1).trim()
    quoteMode = true
    if (!INLINE_QUOTE_RE.test(rest)) break
  }
  if (rest.trim()) out.push({ quote: quoteMode, text: rest.trim() })
  return out.length ? out : [{ quote: false, text: para }]
}

/** 主解析：段落 → 块规格序列 */
export function parseBlocks(paras: string[]): BlockSpec[] {
  const out: BlockSpec[] = []
  let i = 0

  while (i < paras.length) {
    const line = (paras[i] ?? "").trim()
    if (!line) {
      i++
      continue
    }

    // 1) 代码围栏（内部原样保留空行与缩进，只有首尾 trimmed）
    const fence = FENCE_RE.exec(line)
    if (fence) {
      const marker = fence[1][0]
      const lang = (fence[2] ?? "").trim()
      const buf: string[] = []
      i++
      while (i < paras.length) {
        const cur = paras[i] ?? ""
        const close = FENCE_RE.exec(cur.trim())
        if (close && close[1][0] === marker) {
          i++
          break
        }
        buf.push(cur.replace(/\s+$/, ""))
        i++
      }
      out.push({ kind: "code", lang: normalizeLang(lang), text: buf.join("\n") })
      continue
    }

    // 2) 分隔线
    if (HR_RE.test(line)) {
      out.push({ kind: "hr" })
      i++
      continue
    }

    // 3) 标题
    const heading = HEADING_RE.exec(line)
    if (heading) {
      out.push({
        kind: "heading",
        level: Math.min(heading[1].length, 6),
        text: heading[2].trim(),
      })
      i++
      continue
    }

    // 4) 无序列表
    const ul = UL_RE.exec(line)
    if (ul) {
      out.push({ kind: "ul", text: ul[1].trim() })
      i++
      continue
    }

    // 5) 有序列表
    const ol = OL_RE.exec(line)
    if (ol) {
      out.push({ kind: "ol", text: ol[1].trim() })
      i++
      continue
    }

    // 6) 块首引用：连续引用行合并为同一个容器、每行一个子块
    if (isQuoteLine(line)) {
      const lines: string[] = []
      while (i < paras.length && isQuoteLine((paras[i] ?? "").trim())) {
        const t = stripQuotePrefix((paras[i] ?? "").trim())
        if (t) lines.push(t)
        i++
      }
      if (lines.length) out.push({ kind: "quote", lines })
      continue
    }

    // 7) 普通段落：可能含行内引用，需要再切
    for (const seg of splitInlineQuotes(line)) {
      const text = seg.text.trim()
      if (!text) continue
      out.push(seg.quote ? { kind: "quote", lines: [text] } : { kind: "text", text })
    }
    i++
  }

  return out
}
