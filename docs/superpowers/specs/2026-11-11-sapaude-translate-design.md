# SapaudeTranslate 插件设计

日期：2026-11-11

## 目标

新建独立 PopClip 插件 `source/SapaudeTranslate.popclipext/`：选中文本后点击语言按钮（默认 En / 中），
用 Google、微软或 AI（OpenAI 兼容协议）翻译成对应语言。

约束：

- **不改动** PopClip 基础组件（`package.json`、`tsconfig.json`、`biome.json`、`lib/**`）和任何上游插件（含 InstantTranslate）；只新增文件。
- 按 master 现行规范：`Config.ts` 头注释、`options ... as const` + `InferOptions`、TS 7 strict，`npm run check` 通过。

## 文件结构

```
source/SapaudeTranslate.popclipext/
  Config.ts       # 头注释、options、actions、长度检查、结果处理、错误提示
  languages.ts    # 语言表（9 种）与 Language 类型
  google.ts       # Google 免费 gtx 接口
  microsoft.ts    # 微软 Bing 网页翻译（ttranslatev3），含分块
  ai.ts           # 厂商预设表 + OpenAI 兼容 chat/completions
  errors.ts       # SettingsError / BadResponseError
  README.md
```

本地模块用 `import ... from "./xxx.ts"` 引入（master 上 Instapaper 等已有此用法，PopClip 自行打包，无需 build 脚本）。

## Config.ts 头注释

```
// #popclip
// name: Sapaude Translate
// identifier: com.lupguo.popclip.extension.sapaude-translate
// description: Translate the selection with Google, Microsoft or an AI model.
// icon: iconify:material-symbols:translate
// popclipVersion: 4586
// regex: (?s)^.{1,5000}$
// entitlements: [network]
```

`regex` 是静态硬上限 5000；用户可配的上限在运行时检查（见“长度限制”）。

## 语言

`languages.ts` 导出语言表，每条记录：

```ts
interface Language {
  code: string;       // 内部代码，也用于 option 名 lang_<code>
  label: { en: string; "zh-Hans": string }; // 按钮标题
  icon: string;       // 按钮图标
  google: string;     // Google 语言代码
  microsoft: string;  // 微软语言代码
  ai: string;         // 给 AI 的语言名称
}
```

| code | 按钮图标 | Google | 微软 | AI | 默认勾选 |
|---|---|---|---|---|---|
| en | `square filled En` | en | en | English | ✓ |
| zh | `square filled 中` | zh-CN | zh-Hans | Simplified Chinese | ✓ |
| zht | `square filled 繁` | zh-TW | zh-Hant | Traditional Chinese | |
| ja | `square filled 日` | ja | ja | Japanese | |
| ko | `square filled 한` | ko | ko | Korean | |
| es | `square filled Es` | es | es | Spanish | |
| fr | `square filled Fr` | fr | fr | French | |
| de | `square filled De` | de | de | German | |
| ru | `square filled Ру` | ru | ru | Russian | |

源语言统一由后端自动识别。

## 设置项

`options` 在 `Config.ts` 中逐条显式书写（不由语言表 `map` 生成），以便 `InferOptions` 推出精确字段名。

| identifier | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `engine` | multiple | `google` | `google` / `microsoft` / `ai`，标签 Google / Microsoft / AI |
| `resultMode` | multiple | `preview` | `preview` / `replace` / `copy`，标签 预览 / 替换 / 复制 |
| `maxLength` | string | `"500"` | 最大文本长度，1–5000 |
| —（heading） | heading | | “目标语言” |
| `lang_en` … `lang_ru` | boolean | en、zh 为 true，其余 false | 每种语言一个勾选框，`icon` 与按钮图标相同 |
| —（heading） | heading | | “AI 翻译” |
| `aiVendor` | multiple | `openai` | 见厂商预设表 |
| `aiModel` | string | `""` | 留空使用厂商默认模型 |
| `aiKey` | secret | | API Key |
| `aiBaseUrl` | string | `""` | 仅 `aiVendor = custom` 时使用 |

标签提供 `en` 与 `zh-Hans` 两种（参照 InstantTranslate 的 `label` 写法）。

