// --- Config ---
const CONFIG = {
  API: {
    SEARCH: "https://ophim1.com/v1/api/tim-kiem",
  },
  CDN_IMAGE: "https://img.ophim.live",
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 24,
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
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch (err) {
    console.error("Fetch error:", url, err);
    return null;
  }
}

function mapItemsToChannels(items, origin, cdn) {
  return items.map((item) => ({
    id: item.slug,
    name: item.name,
    label: `${item.episode_current} | ${item.quality} | ${item.lang}`,
    image: {
      url: `${cdn}/uploads/movies/${item.thumb_url}`,
      type: "contain",
    },
    display: "text-below",
    type: item.type,
    enable_detail: true,
    remote_data: { url: `${origin}/detail/${item.slug}` },
    sources: [],
  }));
}

// --- Main handler ---
async function onRequest({ request }) {
  const url = new URL(request.url);
  const origin = url.origin;

  const keyword = url.searchParams.get("q");
  const page = url.searchParams.get("page") || CONFIG.DEFAULT_PAGE;
  const limit = url.searchParams.get("limit") || CONFIG.DEFAULT_LIMIT;

  if (!keyword) return jsonResponse({ channels: [] });

  try {
    const searchUrl = `${CONFIG.API.SEARCH}?keyword=${encodeURIComponent(
      keyword
    )}&page=${page}&limit=${limit}`;

    const data = await fetchJSON(searchUrl);
    if (!data?.data?.items) return jsonResponse({ channels: [] });

    let items = data.data.items;
    
    items.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;

      if (yearA !== yearB) {
        return yearB - yearA;
      }
      
      return 0;
    });

    const pagination = data.data.params.pagination;
    const channels = mapItemsToChannels(items, origin, CONFIG.CDN_IMAGE);

    const load_more =
      pagination.currentPage < pagination.pageRanges
        ? {
            remote_data: { url: url.toString() },
            paging: { page_key: "page", size_key: "limit" },
            pageInfo: {
              current_page: pagination.currentPage,
              total: pagination.totalItems,
              per_page: pagination.totalItemsPerPage,
              last_page: pagination.pageRanges,
            },
          }
        : undefined;

    return jsonResponse({ grid_number: 2, channels, load_more });
  } catch (err) {
    console.error("Error in search handler:", err);
    return jsonResponse({ error: err.message }, 500);
  }
}

export { onRequest };
