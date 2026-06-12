# Orca Note 完整 API 参考

> 基于 `orca.d.ts` 类型声明整理。插件通过全局 `orca` 对象访问所有 API。

---

## 1. 核心入口 — `orca` 全局对象

| 属性 | 说明 |
|------|------|
| `orca.invokeBackend(type, ...args)` | 调用后端 API，所有底层数据操作都通过它 |
| `orca.state` | 应用全局响应式状态 |
| `orca.notify(type, msg, opts?)` | 在右下角显示通知 |

---

## 2. 应用状态 — `orca.state`

### 内容与数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `blocks` | `Record<DbId, Block>` | 内存中所有已加载的块（按 ID 索引） |
| `locale` | `string` | 当前语言（`"en"` / `"zh-CN"`） |
| `repo` | `string` | 当前仓库名 |
| `repoDir` | `string` | 仓库文件系统路径 |
| `dataDir` | `string` | 应用数据目录 |
| `settings` | `Record<number, any>` | 应用/仓库配置 |
| `themeMode` | `"light" \| "dark"` | 当前主题模式 |

### UI 状态

| 字段 | 说明 |
|------|------|
| `activePanel` | 当前焦点面板 ID |
| `panels` | 面板根结构（RowPanel） |
| `panelBackHistory` | 面板后退历史 |
| `panelForwardHistory` | 面板前进历史 |
| `notifications` | 当前通知列表 |
| `settingsOpened` | 设置面板是否打开 |
| `commandPaletteOpened` | 命令面板是否打开 |
| `globalSearchOpened` | 全局搜索是否打开 |
| `sidebarTab` | 当前侧边栏选项卡 |
| `filterInTags / filterInPages` | 过滤条件 |

### 注册表

| 字段 | 说明 |
|------|------|
| `commands` | 已注册的命令 |
| `plugins` | 已安装的插件 |
| `shortcuts` | 快捷键绑定 |
| `themes` | 已安装的主题 |
| `blockRenderers` | 块渲染器注册表 |
| `inlineRenderers` | 内联渲染器注册表 |
| `panelRenderers` | 面板渲染器注册表 |
| `blockConverters` | 块格式转换器 |
| `inlineConverters` | 内联格式转换器 |
| `headbarButtons` | 顶栏按钮 |
| `toolbarButtons` | 编辑工具栏按钮 |
| `slashCommands` | 斜杠命令 |
| `blockMenuCommands` | 块右键菜单命令 |
| `tagMenuCommands` | 标签右键菜单命令 |
| `editorSidetools` | 编辑器侧边工具 |

---

## 3. 命令系统 — `orca.commands`

| 方法 | 说明 |
|------|------|
| `registerCommand(id, fn, label)` | 注册普通命令 |
| `unregisterCommand(id)` | 注销命令 |
| `invokeCommand(id, ...args)` | 执行命令 |
| `registerEditorCommand(id, doFn, undoFn, opts)` | 注册编辑器命令（支持撤销） |
| `unregisterEditorCommand(id)` | 注销编辑器命令 |
| `invokeEditorCommand(id, cursor, ...args)` | 执行编辑器命令 |
| `invokeTopEditorCommand(...)` | 作为顶层命令执行 |
| `invokeGroup(callback, opts?)` | 将多个命令组合为一次撤销操作 |
| `registerBeforeCommand(id, pred)` | 注册命令前置钩子（可阻止执行） |
| `unregisterBeforeCommand(id, pred)` | 注销前置钩子 |
| `registerAfterCommand(id, fn)` | 注册命令后置钩子 |
| `unregisterAfterCommand(id, fn)` | 注销后置钩子 |

### 内置核心编辑器命令

| 命令 ID | 说明 |
|---------|------|
| `core.editor.insertBlock` | 插入块 |
| `core.editor.deleteBlocks` | 删除块 |
| `core.editor.insertTag` | 插入标签 |
| `core.editor.setProperties` | 设置块属性 |
| `core.editor.batchInsertHTML` | 批量插入 HTML 内容 |
| `core.editor.insertFragments` | 插入内容片段 |
| `core.editor.appendTo` | 追加内容 |
| `core.editor.wrapInCode` | 包裹为代码块 |
| `core.editor.wrapInFormula` | 包裹为公式块 |

---

