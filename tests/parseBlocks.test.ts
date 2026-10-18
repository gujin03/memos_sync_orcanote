/**
 * parseBlocks 回归测试（无需任何依赖）。
 *
 * 运行：npm test
 * 说明：放在 tests/ 而不是 src/，避免被 `tsc`（include: ["src"]）类型检查
 *       —— Node 的类型剥离只做语法擦除，不校验 node:assert 的类型定义。
 *
 * 这些用例对应实践中真实踩过的坑：
 *   1. 代码语言大小写（python → Python），否则 Orca 显示「请选择」
 *   2. `_斜体_` 的词边界，否则 my_var_name 被误判
 *   3. 「价格 > 100」不能被当成引用
 *   4. 引用要「一个容器 + 每行一个子块」
 *   5. 行内图片要独立成块（Orca 的 image 是块级 repr）
 */
import assert from "node:assert/strict"
import {
  normalizeLang,
  parseBlocks,
  parseInline,
} from "../src/parseBlocks.ts"

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`✔ ${name}`)
  } catch (e) {
    console.error(`✘ ${name}`)
    console.error(`   ${e instanceof Error ? e.message : String(e)}`)
    process.exitCode = 1
  }
}

// ---------- 语言规范化 ----------
test("语言：常见简写归一", () => {
  const cases: Array<[string, string]> = [
    ["python", "Python"],
    ["PYTHON", "Python"],
    ["py", "Python"],
    ["js", "JavaScript"],
    ["sh", "Shell"],
    ["cpp", "C++"],
    ["cs", "C#"],
    ["yml", "YAML"],
    ["txt", "Plain Text"],
    ["unknownLang", "unknownLang"], // 未识别原样保留
    ["", ""],
  ]
  for (const [input, want] of cases) {
    assert.equal(normalizeLang(input), want, `${input} → ${want}`)
  }
})

// ---------- 行内样式 ----------
test("行内：粗体 / 斜体 / 行内代码 / 链接", () => {
  assert.deepEqual(parseInline("**粗**"), [{ t: "t", v: "粗", f: "b" }])
  assert.deepEqual(parseInline("*斜*"), [{ t: "t", v: "斜", f: "i" }])
  assert.deepEqual(parseInline("`码`"), [{ t: "t", v: "码", f: "c" }])
  assert.deepEqual(parseInline("[词](https://a.com)"), [
    { t: "l", v: "词", l: "https://a.com" },
  ])
})

test("行内：下划线斜体需要词边界", () => {
  assert.deepEqual(parseInline("my_var_name"), [{ t: "t", v: "my_var_name" }])
  assert.deepEqual(parseInline("a_b_c"), [{ t: "t", v: "a_b_c" }])
  assert.deepEqual(parseInline("_斜_"), [{ t: "t", v: "斜", f: "i" }])
})

test("行内：混合片段顺序正确", () => {
  assert.deepEqual(parseInline("前**粗**后"), [
    { t: "t", v: "前" },
    { t: "t", v: "粗", f: "b" },
    { t: "t", v: "后" },
  ])
})

// ---------- 块级 ----------
test("块级：标题（含行内样式）", () => {
  assert.deepEqual(parseBlocks(["## **大**标题"]), [
    {
      kind: "heading",
      level: 2,
      content: [
        { t: "t", v: "大", f: "b" },
        { t: "t", v: "标题" },
      ],
    },
  ])
})

test("块级：列表每项一个块", () => {
  assert.deepEqual(parseBlocks(["- 项1", "- 项2"]), [
    { kind: "ul", content: [{ t: "t", v: "项1" }] },
    { kind: "ul", content: [{ t: "t", v: "项2" }] },
  ])
})

test("块级：代码围栏保留语言与空行", () => {
  assert.deepEqual(parseBlocks(["```python", "a", "", "b", "```"]), [
    { kind: "code", lang: "Python", text: "a\n\nb" },
  ])
})

test("块级：引用合并为一个容器、每行一个子块", () => {
  const got = parseBlocks(["> 一", "> 二"])
  assert.equal(got.length, 1)
  const spec = got[0] as any
  assert.equal(spec.kind, "quote")
  assert.equal(spec.lines.length, 2)
})

test("块级：价格 > 100 不当作引用", () => {
  assert.deepEqual(parseBlocks(["价格 > 100 元"]), [
    { kind: "text", content: [{ t: "t", v: "价格 > 100 元" }] },
  ])
})

test("块级：行内图片独立成块", () => {
  assert.deepEqual(parseBlocks(["前 ![a](u.png) 后"]), [
    { kind: "text", content: [{ t: "t", v: "前" }] },
    { kind: "image", src: "u.png" },
    { kind: "text", content: [{ t: "t", v: "后" }] },
  ])
})

test("块级：分隔线", () => {
  assert.deepEqual(parseBlocks(["---"]), [{ kind: "hr" }])
})

console.log(`\n通过 ${passed} 项`)
