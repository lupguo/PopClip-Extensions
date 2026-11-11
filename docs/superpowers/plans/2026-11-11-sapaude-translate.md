# SapaudeTranslate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone PopClip extension `source/SapaudeTranslate.popclipext/` that translates the selection into a ticked target language (default En / 中) using Google, Microsoft (Bing web) or an OpenAI-compatible AI vendor.

**Architecture:** `Config.ts` holds the PopClip header, options, one action per language, length check, result handling and error messages. Each backend is its own module with the same `translate(text, to)` shape (`ai.ts` takes an extra config). `languages.ts` is the single language table; `errors.ts` holds the two error classes the UI distinguishes.

**Tech Stack:** TypeScript 7 (strict, `tsc --noEmit`), PopClip's bundled `axios`, Biome 2 for format/lint, Node 22 `--experimental-strip-types --test` for out-of-repo smoke tests.

**Spec:** `docs/superpowers/specs/2026-11-11-sapaude-translate-design.md`

## Global Constraints

- Only add files under `source/SapaudeTranslate.popclipext/`. Do not modify `package.json`, `package-lock.json`, `tsconfig.json`, `biome.json`, `lib/**`, or any other extension (including `source/InstantTranslate.popclipext/`).
- Follow master's style: `// #popclip` header comment in `Config.ts`, `export const options = [...] as const`, `type Options = InferOptions<typeof options>`, local imports written as `./file.ts`.
- `npm run check` must pass (TS 7 strict), and `npx biome check source/SapaudeTranslate.popclipext` must pass.
- `InferOptions` types every `multiple` option as plain `string` (not a union), so code must not rely on union types for `engine`, `resultMode` or `aiVendor`.
- Smoke tests live **outside the repo** in `/tmp/sapaude-smoke/` and are never committed.
- Be gentle with the free endpoints: run each network smoke test once, not in loops. Google flags an IP (302 → `google.com/sorry`, then 429) after bursts of large requests. If Google returns 302/429, wait an hour and retry; don't hammer it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

```
source/SapaudeTranslate.popclipext/
  errors.ts       # SettingsError, BadResponseError
  languages.ts    # Language type + table of 9 languages
  google.ts       # Google free gtx endpoint
  microsoft.ts    # Bing web translator: session scrape, splitText, retry
  ai.ts           # vendor presets + OpenAI-compatible chat/completions
  Config.ts       # PopClip header, options, actions, run(), errorMessage()
  README.md
```

Smoke tests (not committed):

```
/tmp/sapaude-smoke/
  google.test.ts
  microsoft.test.ts
  ai.test.ts
```

Run any smoke test from the repo root with:

```bash
EXT_DIR=$PWD/source/SapaudeTranslate.popclipext node --experimental-strip-types --no-warnings --test --test-reporter=spec /tmp/sapaude-smoke/<name>.test.ts
```

