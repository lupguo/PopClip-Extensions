# 合并 feature 分支到 master 设计

日期：2026-11-11

## 目标

把 `feat/notion-digest-20240408`（本地/远端同一提交 `8ce95ff6`）和 `origin/feat/wisdom-save-20250120`
中的自有插件合入 `master`，**不改动 PopClip 基础组件与上游插件**。

## 背景

- wisdom 分支 = notion 分支的 6 个提交（rebase 后）+ 1 个 Wisdom 提交，内容是 notion 分支的超集。
- 分支落后 master 约 460 个提交；master 已重构（`contrib/`、`lib/popclip-helpers`、删除 `package-lock.json`、TS 7 + `tsc --noEmit`、InstantTranslate 改为 DeepL）。

## 合并方式

在 `master` 上执行一次 `git merge --no-ff origin/feat/wisdom-save-20250120`，保留原分支历史。
notion 分支无需单独合并。

## 冲突与文件处理

| 路径 | 处理 |
|---|---|
| `package.json`、`tsconfig.json`、`lib/**`、`contrib/Mastodon.popclipext/**` | 采用 master 版本 |
| `package-lock.json`、`source/Convert.popclipext/convert.js`、`source/InstantTranslate.popclipext/{Config.json,itrans.ts}` | 跟随 master 删除 |
| `extensions/Droplr.popclipextz`、`source/Notion.popclipext/**`、`source/InstantTranslate.popclipext/**`、`source-contrib/**` | 采用 master 状态 |
| `source/InstantTranslatePlus.popclipext/` | 不合入（后续由新插件 SapaudeTranslate 取代） |
| `source/NotionDigest.popclipext/`、`source/Wisdom.popclipext/` | 合入 |

规则：除 `source/NotionDigest.popclipext/` 与 `source/Wisdom.popclipext/` 外，合并结果中所有路径与 `origin/master` 一致。

## 自有插件修正（仅限上述两个目录）

1. `NotionDigest/Config.json`：两处 `"identifier:"` 改为 `"identifier"`（pageId、blockId）。
2. `NotionDigest/digest.ts`：`replaceNewLine` 参数补 `: string` 类型。
3. 若 `npm run check` 在这两个目录中报其它错误，在目录内修复；不得修改 tsconfig 或基础组件来规避。

## 验证

1. 工作区无冲突标记。
2. `git diff origin/master HEAD --stat` 只包含 `source/NotionDigest.popclipext/`、`source/Wisdom.popclipext/` 及本 spec 文档。
3. `npm install && npm run check` 中，新增目录无类型错误（记录 master 自身已存在的错误，如有）。

## 落地

本地 master 合并并验证后，向用户展示结果，经确认后 `git push origin master`。

## 不在范围内

- 新插件 SapaudeTranslate（En/中 两个按钮，后端支持 Google、微软、AI 翻译及厂商/模型/Key 配置）作为独立子项目，另行设计。
