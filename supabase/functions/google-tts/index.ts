import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Input validation ----------
interface TTSRequest {
  text: string;
  language?: string;
  speed?: number;   // 0.5 – 2.0  (default 1.0)
}

const MAX_TEXT_LENGTH = 5000;

function validateRequest(body: unknown): TTSRequest {
  if (!body || typeof body !== "object") throw new Error("Invalid request body");
  const { text, language, speed } = body as Record<string, unknown>;
  if (!text || typeof text !== "string") throw new Error("text is required");
  if (text.length > MAX_TEXT_LENGTH) throw new Error(`Text too long (max ${MAX_TEXT_LENGTH} chars)`);
  return {
    text: text.trim(),
    language: typeof language === "string" ? language : "english",
    speed: typeof speed === "number" ? Math.min(2, Math.max(0.5, speed)) : 1.0,
  };
}

// ---------- Text preprocessing ----------
function preprocessText(raw: string): string {
  return raw
    // Strip markdown
    .replace(/\*{1,}/g, "")
    .replace(/#{1,}/g, "")
    // Remove brackets, parens, angle brackets
    .replace(/[()[\]{}<>]/g, "")
    // Remove pipes, backslashes, tildes, backticks, carets
    .replace(/[|\\~`^@&"']/g, "")
    // Semicolons → commas
    .replace(/;/g, ",")
    // Colons (not in time) → period-space
    .replace(/:\s/g, ". ")
    // Multi-dashes/underscores
    .replace(/[-_]{2,}/g, " ")
    .replace(/\s-\s/g, " ")
    // List markers
    .replace(/^[\s]*[-•●○◦▪▸►]\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    // URLs & emails
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/\S+@\S+\.\S+/g, "")
    // Collapse whitespace
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------- Smart text chunking ----------
function chunkText(text: string, maxLen = 180): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    const searchArea = remaining.slice(0, maxLen);

    // Prefer sentence boundaries
    const sentenceEnd = Math.max(
      searchArea.lastIndexOf("।"),
      searchArea.lastIndexOf("."),
      searchArea.lastIndexOf("!"),
      searchArea.lastIndexOf("?"),
    );

    let breakAt: number;
    if (sentenceEnd > maxLen / 2) {
      breakAt = sentenceEnd + 1;
    } else {
      const comma = searchArea.lastIndexOf(",");
      const space = searchArea.lastIndexOf(" ");
      breakAt = Math.max(comma, space);
      if (breakAt < maxLen / 3) breakAt = maxLen;
    }

    chunks.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }

  return chunks.filter(Boolean);
}

// ---------- Fetch single chunk with retry ----------
async function fetchChunkAudio(
  chunk: string,
  langCode: string,
  retries = 2,
): Promise<ArrayBuffer | null> {
  const encoded = encodeURIComponent(chunk);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encoded}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Referer: "https://translate.google.com/",
    Accept: "audio/mpeg, audio/*;q=0.9, */*;q=0.1",
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) return buf;
      }
      console.warn(`Chunk attempt ${attempt + 1} status ${res.status}`);
    } catch (err) {
      console.warn(`Chunk attempt ${attempt + 1} error:`, err);
    }
    // Exponential back-off
    if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return null;
}

// ---------- Parallel batch fetcher ----------
async function fetchAllChunks(
  chunks: string[],
  langCode: string,
  concurrency = 3,
): Promise<ArrayBuffer[]> {
  const results: (ArrayBuffer | null)[] = new Array(chunks.length).fill(null);

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const promises = batch.map((chunk, j) => fetchChunkAudio(chunk, langCode).then((buf) => {
      results[i + j] = buf;
    }));
    await Promise.all(promises);
    // Small delay between batches to avoid rate-limiting
    if (i + concurrency < chunks.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results.filter(Boolean) as ArrayBuffer[];
}

// ---------- Concatenate MP3 buffers ----------
function concatenateBuffers(buffers: ArrayBuffer[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    out.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return out;
}

// ---------- Main handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, language, speed } = validateRequest(body);

    const langCode = language === "telugu" ? "te" : "en";
    const cleanText = preprocessText(text);

    if (!cleanText) {
      return new Response(
        JSON.stringify({ error: "No speakable text after preprocessing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chunks = chunkText(cleanText);
    console.log(`[Google-TTS] ${chunks.length} chunks, lang=${langCode}, speed=${speed}, len=${cleanText.length}`);

    const audioBuffers = await fetchAllChunks(chunks, langCode);

    if (audioBuffers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to generate audio from Google TTS" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const combined = concatenateBuffers(audioBuffers);
    console.log(`[Google-TTS] Success: ${combined.byteLength} bytes, ${audioBuffers.length}/${chunks.length} chunks`);

    return new Response(combined, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=7200",
        "X-TTS-Chunks": `${audioBuffers.length}/${chunks.length}`,
        "X-TTS-Speed": String(speed),
      },
    });
  } catch (e) {
    console.error("[Google-TTS] Error:", e);
    const message = e instanceof Error ? e.message : "Unknown TTS error";
    const status = message.includes("required") || message.includes("too long") ? 400 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