(The extension files import `axios`, which Node resolves from the repo's `node_modules` because the files live in the repo.)

---

### Task 1: Shared modules and the Google backend

**Files:**
- Create: `source/SapaudeTranslate.popclipext/errors.ts`
- Create: `source/SapaudeTranslate.popclipext/languages.ts`
- Create: `source/SapaudeTranslate.popclipext/google.ts`
- Test: `/tmp/sapaude-smoke/google.test.ts` (not committed)

**Interfaces:**
- Produces:
  - `class SettingsError extends Error` (message shown to the user as is)
  - `class BadResponseError extends Error` (service answered, but not with a usable translation)
  - `interface Language { code: string; label: { en: string; "zh-Hans": string }; icon: string; google: string; microsoft: string; ai: string }`
  - `const languages: Language[]`, 9 entries in order: en, zh, zht, ja, ko, es, fr, de, ru
  - `google.translate(text: string, to: Language): Promise<string>`. Throws an axios error on HTTP failure, or `BadResponseError`.

- [ ] **Step 1: Write the smoke test**

Create `/tmp/sapaude-smoke/google.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

const ext = process.env.EXT_DIR;
if (!ext) throw new Error("set EXT_DIR to the extension directory");
const { languages } = await import(`${ext}/languages.ts`);
const google = await import(`${ext}/google.ts`);

const lang = (code: string) =>
  languages.find((l: { code: string }) => l.code === code);

test("languages: 9 entries with unique codes, en and zh first", () => {
  assert.equal(languages.length, 9);
  assert.equal(new Set(languages.map((l: { code: string }) => l.code)).size, 9);
  assert.deepEqual(
    languages.map((l: { code: string }) => l.code),
    ["en", "zh", "zht", "ja", "ko", "es", "fr", "de", "ru"],
  );
});

test("google: English to Simplified Chinese", async () => {
  const result = await google.translate("Good morning", lang("zh"));
  assert.match(result, /早/);
});

test("google: multi-line Chinese to English keeps both lines", async () => {
  const result = await google.translate("你好。\n谢谢。", lang("en"));
  assert.match(result, /hello/i);
  assert.match(result, /thank/i);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `EXT_DIR=$PWD/source/SapaudeTranslate.popclipext node --experimental-strip-types --no-warnings --test --test-reporter=spec /tmp/sapaude-smoke/google.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `languages.ts`.

- [ ] **Step 3: Create `errors.ts`**

```ts
// a problem the user can fix in the extension's settings; the message is shown as is
export class SettingsError extends Error {}

// the service answered, but not with a usable translation
export class BadResponseError extends Error {}
```

- [ ] **Step 4: Create `languages.ts`**

```ts
export interface Language {
  // internal code, also used in the option name lang_<code>
  code: string;
  label: { en: string; "zh-Hans": string };
  icon: string;
  // the language code or name each backend expects
  google: string;
  microsoft: string;
  ai: string;
}

export const languages: Language[] = [
  {
    code: "en",
    label: { en: "English", "zh-Hans": "英文" },
    icon: "square filled En",
    google: "en",
    microsoft: "en",
    ai: "English",
  },
  {
    code: "zh",
    label: { en: "Simplified Chinese", "zh-Hans": "简体中文" },
    icon: "square filled 中",
    google: "zh-CN",
    microsoft: "zh-Hans",
    ai: "Simplified Chinese",
  },
  {
    code: "zht",
    label: { en: "Traditional Chinese", "zh-Hans": "繁体中文" },
    icon: "square filled 繁",
    google: "zh-TW",
    microsoft: "zh-Hant",
    ai: "Traditional Chinese",
  },
  {
    code: "ja",
    label: { en: "Japanese", "zh-Hans": "日语" },
    icon: "square filled 日",
    google: "ja",
    microsoft: "ja",
    ai: "Japanese",
  },
  {
    code: "ko",
    label: { en: "Korean", "zh-Hans": "韩语" },
    icon: "square filled 한",
    google: "ko",
    microsoft: "ko",
    ai: "Korean",
  },
  {
    code: "es",
    label: { en: "Spanish", "zh-Hans": "西班牙语" },
    icon: "square filled Es",
    google: "es",
    microsoft: "es",
    ai: "Spanish",
  },
  {
    code: "fr",
    label: { en: "French", "zh-Hans": "法语" },
    icon: "square filled Fr",
    google: "fr",
    microsoft: "fr",
    ai: "French",
  },
  {
    code: "de",
    label: { en: "German", "zh-Hans": "德语" },
    icon: "square filled De",
    google: "de",
    microsoft: "de",
    ai: "German",
  },
  {
    code: "ru",
    label: { en: "Russian", "zh-Hans": "俄语" },
    icon: "square filled Ру",
    google: "ru",
    microsoft: "ru",
    ai: "Russian",
  },
];
```

- [ ] **Step 5: Create `google.ts`**

```ts
import axios from "axios";
import { BadResponseError } from "./errors.ts";
import type { Language } from "./languages.ts";

// Google's free "gtx" endpoint, as used by the Google Translate browser extension.
// POST with a form body, because long text would make the URL too long.
export async function translate(text: string, to: Language): Promise<string> {
  const response = await axios.post(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to.google)}&dt=t`,
    `q=${encodeURIComponent(text)}`,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  const data: unknown =
    typeof response.data === "string"
      ? JSON.parse(response.data)
      : response.data;
  // the response looks like [[["translated","original",...], ...], ...]
  const segments = Array.isArray(data) ? data[0] : undefined;
  if (!Array.isArray(segments)) {
    throw new BadResponseError();
  }
  const result = segments
    .map((s: unknown) =>
      Array.isArray(s) && typeof s[0] === "string" ? s[0] : "",
    )
    .join("");
  if (!result) {
    throw new BadResponseError();
  }
  return result;
}
```

- [ ] **Step 6: Run the smoke test and confirm it passes**

Run the same command as Step 2.
Expected: 3 passing tests. If the Google tests fail with status 429 or a 302 to `google.com/sorry`, the IP is temporarily flagged. Note it, wait, retry later, and don't loop.

- [ ] **Step 7: Format, type-check and lint**

```bash
npx biome check --write source/SapaudeTranslate.popclipext
npm run check
npx biome check source/SapaudeTranslate.popclipext
```
Expected: `tsc` prints nothing and exits 0. Biome reports no errors.

- [ ] **Step 8: Commit**

```bash
git add source/SapaudeTranslate.popclipext/errors.ts source/SapaudeTranslate.popclipext/languages.ts source/SapaudeTranslate.popclipext/google.ts
git commit -m "feat(SapaudeTranslate): add language table and Google backend

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Microsoft (Bing web) backend