## 按钮（actions）

由语言表生成 `export const actions: Action<Options>[]`，每种语言一个：

```ts
{
  title: <语言名>,
  icon: language.icon,
  requirements: ["text", `option-lang_${language.code}=1`],
  after: "preview-result",
  code: (input, options) => run(input, options, language),
}
```

只有勾选的语言才显示按钮。

## 数据流（一次点击）

1. **长度检查**：`maxLength` 解析为整数；非数字或空 → 500，>5000 → 5000，<1 → 1。
   `input.text.length` 超限时 `popclip.showText("选中文本 N 字符，超过上限 M（可在设置中调整，最大 5000）")` 并返回。
2. **翻译**：按 `engine` 调用 `google.translate` / `microsoft.translate` / `ai.translate`。
3. **异常**：`catch` 后 `popclip.showText(errorMessage(e, engine))` 并返回。
4. **结果处理**：模式取 `resultMode`；按住 ⌥ 时，预览/复制 → 替换，替换 → 预览。
   - 预览：`return` 译文，由 `after: "preview-result"` 显示（可点击复制）。
   - 替换：`popclip.pasteText(译文)`，返回 `undefined`。
   - 复制：`popclip.copyText(译文)` + `popclip.showSuccess()`，返回 `undefined`。

## 后端

统一签名，后端只负责请求与解析，失败时抛异常：

```ts
// google.ts / microsoft.ts
export async function translate(text: string, to: Language): Promise<string>;
// ai.ts
export interface AiConfig { vendor: string; model: string; key: string; baseUrl: string }
export async function translate(text: string, to: Language, config: AiConfig): Promise<string>;
```

### google.ts

- `POST https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<to.google>&dt=t`，
  表单体 `q=<text>`（用 POST 避免长文本 URL 超长）。
- 响应 `[[["译文段","原文段",…],…],…]`：拼接 `data[0]` 中每段的 `[0]`。

### microsoft.ts

原定的 Edge token 接口 `edge.microsoft.com/translate/auth` 已于 2026-11 下线（404），改用 Bing 网页翻译（2026-11-11 curl 实测可用）：

- 会话：`GET https://www.bing.com/translator`，从 HTML 提取
  `IG:"<IG>"`、第一个 `data-iid="translator.<n>"`、`params_AbusePreventionHelper = [<key>,"<token>",<ttl毫秒>]`；
  缓存在模块级变量，`ttl × 0.9` 后过期。提取失败抛 `BadResponseError`。
- 翻译：`POST https://www.bing.com/ttranslatev3?isVertical=1&IG=<IG>&IID=<iid>`，表单体
  `fromLang=auto-detect&to=<to.microsoft>&text=<text>&key=<key>&token=<token>`；
  成功时响应为数组，取 `data[0].translations[0].text`。
- 两个请求都必须带浏览器 `User-Agent`，否则 401。
- 单次上限 1000 字符（超出时 HTTP 200 + `{"statusCode":400}`）：`splitText(text, 1000)` 依次按换行、句末标点（`.!?。！？`）、空格、硬切的优先级切块，
  逐块顺序请求；每块去掉首尾空白再翻译，翻译后把原首尾空白拼回，最后直接拼接。
- 会话失效（HTTP 401 或响应体 `statusCode: 401`）：清缓存、重新获取会话，仅重试一次。
- 其他非数组响应体抛 `BadResponseError`。

### ai.ts

厂商预设表（集中为代码常量）。默认模型按“费用 > 质量 > 速度”选取，价格为 2026-11-11 官方价格页数据（每 1M tokens，输入 / 输出）：

