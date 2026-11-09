# 更新说明 / Changelog

## v1.2.1（2026-11-09）

### 兼容性：支持 Memos 26.x（已用 26.11.0 验证）

Memos 在 26.x 移除了 `/api/v1/` 前缀，旧路径 `/api/v1/memos` 直接返回 **410 Gone**，导致插件同步全部失败。本次更新适配 26.x：

- **API 路径**：`/api/v1/memos` → **`/api/memos`**（两处列表拉取：`fetchAllMemoIds`、`fetchMemos`）。
- **`visibility` 类型**：26.x 返回字符串枚举（`"PUBLIC"` / `"PROTECTED"` / `"PRIVATE"`），v0.31 为数字。接口声明改为 `string | number`（插件内部并未把 `visibility` 用于逻辑，仅为类型准确）。

### 已逐项验证（对线上 26.11.0 实测）

以下在 26.x 下**保持兼容、无需改动**，已确认：

| 能力 | 26.x 实测结果 |
|---|---|
| 列表响应字段 `name` / `content` / `createTime` / `updateTime` / `tags` | 字段名与类型不变（`name` 仍为 `memos/<id>`，时间仍为 ISO 8601 字符串）|
| 分页 `nextPageToken` + `pageToken` 回传 | 正常（不同页返回不同 memo）|
| 服务端过滤 CEL：`created_ts >= timestamp(...)`、`updated_ts >= timestamp(...)`、`visibility in [...]` | 仍支持（HTTP 200）|
| `orderBy=create_time desc` | 仍支持 |
| Bearer Token 鉴权（`Authorization: Bearer <token>`）| 仍接受 |
| 网页溯源链接 `/memos/<id>` | 26.x 仍返回 200，无需改动 |

### ⚠️ 兼容性说明

本版本**仅适配 Memos ≥ 26.x**。若仍连接 v0.31 实例，请继续使用 v1.2.0（v0.31 仅提供 `/api/v1/memos`）。
如需同一份代码同时兼容新旧两版，可后续增加「新版路径 410 时回退 `/api/v1`」的探测逻辑——如需我补上请告知。

### 变更文件

- `src/main.tsx`：API 路径与 `visibility` 类型/注释。
- `package.json`：版本号 1.2.0 → 1.2.1。
- 构建产物：`dist/index.js` 与根目录 `index.js`（两份，Orca 加载用）。
