// --- Config ---
const CONFIG = {
  MIME: "application/vnd.apple.mpegurl",
  HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
};

// --- Clean playlist manifest ---
function cleanManifest(manifest) {
  const rules = [
    [/\n#EXT-X-DISCONTINUITY\n#EXT-X-KEY:METHOD=NONE[\s\S]*?#EXT-X-DISCONTINUITY\n/g, "\n"],
    [/\n#EXT-X-DISCONTINUITY(?:\n#EXTINF:[\d.]+,\n.*?){10,18}\n#EXT-X-DISCONTINUITY/g, "\n"],
    [/#EXT-X-DISCONTINUITY\n/g, ""],
    [/\/convertv7\//g, "/"],
    [/\n{2,}/g, "\n"],
  ];

  return rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), manifest).trim();
}

// --- Fetch & process playlist ---
async function fetchAndProcessPlaylist(playlistUrl) {
  let res;
  try {
    res = await fetch(playlistUrl);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
  } catch (err) {
    console.error("Fetch error:", err.message);
    throw new Error("Không tải được playlist gốc.");
  }

  let text = await res.text();

  // Chuẩn hóa relative URL thành absolute URL
  text = text.replace(/^[^#].*$/gm, (line) => {
    try {
      return new URL(line, playlistUrl).toString();
    } catch {
      return line;
    }
  });

  // Nếu là master playlist → đệ quy xử lý sub-playlist
  if (text.includes("#EXT-X-STREAM-INF")) {
    const lines = text.split("\n");
    const subUrl = lines.find((line, i) => lines[i - 1]?.includes("#EXT-X-STREAM-INF"));

    if (subUrl) {
      try {
        return fetchAndProcessPlaylist(new URL(subUrl, playlistUrl).toString());
      } catch {
        console.error("Invalid sub-playlist URL:", subUrl);
      }
    }
  }

  return cleanManifest(text);
}

// --- Cloudflare Worker handler ---
async function onRequest({ request }) {
  const url = new URL(request.url);
  const playlistUrl = url.searchParams.get("url");

  if (!playlistUrl) {
    return new Response(JSON.stringify({ error: "Missing 'url' query parameter." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CONFIG.HEADERS },
    });
  }

  try {
    const manifest = await fetchAndProcessPlaylist(playlistUrl);

    return new Response(manifest, {
      status: 200,
      headers: { "Content-Type": CONFIG.MIME, ...CONFIG.HEADERS },
    });
  } catch (err) {
    console.error("M3U8 Proxy Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CONFIG.HEADERS },
    });
  }
}

export { onRequest };