## 4. 插件管理 — `orca.plugins`

### 生命周期

| 方法 | 说明 |
|------|------|
| `register(name)` / `unregister(name)` | 注册/注销插件 |
| `enable(name)` / `disable(name)` | 启用/禁用 |
| `load(name, schema, settings)` | 加载插件 |
| `unload(name)` | 卸载插件 |

### 配置

| 方法 | 说明 |
|------|------|
| `setSettingsSchema(name, schema)` | 设置配置项的 schema |
| `setSettings(to, name, settings)` | 设置配置（`"app"` / `"repo"`） |

**设置类型**: `string` / `number` / `boolean` / `date` / `time` / `datetime` / `dateRange` / `datetimeRange` / `color` / `singleChoice` / `multiChoices` / `array`

### 数据持久化

| 方法 | 说明 |
|------|------|
| `getDataKeys(name)` | 获取所有数据键名 |
| `getData(name, key)` | 获取存储数据 |
| `setData(name, key, value)` | 存储数据（string / number / ArrayBuffer） |
| `removeData(name, key)` / `clearData(name)` | 删除数据 |

### 文件 I/O（插件数据目录内）

| 方法 | 说明 |
|------|------|
| `readFile(name, path, type?)` | 读取文件 |
| `writeFile(name, path, data)` | 写入文件 |
| `removeFile(name, path)` | 删除文件 |
| `removeFolder(name, path)` | 删除文件夹 |
| `listFiles(name)` | 列出所有文件 |
| `existsFile(name, path)` | 检查文件是否存在 |

---

## 5. 导航与面板 — `orca.nav`

| 方法 | 说明 |
|------|------|
| `goTo(view, viewArgs?, panelId?)` | 导航到指定视图（`"journal"` / `"block"`） |
| `replace(view, viewArgs?, panelId?)` | 替换面板视图（不记录历史） |
| `openInLastPanel(view, viewArgs?)` | 在最后一个面板中打开 |
| `addTo(id, dir, src?)` | 在面板旁新增面板 |
| `move(from, to, dir)` | 移动面板 |
| `close(id)` / `closeAllBut(id)` | 关闭面板 |
| `changeSizes(startId, values)` | 调整面板尺寸 |
| `switchFocusTo(id)` / `focusNext()` / `focusPrev()` | 切换焦点 |
| `goBack(withRedo?)` / `goForward()` | 历史导航 |
| `findViewPanel(id, panels)` | 查找面板 |
| `isThereMoreThanOneViewPanel()` | 是否多面板 |

---

## 6. 快捷键 — `orca.shortcuts`

| 方法 | 说明 |
|------|------|
| `reload()` | 重新加载所有快捷键 |
| `assign(shortcut, command)` | 为命令绑定快捷键 |
| `reset(command)` | 重置为默认快捷键 |

---

## 7. 主题与样式 — `orca.themes`

| 方法 | 说明 |
|------|------|
| `register(pluginName, themeName, cssFile)` | 注册主题 |
| `unregister(themeName)` | 注销主题 |
| `injectCSSResource(url, role)` | 注入 CSS 文件 |
| `removeCSSResources(role)` | 移除注入的 CSS |
| `injectCSS(css, role)` | 直接注入 CSS 字符串 |
| `removeCSS(role)` | 移除注入的 CSS |

---

## 8. 渲染器 — `orca.renderers`

| 方法 | 说明 |
|------|------|
| `registerInline(type, isEditable, renderer)` | 注册内联渲染器 |
| `unregisterInline(type)` | 注销内联渲染器 |
| `registerBlock(type, isEditable, renderer, assetFields?, useChildren?)` | 注册自定义块渲染器 |
| `unregisterBlock(type)` | 注销块渲染器 |

---

## 9. 面板渲染器 — `orca.panels`

| 方法 | 说明 |
|------|------|
| `registerPanel(type, renderer)` | 注册自定义面板类型 |
| `unregisterPanel(type)` | 注销自定义面板 |

---

## 10. 格式转换器 — `orca.converters`

| 方法 | 说明 |
|------|------|
| `registerBlock(format, type, fn)` | 注册块转换器（HTML / Markdown / Plain） |
| `registerInline(format, type, fn)` | 注册内联内容转换器 |
| `unregisterBlock(format, type)` | 注销块转换器 |
| `unregisterInline(format, type)` | 注销内联转换器 |
| `blockConvert(format, ...)` | 执行块转换 |
| `inlineConvert(format, ...)` | 执行内联内容转换 |