**Files:**
- Create: `source/SapaudeTranslate.popclipext/microsoft.ts`
- Test: `/tmp/sapaude-smoke/microsoft.test.ts` (not committed)

**Interfaces:**
- Consumes: `Language` and `BadResponseError` from Task 1.
- Produces:
  - `microsoft.splitText(text: string, max: number): string[]`. Splits into pieces of at most `max` chars, breaking after the last newline, else after the last `.!?。！？`, else after the last space, else hard-cutting at `max`. The pieces concatenate back to `text`.
  - `microsoft.translate(text: string, to: Language): Promise<string>`. Throws an axios error on HTTP failure (other than one 401 retry), or `BadResponseError`.

Background (verified with curl on 2026-11-11): `edge.microsoft.com/translate/auth` returns 404. The Bing web page `https://www.bing.com/translator` embeds `IG:"…"`, `data-iid="translator.NNNN"` and `params_AbusePreventionHelper = [key,"token",ttlMs]`. `POST /ttranslatev3` accepts at most 1000 characters. Longer text gets HTTP 200 with `{"statusCode":400}`. Requests without a browser `User-Agent` get 401.

- [ ] **Step 1: Write the smoke test**

Create `/tmp/sapaude-smoke/microsoft.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

const ext = process.env.EXT_DIR;
if (!ext) throw new Error("set EXT_DIR to the extension directory");
const { languages } = await import(`${ext}/languages.ts`);
const microsoft = await import(`${ext}/microsoft.ts`);

const lang = (code: string) =>
  languages.find((l: { code: string }) => l.code === code);

test("splitText: short text stays whole", () => {
  assert.deepEqual(microsoft.splitText("abc", 10), ["abc"]);
});

test("splitText: prefers newline, then sentence end, then space, then hard cut", () => {
  assert.deepEqual(microsoft.splitText("aa\nbb. cc dd", 8), ["aa\n", "bb.", " cc dd"]);
  assert.deepEqual(microsoft.splitText("aaa。bbbbbb", 6), ["aaa。", "bbbbbb"]);
  assert.deepEqual(microsoft.splitText("aaa bbbbbb", 6), ["aaa ", "bbbbbb"]);
  assert.deepEqual(microsoft.splitText("abcdefgh", 3), ["abc", "def", "gh"]);
});

test("splitText: pieces rejoin to the original and respect the limit", () => {
  const text = "Hello world. ".repeat(400);
  const pieces = microsoft.splitText(text, 1000);
  assert.equal(pieces.join(""), text);
  for (const p of pieces) assert.ok(p.length <= 1000);
});

test("microsoft: Chinese to Japanese", async () => {
  const result = await microsoft.translate("你好，世界", lang("ja"));
  assert.match(result, /こんにちは/);
});

test("microsoft: 2500 characters split into pieces, blank line kept", async () => {
  const text = `${"Good morning. ".repeat(90)}\n\n${"Good night. ".repeat(110)}`;
  const result = await microsoft.translate(text, lang("zh"));
  assert.match(result, /早上好/);
  assert.match(result, /晚安/);
  assert.match(result, /\n\n/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `EXT_DIR=$PWD/source/SapaudeTranslate.popclipext node --experimental-strip-types --no-warnings --test --test-reporter=spec /tmp/sapaude-smoke/microsoft.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `microsoft.ts`.

- [ ] **Step 3: Create `microsoft.ts`**

```ts
import axios from "axios";
import { BadResponseError } from "./errors.ts";
import type { Language } from "./languages.ts";

// Microsoft translation via the Bing Translator web page, which needs no key.
// (The Edge token endpoint edge.microsoft.com/translate/auth went away in 2026-11.)

// Bing rejects requests that don't look like they come from a browser
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// longest text Bing accepts in one request
const maxPiece = 1000;

interface Session {
  ig: string;
  iid: string;
  key: string;
  token: string;
  expires: number;
}

// kept in memory between translations, like OpenAIChat's message history
let session: Session | undefined;

// thrown when Bing no longer accepts the session's token
class ExpiredSession extends Error {}

async function getSession(): Promise<Session> {
  if (session && Date.now() < session.expires) {
    return session;
  }
  const response = await axios.get("https://www.bing.com/translator", {
    headers: { "User-Agent": userAgent },
    responseType: "text",
  });
  const html = String(response.data);
  const ig = html.match(/IG:"([A-F0-9]+)"/)?.[1];
  const iid = html.match(/data-iid="(translator\.\d+)"/)?.[1];
  const abuse = html.match(
    /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/,
  );
  if (!ig || !iid || !abuse) {
    throw new BadResponseError();
  }
  session = {
    ig,
    iid,
    key: abuse[1],
    token: abuse[2],
    expires: Date.now() + Number(abuse[3]) * 0.9,
  };
  return session;
}

async function request(text: string, to: Language, s: Session) {
  const form = [
    ["fromLang", "auto-detect"],
    ["to", to.microsoft],
    ["text", text],
    ["key", s.key],
    ["token", s.token],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  let data: unknown;
  try {
    const response = await axios.post(
      `https://www.bing.com/ttranslatev3?isVertical=1&IG=${s.ig}&IID=${s.iid}`,
      form,
      {
        headers: {
          "User-Agent": userAgent,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
    data = response.data;
  } catch (e) {
    if (
      (e as { response?: { status?: number } } | null)?.response?.status === 401
    ) {
      throw new ExpiredSession();
    }
    throw e;
  }
  if (typeof data === "string") {
    data = JSON.parse(data);
  }
  // on success the response is [{ translations: [{ text }] }];
  // on failure it is an object such as { statusCode: 400 }
  if (!Array.isArray(data)) {
    if ((data as { statusCode?: number } | null)?.statusCode === 401) {
      throw new ExpiredSession();
    }
    throw new BadResponseError();
  }
  const result: unknown = data[0]?.translations?.[0]?.text;
  if (typeof result !== "string") {
    throw new BadResponseError();
  }
  return result;
}

