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

// thrown when Bing no longer accepts the session's token; shaped like an
// axios error so a second failure is reported as a 401
class ExpiredSession extends Error {
  response = { status: 401 };
}

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
    try {
      data = JSON.parse(data);
    } catch {
      throw new BadResponseError();
    }
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
