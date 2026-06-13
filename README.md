# Memos Sync — Orca Note Plugin 🐋➡️📓

> 🙏 非常感谢 [虎鲸笔记 / Orca Note](https://github.com/sethyuan/orca-note) 的作者 [Seth](https://github.com/sethyuan) 开发了功能如此强大的知识管理软件。本插件是在其开源插件 [orca-flomo-sync](https://github.com/sethyuan/orca-flomo-sync) 的基础上 **vibe coding** 而成。为同时使用 [Memos](https://usememos.com/) 和 Orca Note 两款开源软件的同学，解决无法数据同步的难题。再次感谢 Seth！❤️

将 [Memos](https://usememos.com/) 笔记同步到 [Orca Note](https://github.com/sethyuan/orca-note) 日记中的插件。

## 功能

- 🔄 一键同步 Memos 笔记到 Orca Note 日记
- 📅 按创建日期自动分组到对应日记页
- ⏱ 支持增量同步和全量同步
- 🏷️ 保留 Memos 标签
- 🔗 每条笔记包含回链，可一键跳回 Memos 原文
- 👁️ 支持按可见性过滤（私有/工作区/公开）
- ♻️ 幂等同步，重复运行不会产生重复内容
- 🌐 支持中文和英文界面

## 安装

1. 从 [Releases](https://github.com/gujin03/memos_sync_orcanote/releases) 下载最新版 `orca-memos-sync.zip`
2. 解压到 Orca Note 的插件目录（通常位于 `~/Documents/orca/plugins/`）
3. 重启 Orca Note
4. 进入设置 → 插件，启用 "Memos Sync"
5. 在插件设置中配置：
   - **Memos API URL**: 你的 Memos 实例地址（如 `https://memos.example.com`）
   - **Memos API Token**: 认证 Token（Memos 设置中生成）
   - **收件箱名称**: Orca Note 日记中存放笔记的块名（默认 "Memos Inbox"）
   - **可见性过滤**: 选择要同步的笔记可见性类型

## 使用

配置完成后，点击 Orca Note 顶栏的 🐋 按钮：

- **左键点击**: 增量同步（只同步上次同步后更新的笔记）
- **悬停菜单**:
  - **增量同步**: 同上
  - **全量同步**: 同步所有笔记（忽略上次同步时间）

同步后每条笔记顶部会显示 `🔗 Open in Memos` 链接，点击可跳转到 Memos 原始页面。

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

构建后的文件位于 `dist/index.js`，将整个项目目录复制到 Orca Note 的 `plugins` 目录即可。

## 技术栈

- TypeScript + React 18
- Vite 5 (Library Mode)
- Orca Note Plugin API

## 许可证

MIT
