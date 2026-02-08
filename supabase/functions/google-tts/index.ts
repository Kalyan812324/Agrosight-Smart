import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Language codes for Google TTS
    const langCode = language === "telugu" ? "te" : "en";
    
    // Split long text into chunks (Google TTS has ~200 char limit per request)
    const maxChunkSize = 180;
    const chunks: string[] = [];
    let remainingText = text.trim();
    
    while (remainingText.length > 0) {
      if (remainingText.length <= maxChunkSize) {
        chunks.push(remainingText);
        break;
      }
      
      // Find a good break point (space, comma, period)
      let breakPoint = maxChunkSize;
      const searchArea = remainingText.slice(0, maxChunkSize);
      
      // Look for sentence endings first
      const lastPeriod = Math.max(
        searchArea.lastIndexOf('।'), // Telugu period
        searchArea.lastIndexOf('.'),
        searchArea.lastIndexOf('!'),
        searchArea.lastIndexOf('?')
      );
      
      if (lastPeriod > maxChunkSize / 2) {
        breakPoint = lastPeriod + 1;
      } else {
        // Look for comma or space
        const lastComma = searchArea.lastIndexOf(',');
        const lastSpace = searchArea.lastIndexOf(' ');
        breakPoint = Math.max(lastComma, lastSpace);
        if (breakPoint < maxChunkSize / 2) {
          breakPoint = maxChunkSize;
        }
      }
      
      chunks.push(remainingText.slice(0, breakPoint).trim());
      remainingText = remainingText.slice(breakPoint).trim();
    }

    console.log(`Processing ${chunks.length} chunks for ${langCode}`);

    // Fetch audio for each chunk and concatenate
    const audioBuffers: ArrayBuffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const encodedText = encodeURIComponent(chunk);
      
      // Use Google Translate TTS endpoint
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`;
      
      console.log(`Fetching chunk ${i + 1}/${chunks.length}: "${chunk.slice(0, 50)}..."`);
      
      const response = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/",
        },
      });

      if (!response.ok) {
        console.error(`Google TTS chunk ${i + 1} failed:`, response.status);
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 0) {
        audioBuffers.push(buffer);
      }
    }

    if (audioBuffers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to generate audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Concatenate all audio buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of audioBuffers) {
      combinedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    console.log(`Successfully generated ${combinedBuffer.byteLength} bytes of audio`);

    return new Response(combinedBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("Google TTS error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown TTS error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
