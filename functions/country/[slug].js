// --- Config ---
const CONFIG = {
  API_BASE: "https://ophim1.com/v1/api/quoc-gia",
  CDN_IMAGE: "https://img.ophim.live",
  DEFAULT_LIMIT: 24,
  DEFAULT_PAGE: 1,
  HEADERS: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  },
};

// --- Helper: tạo response JSON ---
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CONFIG.HEADERS,
  });
}

// --- Main handler ---
async function onRequest({ request, params }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const slug = params.slug;

  const page = url.searchParams.get("page") || CONFIG.DEFAULT_PAGE;
  const limit = url.searchParams.get("limit") || CONFIG.DEFAULT_LIMIT;

  if (!slug) return jsonResponse({ error: "Missing country slug." }, 400);

  try {
    const countryUrl = `${CONFIG.API_BASE}/${slug}?page=${page}&limit=${limit}`;
    const res = await fetch(countryUrl);

    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);

    const data = await res.json();
    const items = data?.data?.items || [];
    const pagination = data?.data?.params?.pagination;

    // Map ra danh sách channel
    const channels = items.map((item) => ({
      id: item.slug,
      name: item.name,
      label: `${item.episode_current} | ${item.quality} | ${item.lang}`,
      image: {
        url: `${CONFIG.CDN_IMAGE}/uploads/movies/${item.thumb_url}`,
        type: "contain",
      },
      display: "text-below",
      type: item.type,
      enable_detail: true,
      remote_data: { url: `${origin}/detail/${item.slug}` },
      sources: [],
    }));

    // Load more info
    const load_more =
      pagination && pagination.currentPage < pagination.pageRanges
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

    return jsonResponse({ channels, grid_number: 2, load_more });
  } catch (err) {
    console.error("Error in country handler:", err);
    return jsonResponse({ error: err.message }, 500);
  }
}

export { onRequest };