// translate one piece, keeping its leading and trailing whitespace
async function translatePiece(piece: string, to: Language): Promise<string> {
  const core = piece.trim();
  if (!core) {
    return piece;
  }
  const start = piece.indexOf(core);
  const before = piece.slice(0, start);
  const after = piece.slice(start + core.length);
  let result: string;
  try {
    result = await request(core, to, await getSession());
  } catch (e) {
    if (!(e instanceof ExpiredSession)) {
      throw e;
    }
    // get a fresh session and try once more
    session = undefined;
    result = await request(core, to, await getSession());
  }
  return before + result + after;
}

// position just after the last sentence-ending punctuation mark, or 0 if none
function lastSentenceEnd(text: string): number {
  const last = [...text.matchAll(/[.!?。！？]/g)].pop();
  return last?.index === undefined ? 0 : last.index + 1;
}

// split text into pieces of at most `max` characters, preferring to break
// after a newline, then after sentence punctuation, then after a space
export function splitText(text: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = window.lastIndexOf("\n") + 1;
    if (cut === 0) {
      cut = lastSentenceEnd(window);
    }
    if (cut === 0) {
      cut = window.lastIndexOf(" ") + 1;
    }
    if (cut === 0) {
      cut = max;
    }
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) {
    pieces.push(rest);
  }
  return pieces;
}

export async function translate(text: string, to: Language): Promise<string> {
  const results: string[] = [];
  // one request at a time, to stay clear of Bing's rate limits
  for (const piece of splitText(text, maxPiece)) {
    results.push(await translatePiece(piece, to));
  }
  return results.join("");
}
```

- [ ] **Step 4: Run the smoke test and confirm it passes**

Run the same command as Step 2.
Expected: 5 passing tests. The 2500-character test takes about 10–15 s, because the pieces are requested one at a time.

- [ ] **Step 5: Format, type-check and lint**

```bash
npx biome check --write source/SapaudeTranslate.popclipext
npm run check
npx biome check source/SapaudeTranslate.popclipext
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add source/SapaudeTranslate.popclipext/microsoft.ts
git commit -m "feat(SapaudeTranslate): add Microsoft backend via Bing web translator

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: AI backend

**Files:**
- Create: `source/SapaudeTranslate.popclipext/ai.ts`
- Test: `/tmp/sapaude-smoke/ai.test.ts` (not committed)

**Interfaces:**
- Consumes: `Language`, `SettingsError` and `BadResponseError` from Task 1.
- Produces:
  - `interface AiConfig { vendor: string; model: string; key: string; baseUrl: string }`. `vendor` is one of `openai`, `deepseek`, `qwen`, `zhipu`, `openrouter` or `custom`. These are exactly the values of the `aiVendor` option in Task 4.
  - `ai.translate(text: string, to: Language, config: AiConfig): Promise<string>`. Throws `SettingsError` before sending anything if the key is blank, or if `custom` is missing its Base URL or model. Otherwise throws an axios error on HTTP failure, or `BadResponseError`.
  - `extraBody`, which turns thinking off, is sent **only** when `config.model` is blank, that is, with the vendor's default model.

- [ ] **Step 1: Write the smoke test**

