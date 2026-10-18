/**
 * 块级 + 行内 Markdown 解析（纯函数，无 orca 依赖，可离线测试）。
 *
 * 依据 2026-10-18 实测（DB + app.asar）：
 *   块级 repr：text / quote2(容器) / ul / ol / heading(level) / code(lang,wrap) / hr / image(src)
 *   行内片段：{t:"t", v:"文字"}、加粗 f:"b"、行内代码 f:"c"、斜体 f:"i"、
 *            链接 {t:"l", v:"显示文本", l:"url"}（`f` 可组合，如 f:"b+c"）
 *
 * 因此行内样式**不需要** HTML 通道（batchInsertHTML），直接用片段构造即可。
 */

/** 行内片段（对齐 Orca 的 ContentFragment，只声明用到的字段） */
export type Fragment =
  | { t: "t"; v: string; f?: string }
  | { t: "l"; v: string; l: string }

export type BlockSpec =
  | { kind: "text"; content: Fragment[] }
  | { kind: "quote"; lines: Fragment[][] }
  | { kind: "ul"; content: Fragment[] }
  | { kind: "ol"; content: Fragment[] }
  | { kind: "heading"; level: number; content: Fragment[] }
  | { kind: "code"; lang: string; text: string }
  | { kind: "hr" }
  | { kind: "image"; src: string }

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
/** 行内图片：`![alt](url)` —— 单独成块（Orca 的 image 是块级 repr） */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g
/** 行内样式：链接 / 行内代码 / 粗体 / 斜体（顺序即优先级，`**` 必须在 `*` 之前） */
const INLINE_RE =
  /\[([^\]]*)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|(?<![\w])_([^_]+)_(?![\w])/g

/**
 * Orca 的代码块语言注册表（从 app.asar 的 `LanguageDescription.of({name:…})` 提取）。
 * ⚠️ 关键：Orca 语言选择器按 **name 精确匹配**（大小写敏感），
 *    Markdown 围栏里写 `python` 而 name 是 `Python` 时，界面会显示「请选择」。
 */
const ORCA_LANG_NAMES = [
  "APL", "ASN.1", "Asterisk", "Brainfuck", "C", "C#", "C++", "CMake", "CQL", "CSS",
  "Clojure", "ClojureScript", "Cobol", "CoffeeScript", "Common Lisp", "Crystal",
  "Cypher", "Cython", "D", "DTD", "Dart", "Dockerfile", "Dylan", "EBNF", "ECL",
  "Eiffel", "Elm", "Erlang", "Esper", "F#", "FCL", "Factor", "Forth", "Fortran",
  "Gas", "Gherkin", "Go", "Groovy", "HTML", "HTTP", "HXML", "Haskell", "Haxe",
  "IDL", "JSON", "JSON-LD", "JSX", "Java", "JavaScript", "Jinja2", "Julia",
  "Kotlin", "LESS", "LaTeX", "Liquid", "LiveScript", "Lua", "MS SQL", "MUMPS",
  "MariaDB SQL", "Markdown", "Mathematica", "Mbox", "Modelica", "MsGenny",
  "MscGen", "MySQL", "NSIS", "NTriples", "Nginx", "OCaml", "Objective-C",
  "Objective-C++", "Octave", "Oz", "PGP", "PHP", "PLSQL", "Pascal", "Perl", "Pig",
  "Plain Text", "PostgreSQL", "PowerShell", "Properties files", "ProtoBuf", "Pug",
  "Puppet", "Python", "Q", "R", "RPM Changes", "RPM Spec", "Ruby", "Rust", "SAS",
  "SCSS", "SML", "SPARQL", "SQL", "SQLite", "Sass", "Scala", "Scheme", "Shell",
  "Sieve", "Smalltalk", "Solr", "Spreadsheet", "Squirrel", "Stata", "Stylus",
  "Swift", "SystemVerilog", "TOML", "TSX", "TTCN", "TTCN_CFG", "Tcl", "Textile",
  "TiddlyWiki", "Tiki wiki", "Troff", "Turtle", "TypeScript", "VB.NET", "VBScript",
  "VHDL", "Velocity", "Verilog", "Vue", "Web IDL", "WebAssembly", "XML", "XQuery",
  "YAML", "Yacas", "Z80", "diff", "edn", "mIRC", "sTeX",
]