---

## 11. 事件广播 — `orca.broadcasts`

| 方法 | 说明 |
|------|------|
| `isHandlerRegistered(type)` | 检查是否有处理器 |
| `registerHandler(type, handler)` | 注册广播处理器 |
| `unregisterHandler(type, handler)` | 注销处理器 |
| `broadcast(type, ...args)` | 发送广播事件 |

---

## 12. UI 扩展注册点

所有扩展 API 都有配套的 `unregister*` 方法用于卸载。

| API | 说明 |
|-----|------|
| `orca.headbar.registerHeadbarButton(id, render)` | 顶栏自定义按钮 |
| `orca.toolbar.registerToolbarButton(id, btn)` | 编辑器工具栏按钮 |
| `orca.slashCommands.registerSlashCommand(id, cmd)` | 斜杠命令（`/` 菜单） |
| `orca.blockMenuCommands.registerBlockMenuCommand(id, cmd)` | 块右键菜单命令 |
| `orca.tagMenuCommands.registerTagMenuCommand(id, cmd)` | 标签右键菜单命令 |
| `orca.editorSidetools.registerEditorSidetool(id, tool)` | 编辑器侧边工具 |

---

## 13. UI 组件 — `orca.components`

| 组件 | 用途 |
|------|------|
| `Button` | 按钮（solid / soft / dangerous / outline / plain） |
| `Tooltip` | 工具提示（支持快捷键、图片预览） |
| `Select` | 下拉选择（多选、搜索、分组） |
| `Input` / `CompositionInput` / `CompositionTextArea` | 输入框 |
| `Switch` | 开关 |
| `Checkbox` | 复选框 |
| `DatePicker` | 日期/时间/范围选择器 |
| `Menu` / `MenuItem` / `MenuText` / `MenuTitle` / `MenuSeparator` | 菜单系统 |
| `ContextMenu` / `HoverContextMenu` | 右键/悬停菜单 |
| `Popup` | 弹出面板 |
| `ModalOverlay` | 模态弹窗 |
| `ConfirmBox` | 确认对话框 |
| `InputBox` | 输入对话框 |
| `TagPopup` | 标签选择/创建弹出 |
| `AliasEditor` | 别名编辑 |
| `TagPropsEditor` | 标签属性编辑 |
| `Block` / `BlockShell` / `BlockChildren` / `BlockBreadcrumb` | 块渲染 |
| `BlockSelect` | 块选择器 |
| `BlockPreviewPopup` | 块预览悬停弹窗 |
| `Table` | 数据表格（可调列宽、固定列） |
| `Segmented` | 分段选择器 |
| `Image` | 图片（含加载状态） |
| `Skeleton` | 骨架屏加载占位 |
| `MemoizedViews` | 视图切换容器 |
| `Breadcrumb` | 面包屑导航 |
| `LoadMore` | 分页加载更多 |
| `QueryConditionsBuilder` | 复杂查询条件构建器 |

### React Context

| Context | 说明 |
|---------|------|
| `orca.contexts.ImageViewerContext` | 图片查看器（`viewImages(urls, thumbnail)`） |

---

## 14. 工具函数 — `orca.utils`

| 方法 | 说明 |
|------|------|
| `getCursorDataFromSelection(selection)` | DOM Selection → CursorData |
| `getCursorDataFromRange(range)` | DOM Range → CursorData |
| `setSelectionFromCursorData(cursorData)` | 设置编辑器选区 |
| `getAssetPath(assetPath)` | 解析资源的绝对路径 |
| `showBlockPreview(blockId, refElement?, rect?, interactive?)` | 显示块预览弹窗 |

---

## 15. 后端 API — `orca.invokeBackend`

```typescript
await orca.invokeBackend(type, ...args)
```

