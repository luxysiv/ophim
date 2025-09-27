// --- Config ---
const CONFIG = {
  API: {
    SEARCH: "https://ophim1.com/v1/api/tim-kiem",
  },
  SUGGESTION_LIMIT: 25,
  HEADERS: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  },
};

// --- Helpers ---
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
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
async function onRequest({ request }) {
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q");

  if (!keyword || keyword.length < 2) {
    return jsonResponse([]);
  }

  const searchUrl = `${CONFIG.API.SEARCH}?keyword=${encodeURIComponent(
    keyword
  )}&limit=${CONFIG.SUGGESTION_LIMIT}`;

  const data = await fetchJSON(searchUrl);
  if (!data?.data?.items) return jsonResponse([]);

  const suggestions = [...new Set(data.data.items.map((item) => item.name))];

  return jsonResponse(suggestions);
}

export { onRequest };