/** 常见 Markdown 围栏简写 → Orca 规范名（未覆盖的走规范名兜底） */
const LANG_ALIASES: Record<string, string> = {
  py: "Python", python3: "Python", py3: "Python", ipython: "Python",
  js: "JavaScript", javascript: "JavaScript", node: "JavaScript", nodejs: "JavaScript",
  mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript",
  sh: "Shell", bash: "Shell", shell: "Shell", zsh: "Shell", console: "Shell",
  "shell-session": "Shell",
  yml: "YAML", yaml: "YAML",
  htm: "HTML", html: "HTML", xhtml: "HTML",
  md: "Markdown", markdown: "Markdown",
  cpp: "C++", "c++": "C++", cc: "C++", cxx: "C++", hpp: "C++",
  c: "C", h: "C",
  cs: "C#", csharp: "C#", "c#": "C#",
  rs: "Rust", rust: "Rust",
  golang: "Go", go: "Go",
  kt: "Kotlin", kts: "Kotlin",
  rb: "Ruby", ruby: "Ruby",
  pl: "Perl", perl: "Perl",
  ps1: "PowerShell", powershell: "PowerShell", pwsh: "PowerShell",
  dockerfile: "Dockerfile", docker: "Dockerfile",
  ini: "Properties files", properties: "Properties files",
  txt: "Plain Text", text: "Plain Text", plaintext: "Plain Text", plain: "Plain Text",
  objc: "Objective-C", "objective-c": "Objective-C", "objective-c++": "Objective-C++",
  mysql: "MySQL", pgsql: "PostgreSQL", postgres: "PostgreSQL", postgresql: "PostgreSQL",
  sqlite: "SQLite", sqlite3: "SQLite", mssql: "MS SQL", plsql: "PLSQL",
  mariadb: "MariaDB SQL",
  proto: "ProtoBuf", protobuf: "ProtoBuf",
  tex: "LaTeX", latex: "LaTeX",
  diff: "diff", patch: "diff",
  vb: "VB.NET", vbnet: "VB.NET", vbs: "VBScript",
  json5: "JSON", jsonc: "JSON",
  scss: "SCSS", sass: "Sass", less: "LESS", stylus: "Stylus",
  clj: "Clojure", cljs: "ClojureScript", hs: "Haskell", erl: "Erlang",
  jl: "Julia", dart: "Dart", lua: "Lua", scala: "Scala", fs: "F#", fsharp: "F#",
  vue: "Vue", jsx: "JSX", tsx: "TSX", toml: "TOML", xml: "XML",
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

/** 标题用：剥掉引用前缀与标题井号 */
export function stripBlockPrefix(s: string): string {
  return stripQuotePrefix(s)
    .replace(/^#{1,6}\s+/, "")
    .trim()
}

/** 行内解析：粗体 / 斜体 / 行内代码 / 链接 → Orca 片段 */
export function parseInline(text: string): Fragment[] {
  const out: Fragment[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ t: "t", v: text.slice(last, m.index) })
    if (m[1] !== undefined) {
      out.push({ t: "l", v: m[1] || m[2], l: m[2] })
    } else if (m[3] !== undefined) {
      out.push({ t: "t", v: m[3], f: "c" })
    } else if (m[4] !== undefined) {
      out.push({ t: "t", v: m[4], f: "b" })
    } else if (m[5] !== undefined) {
      out.push({ t: "t", v: m[5], f: "i" })
    } else if (m[6] !== undefined) {
      out.push({ t: "t", v: m[6], f: "i" })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: "t", v: text.slice(last) })
  return out.filter((f) => f.v !== "" || f.t === "l")
}

/** 片段 → 纯文本（标题用） */
export function fragmentsToText(frags: Fragment[]): string {
  return frags.map((f) => f.v).join("")
}

/** 把一行按行内图片切开（图片单独成块） */
export function splitImages(
  line: string,
): Array<{ kind: "text" | "image"; value: string }> {
  const out: Array<{ kind: "text" | "image"; value: string }> = []
  let last = 0
  let m: RegExpExecArray | null
  IMAGE_RE.lastIndex = 0
  while ((m = IMAGE_RE.exec(line)) !== null) {
    if (m.index > last) out.push({ kind: "text", value: line.slice(last, m.index) })
    out.push({ kind: "image", value: m[2] })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ kind: "text", value: line.slice(last) })
  return out.length ? out : [{ kind: "text", value: line }]
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

    // 1) 代码围栏（内部原样保留空行与缩进，不做行内解析）
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
        content: parseInline(heading[2].trim()),
      })
      i++
      continue
    }

    // 4) 无序列表
    const ul = UL_RE.exec(line)
    if (ul) {
      out.push({ kind: "ul", content: parseInline(ul[1].trim()) })
      i++
      continue
    }

    // 5) 有序列表
    const ol = OL_RE.exec(line)
    if (ol) {
      out.push({ kind: "ol", content: parseInline(ol[1].trim()) })
      i++
      continue
    }

    // 6) 块首引用：连续引用行合并为同一个容器、每行一个子块
    if (isQuoteLine(line)) {
      const lines: Fragment[][] = []
      while (i < paras.length && isQuoteLine((paras[i] ?? "").trim())) {
        const t = stripQuotePrefix((paras[i] ?? "").trim())
        if (t) lines.push(parseInline(t))
        i++
      }
      if (lines.length) out.push({ kind: "quote", lines })
      continue
    }

    // 7) 普通段落：先切行内图片，再切行内引用，最后解析行内样式
    for (const part of splitImages(line)) {
      if (part.kind === "image") {
        out.push({ kind: "image", src: part.value })
        continue
      }
      const textPart = part.value.trim()
      if (!textPart) continue
      for (const seg of splitInlineQuotes(textPart)) {
        const t = seg.text.trim()
        if (!t) continue
        const content = parseInline(t)
        if (!content.length) continue
        out.push(
          seg.quote
            ? { kind: "quote", lines: [content] }
            : { kind: "text", content },
        )
      }
    }
    i++
  }

  return out
}