Create `/tmp/sapaude-smoke/ai.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

const ext = process.env.EXT_DIR;
if (!ext) throw new Error("set EXT_DIR to the extension directory");
const { languages } = await import(`${ext}/languages.ts`);
const ai = await import(`${ext}/ai.ts`);
const { SettingsError } = await import(`${ext}/errors.ts`);

const lang = (code: string) =>
  languages.find((l: { code: string }) => l.code === code);

test("ai: blank key is a settings error", async () => {
  await assert.rejects(
    ai.translate("hi", lang("zh"), { vendor: "openai", model: "", key: " ", baseUrl: "" }),
    SettingsError,
  );
});

test("ai: custom vendor needs a base URL and a model", async () => {
  await assert.rejects(
    ai.translate("hi", lang("zh"), { vendor: "custom", model: "", key: "k", baseUrl: "https://example.com/v1" }),
    SettingsError,
  );
  await assert.rejects(
    ai.translate("hi", lang("zh"), { vendor: "custom", model: "m", key: "k", baseUrl: " " }),
    SettingsError,
  );
});

test("ai: unknown vendor is a settings error", async () => {
  await assert.rejects(
    ai.translate("hi", lang("zh"), { vendor: "moonshot", model: "", key: "k", baseUrl: "" }),
    SettingsError,
  );
});

// optional: AI_VENDOR=deepseek AI_KEY=sk-... (AI_MODEL / AI_BASE_URL for custom)
test("ai: real request", { skip: !process.env.AI_KEY }, async () => {
  const result = await ai.translate("Good morning", lang("zh"), {
    vendor: process.env.AI_VENDOR ?? "openai",
    model: process.env.AI_MODEL ?? "",
    key: process.env.AI_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "",
  });
  assert.match(result, /早/);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `EXT_DIR=$PWD/source/SapaudeTranslate.popclipext node --experimental-strip-types --no-warnings --test --test-reporter=spec /tmp/sapaude-smoke/ai.test.ts`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `ai.ts`.

- [ ] **Step 3: Create `ai.ts`**

```ts
import axios from "axios";
import { BadResponseError, SettingsError } from "./errors.ts";
import type { Language } from "./languages.ts";

interface Vendor {
  baseUrl: string;
  model: string;
  // extra request fields that turn off "thinking", which translation doesn't need
  // and which costs extra tokens and time
  extraBody: Record<string, unknown>;
}

// Default models are chosen for cost first, then quality, then speed.
// Prices per 1M tokens (input / output), checked 2026-11-11.
const vendors: Record<string, Vendor | undefined> = {
  // $0.10 / $0.50
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-6-luna",
    extraBody: { reasoning_effort: "none" },
  },
  // ¥1 / ¥4 off-peak, ¥2 / ¥8 peak
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-flash",
    extraBody: { thinking: { type: "disabled" } },
  },
  // ¥0.2 / ¥0.8 for inputs up to 32K
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-flash",
    extraBody: { enable_thinking: false },
  },
  // free
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
    extraBody: { thinking: { type: "disabled" } },
  },
  // about $0.05–0.10 / $0.25–0.50, depending on the provider OpenRouter picks
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-6-luna",
    extraBody: { reasoning: { effort: "none" } },
  },
};

export interface AiConfig {
  // a key of `vendors`, or "custom"
  vendor: string;
  model: string;
  key: string;
  baseUrl: string;
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

export async function translate(
  text: string,
  to: Language,
  config: AiConfig,
): Promise<string> {
  const key = config.key.trim();
  if (!key) {
    throw new SettingsError("请在设置中填写 AI API Key");
  }
  let model = config.model.trim();
  let baseUrl: string;
  let extraBody: Record<string, unknown> = {};
  if (config.vendor === "custom") {
    baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl || !model) {
      throw new SettingsError("自定义厂商需要填写 Base URL 和模型");
    }
  } else {
    const vendor = vendors[config.vendor];
    if (!vendor) {
      throw new SettingsError("请在设置中重新选择模型厂商");
    }
    baseUrl = vendor.baseUrl;
    // only the default model is known to accept the extra fields
    if (!model) {
      model = vendor.model;
      extraBody = vendor.extraBody;
    }
  }
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      ...extraBody,
      messages: [
        {
          role: "system",
          content: `You are a translation engine. Translate the user's text into ${to.ai}. Output only the translation, keep the original formatting and line breaks, no explanations.`,
        },
        { role: "user", content: text },
      ],
    },
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const content = (response.data as ChatResponse | null)?.choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new BadResponseError();
  }
  return content.trim();
}
```

- [ ] **Step 4: Run the smoke test and confirm it passes**

Run the same command as Step 2.
Expected: 3 passing tests, plus "ai: real request" skipped. That one runs only if the user supplies `AI_KEY`.

- [ ] **Step 5: Format, type-check and lint**

```bash
npx biome check --write source/SapaudeTranslate.popclipext
npm run check
npx biome check source/SapaudeTranslate.popclipext
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add source/SapaudeTranslate.popclipext/ai.ts
git commit -m "feat(SapaudeTranslate): add OpenAI-compatible AI backend with vendor presets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: PopClip entry point (`Config.ts`) and README

**Files:**
- Create: `source/SapaudeTranslate.popclipext/Config.ts`
- Create: `source/SapaudeTranslate.popclipext/README.md`