| aiVendor | 标签 | Base URL | 默认模型 | 价格 | extraBody（关闭/压低思考） |
|---|---|---|---|---|---|
| openai | OpenAI | `https://api.openai.com/v1` | gpt-6-luna | $0.10 / $0.50 | `{ reasoning_effort: "none" }` |
| deepseek | DeepSeek | `https://api.deepseek.com/v1` | deepseek-flash | ¥1 / ¥4 闲时，¥2 / ¥8 高峰 | `{ thinking: { type: "disabled" } }` |
| qwen | 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen3.7-flash | ¥0.2 / ¥0.8（≤32K 输入） | `{ enable_thinking: false }` |
| zhipu | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | glm-4.7-flash | 免费 | `{ thinking: { type: "disabled" } }` |
| openrouter | OpenRouter | `https://openrouter.ai/api/v1` | openai/gpt-6-luna | ≈ $0.05–0.10 / $0.25–0.50 | `{ reasoning: { effort: "none" } }` |
| custom | 自定义 | `aiBaseUrl`（去掉末尾 `/`） | 无，`aiModel` 必填 | — | 无 |

选型说明：

- 主流模型默认开启思考，翻译不需要推理，思考 token 会增加费用和延迟，因此用 `extraBody` 关闭。
- 通义不选 `qwen-mt-*` 翻译专用模型：更贵，且需要专用 `translation_options` 参数，不走通用 system prompt。
- 不预置 Moonshot / Kimi：新用户只能用 K3 系列（最低 kimi-k3.1-pro ¥13 / ¥68），思考无法关闭；需要时用“自定义”，Base URL 填 `https://api.moonshot.cn/v1`。

请求规则：

- 模型：`aiModel.trim()` 非空则用之，否则用厂商默认模型。
- `extraBody` 仅在使用默认模型（`aiModel` 留空）时合并进请求体；用户自填模型时不带，避免不支持该参数的模型报错。
- 请求：`POST <baseURL>/chat/completions`，头 `Authorization: Bearer <key>`，体：
  - `model`
  - `...extraBody`（见上）
  - `messages`：
    - system：`You are a translation engine. Translate the user's text into <to.ai>. Output only the translation, keep the original formatting and line breaks, no explanations.`
    - user：原文
  - 不传 `temperature`（部分推理模型只接受默认值）。
- 结果：`choices[0].message.content.trim()`。

## 错误处理

`errors.ts`：`SettingsError`（用户可在设置里修正的问题，消息原样显示）、`BadResponseError`（服务有响应但不是可用译文）。

后端抛异常，`Config.ts` 的 `errorMessage(e, engine)` 转为中文提示（参照 InstantTranslate 的 `errorMessage`）：

| 情况 | 提示 |
|---|---|
| AI 未填 Key | 不发请求：“请在设置中填写 AI API Key” |
| AI 自定义厂商缺 Base URL 或模型 | 不发请求：“自定义厂商需要填写 Base URL 和模型” |
| 无 response（网络不通） | “无法连接 <引擎>：<错误>” |
| 401 / 403 | Google/微软：“<引擎> 拒绝访问，接口可能已变更或被限流”；AI：“API Key 无效或无权限” |
| 429 | “请求过于频繁，请稍后再试” |
| 其他 HTTP 状态 | “<引擎> 错误 <status>: <detail>”（AI 的 detail 取 `data.error.message`） |
| 响应结构不符或译文为空 | “<引擎> 返回了无法解析的结果” |

## 验证

- `npm run check` 通过（TS 7 strict）。
- `npx biome check source/SapaudeTranslate.popclipext` 通过（不改 `biome.json`）。
- `curl` 冒烟：Google gtx、Bing 网页翻译，确认接口可用、响应结构与本设计一致。
- Node 冒烟脚本（放在仓库外的临时目录，`node --experimental-strip-types --test`）直接调用各后端模块与 `splitText`；不提交。
- PopClip 实机：En / 中 按钮；勾选 日 后出现按钮；三种结果模式及 ⌥ 切换；超长文本提示；AI 由用户用真实 Key 测试一次。
- 各厂商默认模型 + extraBody 由用户用真实 Key 至少验证一次（确认参数被接受、没有思考输出）。
- 不在仓库内引入单测框架（会改动 `package.json`）。
- PopClip 内 axios 能否设置 `User-Agent` 需实机确认；若不能，Bing 后端不可用，需回到设计讨论。

## 不做

- 官方付费 API（Google Cloud / Azure Key）。
- Anthropic / Gemini 原生协议。
- 自定义 AI 提示词、对话历史。
