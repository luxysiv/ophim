// --- Config ---
const CONFIG = {
  API: {
    GENRE: "https://ophim1.com/v1/api/the-loai/",
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
  const url = new URL(request.url);
  const slug = params.slug;
  const page = url.searchParams.get("page") || 1;
  const limit = url.searchParams.get("limit") || 24;
  const detailBaseUrl = `${url.origin}/detail`;

  if (!slug) return jsonResponse({ error: "Missing genre slug." }, 400);

  const genreUrl = `${CONFIG.API.GENRE}${slug}?page=${page}&limit=${limit}`;
  const data = await fetchJSON(genreUrl);
  const items = data?.data?.items || [];
  const pagination = data?.data?.params?.pagination;

  if (!items.length) return jsonResponse({ channels: [] });

  // Build channel list
  const channels = items.map((item) => ({
    id: item.slug,
    name: item.name,
    label: `${item.episode_current} | ${item.quality} | ${item.lang}`,
    image: {
      url: `${CONFIG.CDN}/uploads/movies/${item.thumb_url}`,
      type: "contain",
    },
    display: "text-below",
    type: item.type,
    enable_detail: true,
    remote_data: { url: `${detailBaseUrl}/${item.slug}` },
    sources: [],
  }));

  // Response body
  const responseBody = {
    grid_number: 2,
    channels,
    load_more:
      pagination &&
      pagination.currentPage < pagination.pageRanges && {
        remote_data: { url: url.toString() },
        paging: { page_key: "page", size_key: "limit" },
        pageInfo: {
          current_page: pagination.currentPage,
          total: pagination.totalItems,
          per_page: pagination.totalItemsPerPage,
          last_page: pagination.pageRanges,
        },
      },
  };

  return jsonResponse(responseBody);
}

export { onRequest };