**Interfaces:**
- Consumes:
  - `languages`, `Language` (Task 1)
  - `SettingsError`, `BadResponseError` (Task 1)
  - `google.translate` (Task 1), `microsoft.translate` (Task 2), `ai.translate` and `AiConfig` (Task 3)
- Produces: the `options` and `actions` exports that PopClip reads. The option identifiers are `engine`, `resultMode`, `maxLength`, `lang_en` … `lang_ru`, `aiVendor`, `aiModel`, `aiKey` and `aiBaseUrl`.

`Config.ts` uses PopClip globals (`popclip`, `Input`, `Action`, `InferOptions`), so it can't run under Node. The type checker and the manual PopClip check in Task 5 verify it instead.

- [ ] **Step 1: Create `Config.ts`**

```ts
// #popclip
// name: Sapaude Translate
// identifier: com.lupguo.popclip.extension.sapaude-translate
// description: Translate the selection with Google, Microsoft or an AI model.
// icon: iconify:material-symbols:translate
// popclipVersion: 4586
// regex: (?s)^.{1,5000}$
// entitlements: [network]

import * as ai from "./ai.ts";
import { BadResponseError, SettingsError } from "./errors.ts";
import * as google from "./google.ts";
import { type Language, languages } from "./languages.ts";
import * as microsoft from "./microsoft.ts";

// the header regex above allows at most this many characters
const hardMaxLength = 5000;
const defaultMaxLength = 500;

export const options = [
  {
    identifier: "engine",
    label: { en: "Translation Service", "zh-Hans": "翻译服务" },
    type: "multiple",
    values: ["google", "microsoft", "ai"],
    valueLabels: ["Google", "Microsoft", "AI"],
    defaultValue: "google",
  },
  {
    identifier: "resultMode",
    label: { en: "Result Handling", "zh-Hans": "结果处理" },
    type: "multiple",
    values: ["preview", "replace", "copy"],
    valueLabels: [
      { en: "Preview", "zh-Hans": "预览" },
      { en: "Replace", "zh-Hans": "替换" },
      { en: "Copy", "zh-Hans": "复制" },
    ],
    defaultValue: "preview",
    description: {
      en: "Hold ⌥ to replace instead (or to preview, when set to Replace).",
      "zh-Hans": "按住 ⌥ 临时改为替换（设为替换时改为预览）。",
    },
  },
  {
    identifier: "maxLength",
    label: { en: "Maximum Text Length", "zh-Hans": "最大文本长度" },
    type: "string",
    defaultValue: "500",
    description: {
      en: "Longest selection to translate, in characters (1–5000).",
      "zh-Hans": "可翻译的最大字符数（1–5000）。",
    },
  },
  {
    identifier: "languagesHeading",
    label: { en: "Target Languages", "zh-Hans": "目标语言" },
    type: "heading",
  },
  {
    identifier: "lang_en",
    label: { en: "English", "zh-Hans": "英文" },
    type: "boolean",
    icon: "square filled En",
    defaultValue: true,
  },
  {
    identifier: "lang_zh",
    label: { en: "Simplified Chinese", "zh-Hans": "简体中文" },
    type: "boolean",
    icon: "square filled 中",
    defaultValue: true,
  },
  {
    identifier: "lang_zht",
    label: { en: "Traditional Chinese", "zh-Hans": "繁体中文" },
    type: "boolean",
    icon: "square filled 繁",
    defaultValue: false,
  },
  {
    identifier: "lang_ja",
    label: { en: "Japanese", "zh-Hans": "日语" },
    type: "boolean",
    icon: "square filled 日",
    defaultValue: false,
  },
  {
    identifier: "lang_ko",
    label: { en: "Korean", "zh-Hans": "韩语" },
    type: "boolean",
    icon: "square filled 한",
    defaultValue: false,
  },
  {
    identifier: "lang_es",
    label: { en: "Spanish", "zh-Hans": "西班牙语" },
    type: "boolean",
    icon: "square filled Es",
    defaultValue: false,
  },
  {
    identifier: "lang_fr",
    label: { en: "French", "zh-Hans": "法语" },
    type: "boolean",
    icon: "square filled Fr",
    defaultValue: false,
  },
  {
    identifier: "lang_de",
    label: { en: "German", "zh-Hans": "德语" },
    type: "boolean",
    icon: "square filled De",
    defaultValue: false,
  },
  {
    identifier: "lang_ru",
    label: { en: "Russian", "zh-Hans": "俄语" },
    type: "boolean",
    icon: "square filled Ру",
    defaultValue: false,
  },
  {
    identifier: "aiHeading",
    label: { en: "AI Translation", "zh-Hans": "AI 翻译" },
    type: "heading",
  },
  {
    identifier: "aiVendor",
    label: { en: "AI Provider", "zh-Hans": "模型厂商" },
    type: "multiple",
    values: ["openai", "deepseek", "qwen", "zhipu", "openrouter", "custom"],
    valueLabels: [
      "OpenAI",
      "DeepSeek",
      { en: "Qwen", "zh-Hans": "通义千问" },
      { en: "Zhipu GLM", "zh-Hans": "智谱 GLM" },
      "OpenRouter",
      { en: "Custom", "zh-Hans": "自定义" },
    ],
    defaultValue: "openai",
  },
  {
    identifier: "aiModel",
    label: { en: "Model", "zh-Hans": "模型" },
    type: "string",
    description: {
      en: "Leave blank to use the provider's default: gpt-6-luna, deepseek-flash, qwen3.7-flash, glm-4.7-flash or openai/gpt-6-luna.",
      "zh-Hans":
        "留空使用厂商默认模型：gpt-6-luna、deepseek-flash、qwen3.7-flash、glm-4.7-flash 或 openai/gpt-6-luna。",
    },
  },
  {
    identifier: "aiKey",
    label: "API Key",
    type: "secret",
  },
  {
    identifier: "aiBaseUrl",
    label: "Base URL",
    type: "string",
    description: {
      en: "Only for the Custom provider, e.g. https://api.moonshot.cn/v1",
      "zh-Hans": "仅用于自定义厂商，例如 https://api.moonshot.cn/v1",
    },
  },
] as const;

type Options = InferOptions<typeof options>;

const engineNames: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  ai: "AI",
};

// blank or non-numeric falls back to the default; the rest is clamped to 1–5000
function parseMaxLength(value: string): number {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    return defaultMaxLength;
  }
  return Math.min(Math.max(n, 1), hardMaxLength);
}

function translate(
  text: string,
  to: Language,
  options: Options,
): Promise<string> {
  switch (options.engine) {
    case "microsoft":
      return microsoft.translate(text, to);
    case "ai":
      return ai.translate(text, to, {
        vendor: options.aiVendor,
        model: options.aiModel,
        key: options.aiKey,
        baseUrl: options.aiBaseUrl,
      });
    default:
      return google.translate(text, to);
  }
}

interface ErrorResponse {
  status: number;
  data?: { error?: { message?: string } };
}

// turn errors into messages a user can act on
function errorMessage(error: unknown, engine: string): string {
  if (error instanceof SettingsError) {
    return error.message;
  }
  const name = engineNames[engine] ?? engine;
  if (error instanceof BadResponseError) {
    return `${name} 返回了无法解析的结果`;
  }
  const response = (error as { response?: ErrorResponse } | null)?.response;
  if (!response) {
    return `无法连接 ${name}：${String(error)}`;
  }
  switch (response.status) {
    case 401:
    case 403:
      return engine === "ai"
        ? "AI API Key 无效或无权限，请检查设置"
        : `${name} 拒绝访问，接口可能已变更或被限流`;
    case 429:
      return `${name} 暂时限制了请求，请稍后再试，或在设置中换一个翻译服务`;
    default: {
      const detail = response.data?.error?.message;
      return `${name} 错误 ${response.status}${detail ? `: ${detail}` : ""}`;
    }
  }
}

async function run(
  input: Input,
  options: Options,
  to: Language,
): Promise<string | undefined> {
  const limit = parseMaxLength(options.maxLength);
  if (input.text.length > limit) {
    popclip.showText(
      `选中文本 ${input.text.length} 字符，超过上限 ${limit}（可在设置中调整，最大 ${hardMaxLength}）`,
    );
    return;
  }
  let result: string;
  try {
    result = await translate(input.text, to, options);
  } catch (e) {
    popclip.showText(errorMessage(e, options.engine));
    return;
  }
  let mode = options.resultMode;
  // holding option swaps replace with preview, and anything else with replace
  if (popclip.modifiers.option) {
    mode = mode === "replace" ? "preview" : "replace";
  }
  switch (mode) {
    case "replace":
      await popclip.pasteText(result);
      return;
    case "copy":
      await popclip.copyText(result);
      popclip.showSuccess();
      return;
    default:
      // shown by the action's "preview-result" step
      return result;
  }
}

// one button per language, shown when the language is ticked in the settings
export const actions: Action<Options>[] = languages.map((language) => ({
  title: language.label,
  icon: language.icon,
  requirements: ["text", `option-lang_${language.code}=1`],
  after: "preview-result",
  code: (input, options) => run(input, options, language),
}));
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Sapaude Translate

选中文本后点击语言按钮，用 Google、微软（Bing）或 AI 模型翻译。

## 按钮

默认显示两个按钮：**En**（翻译成英文）和 **中**（翻译成简体中文）。
在设置的“目标语言”里还可以勾选繁体中文、日语、韩语、西班牙语、法语、德语、俄语，勾选后出现对应按钮。

## 设置

- **翻译服务**：Google / Microsoft / AI。Google 和 Microsoft 使用免费接口，无需 Key；这些接口是非官方的，可能被限流或变更。
- **结果处理**：预览（默认，点击可复制）/ 替换选中文本 / 复制到剪贴板。按住 ⌥ 点击时临时改为替换（设为替换时改为预览）。
- **最大文本长度**：默认 500 字符，最大 5000。
- **AI 翻译**：选择模型厂商并填写 API Key。模型留空时使用厂商默认模型（已关闭“思考”以节省费用和时间）：

  | 厂商 | 默认模型 |
  |---|---|
  | OpenAI | gpt-6-luna |
  | DeepSeek | deepseek-flash |
  | 通义千问 | qwen3.7-flash |
  | 智谱 GLM | glm-4.7-flash（免费） |
  | OpenRouter | openai/gpt-6-luna |
  | 自定义 | 填写 Base URL（OpenAI 兼容，例如 `https://api.moonshot.cn/v1`）和模型 |
