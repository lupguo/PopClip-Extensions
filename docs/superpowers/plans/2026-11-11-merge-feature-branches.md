# 合并 feature 分支到 master 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `origin/feat/wisdom-save-20250120`（含 notion 分支全部内容）合入 `master`，只新增 NotionDigest 与 Wisdom 插件，基础组件与上游插件保持 master 原样。

**Architecture:** 一次 `--no-ff` 合并；合并过程中用 `git restore --source=HEAD` 把两个自有插件目录以外的所有路径还原为 master 状态（含删除 master 不存在的文件），再在自有目录内做最小修正。

**Tech Stack:** git、npm、TypeScript 7（`npm run check` = `tsc --noEmit`）

**Spec:** `docs/superpowers/specs/2026-11-11-merge-feature-branches-design.md`

## Global Constraints

- 除 `source/NotionDigest.popclipext/`、`source/Wisdom.popclipext/` 外，合并结果中所有路径与 `origin/master` 一致（`docs/superpowers/**` 文档除外）。
- `source/InstantTranslatePlus.popclipext/` 不合入。
- 不得修改 `tsconfig.json`、`package.json`、`lib/**` 或任何上游插件来规避类型错误。
- 推送 `origin master` 前必须向用户展示结果并获得确认。
- 提交信息末尾加：`Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

---

### Task 1: 执行合并并按规则解决冲突

**Files:**
- 合并引入: `source/NotionDigest.popclipext/**`、`source/Wisdom.popclipext/**`
- 还原为 master: 其余全部路径

**Interfaces:**
- Consumes: 本地 `master` = `origin/master` + 若干 `docs/superpowers` 文档提交，工作区仅有未跟踪的 `.idea/`
- Produces: `master` 上的合并提交，父提交为合并前的 master 和 `origin/feat/wisdom-save-20250120`

- [ ] **Step 1: 确认起点**

```bash
git fetch origin
git switch master
git status -sb
git rev-list --count origin/master..master   # 期望: 仅 docs 提交（下一行确认）
git diff --name-only origin/master master   # 期望: 只有 docs/superpowers/ 下的文件
git rev-list --count master..origin/master   # 期望: 0
git rev-parse feat/notion-digest-20240408 origin/feat/notion-digest-20240408  # 期望: 两者均为 8ce95ff6...
```

如果 origin/master 有新提交，先 `git merge --ff-only` 不可行时停下并报告。

- [ ] **Step 2: 开始合并（不自动提交）**

```bash
git merge --no-ff --no-commit origin/feat/wisdom-save-20250120
```

期望：报告冲突，包括 `contrib/Mastodon.popclipext/mastodon.ts`、`package.json`、`tsconfig.json`、`package-lock.json`、`source/Convert.popclipext/convert.js`、`source/InstantTranslate.popclipext/{Config.json,itrans.ts}`。

- [ ] **Step 3: 把两个自有目录以外的路径全部还原为 master 状态**

```bash
git restore --source=HEAD --staged --worktree -- . \
  ':(exclude)source/NotionDigest.popclipext' \
  ':(exclude)source/Wisdom.popclipext' \
  ':(exclude).idea'
```

说明：`--source=HEAD` 即合并前的 master；HEAD 中不存在的被跟踪文件（`package-lock.json`、`convert.js`、`InstantTranslatePlus/**` 等）会被删除。

- [ ] **Step 4: 校验结果**

```bash
git diff --name-only --diff-filter=U            # 期望: 空（无未解决冲突）
git grep -n -E '^(<<<<<<<|>>>>>>>)' -- . ':(exclude)*.lzfse' || echo "no markers"
git diff --cached --stat HEAD
```

期望 `git diff --cached --stat HEAD` 只出现：
`source/NotionDigest.popclipext/{Config.json,README.md,build.sh,digest.bundle.js.lzfse,digest.js,digest.ts}` 和 `source/Wisdom.popclipext/{Config.json,README.md,wisdom.js}`。出现其它路径则回到 Step 3 排查。

- [ ] **Step 5: 提交合并**

```bash
git commit -F - <<'EOF'
Merge feat/wisdom-save-20250120: add NotionDigest and Wisdom extensions

Includes all of feat/notion-digest-20240408. Base components and upstream
extensions keep master's version; InstantTranslatePlus is not merged
(to be replaced by SapaudeTranslate).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
git log --oneline --graph -3
```

---

### Task 2: 修正 NotionDigest 并通过类型检查

**Files:**
- Modify: `source/NotionDigest.popclipext/Config.json`（两处 `"identifier:"`）
- Modify: `source/NotionDigest.popclipext/digest.ts`（`replaceNewLine` 签名）
- 可能 Modify: `source/NotionDigest.popclipext/**`、`source/Wisdom.popclipext/**`（仅当 check 报错）

**Interfaces:**
- Consumes: Task 1 的合并提交
- Produces: 两个目录下 `npm run check` 无错误

- [ ] **Step 1: 安装依赖并记录基线错误**

```bash
git check-ignore -q package-lock.json node_modules && echo ignored   # 若未忽略，安装后不要提交 lock 文件
npm install
npm run check 2>&1 | tee /tmp/check-before.txt
grep -E 'source/(NotionDigest|Wisdom)\.popclipext' /tmp/check-before.txt
grep -v -E 'source/(NotionDigest|Wisdom)\.popclipext' /tmp/check-before.txt | grep -c 'error TS' || true
```

期望：NotionDigest 中至少出现 `replaceNewLine` 参数隐式 `any` 的错误（TS7006）。其它目录的错误是 master 自身就有的，记录数量即可，不要修复。

- [ ] **Step 2: 修正 Config.json 的键名**

在 `source/NotionDigest.popclipext/Config.json` 中把两处

```json
      "identifier:": "pageId",
```
```json
      "identifier:": "blockId",
```

分别改为

```json
      "identifier": "pageId",
```
```json
      "identifier": "blockId",
```

校验：`grep -c '"identifier:"' source/NotionDigest.popclipext/Config.json` 期望 `0`；`python3 -I -m json.tool source/NotionDigest.popclipext/Config.json >/dev/null` 期望无输出。

- [ ] **Step 3: 补全 replaceNewLine 类型**

在 `source/NotionDigest.popclipext/digest.ts` 中把

```ts
function replaceNewLine(text, replacement) {
```

改为

```ts
function replaceNewLine(text: string, replacement: string): string {
```

- [ ] **Step 4: 重新检查**

```bash
npm run check 2>&1 | tee /tmp/check-after.txt
grep -E 'source/(NotionDigest|Wisdom)\.popclipext' /tmp/check-after.txt || echo "clean"
```

期望：`clean`。若仍有错误，只在这两个目录内做最小修正（例如 `import axios from 'axios'` 在 `verbatimModuleSyntax` 下的写法、`Context` 字段类型）。参考 master 上 `source/Notion.popclipext/notion.ts` 的写法。修改后重跑本步骤。

- [ ] **Step 5: 确认没有误改其它文件，然后提交**

```bash
git status --short          # 期望只出现 source/NotionDigest.popclipext/ 下的文件（以及未跟踪的 .idea/）
git add source/NotionDigest.popclipext source/Wisdom.popclipext
git commit -F - <<'EOF'
fix(NotionDigest): fix option identifiers and type errors

"identifier:" typo prevented the pageId/blockId options from being
recognised.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: 最终验证并在用户确认后推送

**Interfaces:**
- Consumes: Task 1、2 的提交
- Produces: `origin/master` 包含合并结果（仅在用户确认后）

- [ ] **Step 1: 改动范围校验**

```bash
git diff origin/master HEAD --stat
git diff origin/master HEAD --name-only | grep -v -E '^(source/(NotionDigest|Wisdom)\.popclipext/|docs/superpowers/)' || echo "scope ok"
git merge-base --is-ancestor origin/feat/wisdom-save-20250120 HEAD && echo "wisdom merged"
git merge-base --is-ancestor origin/master HEAD && echo "fast-forward to origin ok"
```

期望：`scope ok`、`wisdom merged`、`fast-forward to origin ok`。

- [ ] **Step 2: 内容完整性抽查**

```bash
for f in Config.json README.md build.sh digest.ts digest.js digest.bundle.js.lzfse; do
  git diff --quiet feat/notion-digest-20240408 HEAD -- source/NotionDigest.popclipext/$f && echo "same $f" || echo "changed $f"
done
git diff --quiet origin/feat/wisdom-save-20250120 HEAD -- source/Wisdom.popclipext && echo "Wisdom same"
```

期望：只有 `Config.json`、`digest.ts` 显示 changed（Task 2 的修正），以及 Task 2 Step 4 中额外改动过的文件。

- [ ] **Step 3: 向用户汇报并等待确认**

把以下内容展示给用户：`git log --oneline --graph -5`、Step 1 的 stat、`/tmp/check-after.txt` 中两个目录的检查结果，以及 master 自身已有的错误数。**等待用户明确同意后再执行下一步。**

- [ ] **Step 4: 推送（仅在用户确认后）**

```bash
git push origin master
git status -sb   # 期望: ## master...origin/master（无 ahead/behind）
```
