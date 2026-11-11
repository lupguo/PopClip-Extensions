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