```

- [ ] **Step 3: Format, type-check and lint**

```bash
npx biome check --write source/SapaudeTranslate.popclipext
npm run check
npx biome check source/SapaudeTranslate.popclipext
```
Expected: no errors. If `tsc` complains that `requirements` doesn't match `Requirement`, check that the template literal is exactly `` `option-lang_${language.code}=1` `` inside an array literal typed by `Action<Options>`.

- [ ] **Step 4: Re-run all smoke tests once**

```bash
for t in google microsoft ai; do EXT_DIR=$PWD/source/SapaudeTranslate.popclipext node --experimental-strip-types --no-warnings --test --test-reporter=spec /tmp/sapaude-smoke/$t.test.ts; done
```
Expected: all pass, with `ai: real request` skipped. Google 429/302 is the known rate-limit; see Global Constraints.

- [ ] **Step 5: Confirm nothing outside the extension changed**

Run: `git status --porcelain`
Expected: only `?? source/SapaudeTranslate.popclipext/Config.ts`, `?? source/SapaudeTranslate.popclipext/README.md`, plus the pre-existing untracked `.idea/`.

- [ ] **Step 6: Commit**

```bash
git add source/SapaudeTranslate.popclipext/Config.ts source/SapaudeTranslate.popclipext/README.md
git commit -m "feat(SapaudeTranslate): add PopClip actions, options and README

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Manual verification in PopClip (user)