| 消息类型 | 说明 |
|---------|------|
| `"get-block"` | 获取单个块 |
| `"get-blocks"` | 批量获取块 |
| `"get-block-tree"` | 获取块及其子树 |
| `"get-block-by-alias"` / `"get-blockid-by-alias"` | 通过别名获取块 |
| `"get-journal-block"` | 获取指定日期的日记块 |
| `"get-aliases"` / `"get-aliased-blocks"` | 获取别名 |
| `"get-blocks-with-tags"` | 获取带特定标签的块 |
| `"get-children-tags"` | 获取标签的子标签 |
| `"get-remindings"` | 获取日期范围内的提醒 |
| `"query"` | 复杂查询（支持多条件组合） |
| `"search-blocks-by-text"` | 全文搜索 |
| `"search-aliases"` | 搜索别名 |
| `"upload-asset-binary"` / `"upload-assets"` | 上传资源文件 |
| `"export-png"` | 导出块为 PNG |
| `"set-app-config"` / `"set-config"` | 设置配置 |
| `"shell-open"` | 系统默认程序打开文件/URL |
| `"show-in-folder"` | 在文件管理器中显示 |
| `"image-ocr"` | 图片 OCR |
| `"change-tag-property-choice"` | 修改标签属性值 |

### 查询系统

```typescript
await orca.invokeBackend("query", {
  q: { kind, conditions: [...] },
  pageSize: number,
  pageToken?: string,
  orderBy?: string,
} as QueryDescription)
```

#### 查询条件种类（`kind`）

| Kind | 名称 | 说明 |
|------|------|------|
| 0 | `Root` | 根节点（AND 容器） |
| 1 | `And` | AND |
| 2 | `Or` | OR |
| 3 | `Journal` | 日记日期条件 |
| 4 | `Tag` | 标签条件（支持属性匹配） |
| 5 | `NoTag` | 不含某标签 |
| 6 | `Ref` | 引用条件 |
| 7 | `NoRef` | 未引用 |
| 8 | `Text` | 文本内容匹配 |
| 9 | `Block` | 块引用条件 |
| 10 | `NoText` | 文本内容不匹配 |
| 11 | `Task` | 任务状态 |
| 12 | `BlockMatch` | 块匹配 |
| 13 | `Format` | 格式条件 |

#### 比较操作符（`op`）

| Op | 名称 | 说明 |
|----|------|------|
| 1 | `Eq` | 等于 |
| 2 | `NotEq` | 不等于 |
| 3 | `Includes` | 包含 |
| 4 | `NotIncludes` | 不包含 |
| 5 | `Has` | 有值 |
| 6 | `NotHas` | 无值 |
| 7 | `Gt` | 大于 |
| 8 | `Lt` | 小于 |
| 9 | `Ge` | 大于等于 |
| 10 | `Le` | 小于等于 |
| 11 | `Null` | 为空 |
| 12 | `NotNull` | 不为空 |

---

## 16. 核心数据结构

### Block

```typescript
interface Block {
  id: DbId
  content: ContentFragment[]
  text: string
  created: number
  modified: number
  parent: DbId
  left: DbId
  children: DbId[]
  aliases: string[]
  properties: BlockProperty[]
  refs: BlockRef[]
  backRefs: BlockRef[]
}
```

### ContentFragment

```typescript
interface ContentFragment {
  t: string          // 类型（text / bold / italic / link / highlight / tag 等）
  v: string          // 值
  f?: string         // 格式（如 color / fontSize）
  fa?: any           // 格式参数
}
```

### BlockProperty

```typescript
interface BlockProperty {
  name: string
  type: number
  typeArgs?: any
  value: any
  pos: number
}
```

### BlockRef

```typescript
interface BlockRef {
  id: DbId
  from: number
  to: number
  type: string
  alias?: string
  data?: any[]
}
```

### Repr

```typescript
interface Repr {
  type: string            // "text" / "code" / "heading" / "bullet" / "todo" / "numbered" / "quote" / "divider"
}
```

### CursorData

```typescript
interface CursorData {
  anchor: { blockId: DbId; offset: number }
  focus: { blockId: DbId; offset: number }
  isForward: boolean
  panelId?: string
  rootBlockId?: DbId
}
```

---

## 17. 插件典型生命周期

