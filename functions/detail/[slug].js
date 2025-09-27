// --- Config ---
const CONFIG = {
  API: {
    DETAIL: "https://ophim1.com/v1/api/phim/",
  },
  CDN: "https://img.ophim.live",
  HEADERS: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  },
};

// --- Helpers ---
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CONFIG.HEADERS,
  });
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error("fetchJSON error:", err);
    return null;
  }
}

// --- Main handler ---
async function onRequest({ request, params }) {
  const origin = new URL(request.url).origin;
  const slug = params.slug;
  const PROXY_ENDPOINT = `${origin}/m3u8-proxy`;

  if (!slug) return jsonResponse({ error: "Missing movie slug." }, 400);

  const detailData = await fetchJSON(`${CONFIG.API.DETAIL}${slug}`);
  const detailItem = detailData?.data?.item;

  if (!detailItem) return jsonResponse({ error: "Movie not found." }, 404);

  // Xử lý sources
  const sources = (detailItem.episodes || [])
    .map((server, serverIndex) => {
      const streams = (server.server_data || [])
        .map((ep, epIndex) => {
          const url = ep.link_m3u8 || ep.link_embed;
          if (!url) return null;

          const isHls = url.includes(".m3u8");
          const finalUrl = isHls
            ? `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`
            : url;

          return {
            id: `${slug}-ep-${ep.slug || epIndex}`,
            name: `Tập ${ep.name}`,
            stream_links: [
              {
                id: `${slug}-ep-${ep.slug || epIndex}-link-1`,
                name: server.server_name || `Server ${serverIndex + 1}`,
                url: finalUrl,
                type: isHls ? "hls" : "video",
                default: true,
                enableP2P: true,
              },
            ],
          };
        })
        .filter(Boolean);

      return streams.length
        ? {
            id: `${slug}-server-${serverIndex}`,
            name: server.server_name || `Server ${serverIndex + 1}`,
            contents: [
              {
                id: `${slug}-content-${serverIndex}`,
                name: "",
                streams,
              },
            ],
          }
        : null;
    })
    .filter(Boolean);

  // Response body
  const responseBody = {
    id: detailItem.slug,
    name: detailItem.name,
    title: detailItem.origin_name,
    label: [
      detailItem.episode_current,
      detailItem.quality,
      detailItem.lang,
    ]
      .filter(Boolean)
      .join(" - "),
    image: {
      url: `${CONFIG.CDN}/uploads/movies/${detailItem.thumb_url}`,
      type: "contain",
    },
    display: "default",
    type: detailItem.type,
    enable_detail: true,
    sources,
    subtitle: detailItem.lang,
  };

  return jsonResponse(responseBody);
}

export { onRequest };