These checks need the real PopClip app and the user's API keys. Hand them to the user as a checklist, and record the results before finishing the branch.

- [ ] **Step 1: Install the extension**

The user runs `! open source/SapaudeTranslate.popclipext` and confirms the install prompt in PopClip.

- [ ] **Step 2: Default buttons and the Google backend**

Select an English sentence and click **中**. The Chinese translation appears in the preview, and clicking it copies the text. Select Chinese text and click **En**; English appears.

- [ ] **Step 3: Microsoft backend (confirms PopClip's axios can send `User-Agent`)**

Set Translation Service to Microsoft and repeat Step 2. If every request shows "Microsoft 拒绝访问…", PopClip is dropping the `User-Agent` header. Stop and go back to the design: the spec lists this as an open risk.

- [ ] **Step 4: Language checkboxes**

Tick 日语 in the settings. A **日** button appears and translates into Japanese. Untick it, and the button disappears.

- [ ] **Step 5: Result modes and ⌥**

- Replace, in an editable text field: the selection is replaced by the translation.
- Copy: PopClip's "Copied" notification shows and the clipboard holds the translation.
- Preview of a translation longer than 160 characters (for example, a full paragraph): it shows full-screen in Large Type and is on the clipboard.
- Preview while holding ⌥: the selection is replaced.
- Replace while holding ⌥: the translation is previewed.

- [ ] **Step 6: Length limit**

Leave Maximum Text Length at the default 500 and select about 600 characters. The message "选中文本 600 字符，超过上限 500…" appears. Set it to `abc` and the limit falls back to 500. Set it to `9999` and 5000-character selections work.

- [ ] **Step 7: AI backend**

- With no key: exactly "请在设置中填写 AI API Key", not "无法连接 AI：…". This confirms that `instanceof SettingsError` works across modules in PopClip.
- With a real key for at least one preset vendor and Model left blank: a translation comes back quickly, with no reasoning text.
- With a wrong key: "AI API Key 无效或无权限，请检查设置".

Ideally, check every vendor the user has a key for, to confirm each vendor's `extraBody` is accepted. GLM-4.7-Flash's `thinking: disabled` is inferred from the GLM-4.7 series docs and still unconfirmed.

- [ ] **Step 8: Record results**

If everything passes, use superpowers:finishing-a-development-branch. If a vendor rejects its `extraBody`, update the vendor entry in `ai.ts`, either removing the field or changing it as that vendor's error message suggests, then re-run Task 3 Step 5 and commit as `fix(SapaudeTranslate): …`.