```typescript
export async function load(pluginName: string) {
  // 1. 注册配置
  await orca.plugins.setSettingsSchema(pluginName, { ... })

  // 2. 注入 CSS
  orca.themes.injectCSSResource(`${pluginName}/dist/main.css`, pluginName)

  // 3. 注册命令
  orca.commands.registerCommand("myplugin.action", myAction, "My Action")

  // 4. 注册 UI 扩展
  orca.headbar.registerHeadbarButton("myplugin.button", () => <Button>...</Button>)
}

export async function unload(pluginName: string) {
  // 清理：反注册所有注册的资源
  orca.headbar.unregisterHeadbarButton("myplugin.button")
  orca.commands.unregisterCommand("myplugin.action")
  orca.themes.removeCSSResources(pluginName)
}
```

---

## 18. MCP 协议层（外部程序调用 Orca Note）

Orca Note 在本地运行了一个 **MCP（Model Context Protocol）服务**，允许外部程序通过 HTTP 与 Orca Note 交互。

### 连接信息

| 属性 | 值 |
|------|----|
| 端点 | `http://localhost:18672/mcp` |
| 传输模式 | Streamable HTTP（非 SSE） |
| 认证 | Bearer Token |
| 请求头 | `Authorization: Bearer <token>` |
| | `Content-Type: application/json` |
| | `Accept: application/json` |

### 可用 MCP 工具

| 工具 | 功能 | 对应插件内部 API |
|------|------|----------------|
| `query_blocks` | 结构化搜索块（文本/标签/日期/任务组合条件） | `orca.invokeBackend("query", ...)` |
| `get_blocks_text` | 获取块及其后代的纯文本内容 | `orca.state.blocks[id].text` |
| `get_tags_and_pages` | 分页列举所有标签和页面 | 无直接对应 |
| `get_journal` | 获取或创建指定日期的日记块 | `orca.invokeBackend("get-journal-block", ...)` |
| `get_page` | 根据块 ID 定位所属页面 | 无直接对应 |
| `insert_markdown` | 在指定位置插入 Markdown 内容 | `invokeEditorCommand("core.editor.batchInsertHTML", ...)` |
| `insert_tags` | 为块附加标签（含属性值） | `invokeEditorCommand("core.editor.insertTag", ...)` |
| `create_tags` | 创建标签定义 | 无直接对应 |
| `create_page` | 创建新页面 | 无直接对应 |
| `remove_tags` | 移除块上的标签 | `invokeEditorCommand("core.editor.setProperties", _tags=[])` |
| `move_blocks` | 将块移到新的父块下 | `invokeEditorCommand("core.editor.moveBlock", ...)` |
| `delete_blocks` | 按 ID 删除块 | `invokeEditorCommand("core.editor.deleteBlocks", ...)` |
| `parse_datetime` | 解析自然语言日期时间 | 无直接对应 |

### MCP 调用示例

```sh
# 列举所有标签和页面
curl -X POST http://localhost:18672/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_tags_and_pages",
      "arguments": { "repoId": "my-repo" }
    }
  }'

# 插入 Markdown 到指定块下
curl -X POST http://localhost:18672/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "insert_markdown",
      "arguments": {
        "repoId": "my-repo",
        "parentBlockId": 12345,
        "position": "firstChild",
        "markdown": "# Hello\n This is **bold** text."
      }
    }
  }'
```

### 与插件内部 API 的关系

```
┌────────────────────────────────────────────┐
│                Orca Note App                │
│                                            │
│  ┌──────────────────────────────────┐      │
│  │ 插件系统 (orca 全局 API)          │      │
│  │ ▸ 插件内部直接调用 orca.xxx      │      │
│  │ ▸ 有完整访问权限                 │      │
│  └──────────────────────────────────┘      │
│                                            │
│  ┌──────────────────────────────────┐      │
│  │ MCP 服务 (:18672/mcp)            │      │
│  │ ▸ 外部程序通过 HTTP 调用          │      │
│  │ ▸ 功能子集（常见 CRUD 操作）      │      │
│  │ ▸ 需 Token 认证                  │      │
│  └──────────────────────────────────┘      │
└────────────────────────────────────────────┘
```

### 适用场景对比

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 开发 Orca Note 插件 | `orca` 全局 API | 完整权限、无需 HTTP 开销、实时响应式状态 |
| 外部脚本/CLI 工具操作 | MCP 协议 | 无需在 Orca Note 内运行，语言无关 |
| 自动化工作流（cron/she'11） | MCP 协议 | 可脱离 Orca Note 界面独立执行 |
| 批量数据导入导出 | MCP 协议 | 适合外部 ETL 流程 |
