// --- Config ---
const CONFIG = {
  API: {
    CATEGORIES: "https://ophim1.com/v1/api/the-loai",
    COUNTRIES: "https://ophim1.com/v1/api/quoc-gia",
    HOME: "https://ophim1.com/v1/api/home",
    GENRE: "https://ophim1.com/v1/api/the-loai",
    COUNTRY: "https://ophim1.com/v1/api/quoc-gia",
    LIST: "https://ophim1.com/v1/api/danh-sach",
  },
  STATIC_LIST_TYPES: [
    { name: "Phim mới", slug: "phim-moi" },
    { name: "Phim bộ", slug: "phim-bo" },
    { name: "Phim lẻ", slug: "phim-le" },
    { name: "Hoạt hình", slug: "hoat-hinh" },
    { name: "Phim Thuyết Minh", slug: "phim-thuyet-minh" },
    { name: "Phim Lồng Tiếng", slug: "phim-long-tieng" },
    { name: "TV Shows", slug: "tv-shows" },
  ],
  MAIN_GROUPS: [
    { id: "list-phim-bo", name: "Phim Bộ Mới", type: "list", slug: "phim-bo" },
    { id: "list-phim-le", name: "Phim Lẻ Mới", type: "list", slug: "phim-le" },
    { id: "list-hoat-hinh", name: "Phim Hoạt Hình", type: "list", slug: "hoat-hinh" },
    { id: "genre-hanh-dong", name: "Phim Hành Động", type: "genre", slug: "hanh-dong" },
    { id: "country-trung-quoc", name: "Phim Trung Quốc", type: "country", slug: "trung-quoc" },
    { id: "country-han-quoc", name: "Phim Hàn Quốc", type: "country", slug: "han-quoc" },
    { id: "country-au-my", name: "Phim Âu Mỹ", type: "country", slug: "au-my" },
    { id: "country-nhat-ban", name: "Phim Nhật Bản", type: "country", slug: "nhat-ban" },
    { id: "country-viet-nam", name: "Phim Việt Nam", type: "country", slug: "viet-nam" },
    { id: "list-thuyet-minh", name: "Phim Thuyết Minh", type: "list", slug: "phim-thuyet-minh" },
    { id: "list-long-tieng", name: "Phim Lồng Tiếng", type: "list", slug: "phim-long-tieng" },
  ],
};

// --- Cache config ---
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 3 giờ
const REFRESH_THRESHOLD_MS = 2.75 * 60 * 60 * 1000; // 2h45

// --- Helpers ---
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch (err) {
    console.error(`Fetch error: ${url}`, err);
    return null;
  }
}

function buildSortOptions(origin, items, prefix) {
  const allOption = { type: "radio", text: "Tất cả", url: origin };
  const mapped = items.map((it) => ({
    type: "radio",
    text: it.name,
    url: `${origin}/${prefix}/${it.slug}`,
  }));
  return [allOption, ...mapped];
}

function mapItemsToChannels(items, origin, cdn) {
  return items.map((item) => ({
    id: item.slug,
    name: item.name,
    label: `${item.episode_current} | ${item.quality} | ${item.lang}`,
    image: { url: `${cdn}/uploads/movies/${item.thumb_url}`, type: "contain" },
    display: "text-below",
    type: item.type,
    enable_detail: true,
    remote_data: { url: `${origin}/detail/${item.slug}` },
    sources: [],
  }));
}

async function fetchGroupChannels(group, origin, cdn) {
  const limit = 10;
  const baseUrl = CONFIG.API[group.type.toUpperCase()];
  if (!baseUrl) return [];

  const data = await fetchJSON(`${baseUrl}/${group.slug}?page=1&limit=${limit}`);
  const items = data?.data?.items || [];
  return mapItemsToChannels(items.slice(0, limit), origin, cdn);
}

// --- Cache logic wrapper ---
export async function onRequest(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url);
  const now = Date.now();

  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const cachedAt = parseInt(cachedResponse.headers.get("X-Cache-Date") || "0");
    const age = now - cachedAt;

    // Nếu cache còn hiệu lực
    if (age < CACHE_TTL_MS) {
      // Nếu gần hết hạn, làm mới ngầm
      if (age > REFRESH_THRESHOLD_MS) {
        context.waitUntil(refreshCache(context, cacheKey));
      }
      const clone = new Response(cachedResponse.body, cachedResponse);
      clone.headers.set("X-Cache", "HIT");
      clone.headers.set("X-Cache-Age", `${Math.round(age / 1000)}s`);
      clone.headers.set(
        "Cache-Control",
        `public, s-maxage=${CACHE_TTL_MS / 1000}, stale-while-revalidate=600`
      );
      return clone;
    }
  }

  // Không có cache hoặc hết hạn
  const fresh = await generateResponse(context);
  fresh.headers.set("X-Cache-Date", `${now}`);
  fresh.headers.set("X-Cache", cachedResponse ? "STALE→FRESH" : "MISS");
  fresh.headers.set(
    "Cache-Control",
    `public, s-maxage=${CACHE_TTL_MS / 1000}, stale-while-revalidate=600`
  );

  context.waitUntil(cache.put(cacheKey, fresh.clone()));
  return fresh;
}

// Làm mới cache ngầm
async function refreshCache(context, cacheKey) {
  const cache = caches.default;
  try {
    const fresh = await generateResponse(context);
    fresh.headers.set("X-Cache-Date", `${Date.now()}`);
    fresh.headers.set("X-Cache", "REFRESHED");
    fresh.headers.set(
      "Cache-Control",
      `public, s-maxage=${CACHE_TTL_MS / 1000}, stale-while-revalidate=600`
    );
    await cache.put(cacheKey, fresh.clone());
    console.log("✅ Cache refreshed:", cacheKey.url);
  } catch (err) {
    console.error("❌ Failed to refresh cache:", err);
  }
}

// --- Build full JSON response ---
async function generateResponse({ request }) {
  const origin = new URL(request.url).origin;
  const responseBody = {
    id: "ophim-provider",
    name: "Ổ phim",
    description:
      "Website cung cấp phim miễn phí nhanh chất lượng cao. Phim online VietSub, Thuyết minh, lồng tiếng chất lượng Full HD.",
    url: origin,
    color: "#181818",
    image: { url: `${origin}/logo.png`, type: "contain", height: 187, width: 28 },
    grid_number: 3,
    search: {
      url: `${origin}/search`,
      search_key: "q",
      paging: { page_key: "page", size_key: "limit" },
      suggest_url: `${origin}/suggestions`,
    },
    sorts: [],
    groups: [],
  };

  try {
    // Sort dropdowns
    responseBody.sorts.push({
      type: "dropdown",
      text: "Loại phim",
      value: buildSortOptions(origin, CONFIG.STATIC_LIST_TYPES, "list"),
    });

    const categoriesData = await fetchJSON(CONFIG.API.CATEGORIES);
    if (categoriesData?.data?.items) {
      responseBody.sorts.push({
        type: "dropdown",
        text: "Thể loại",
        value: buildSortOptions(origin, categoriesData.data.items, "genre"),
      });
    }

    const countriesData = await fetchJSON(CONFIG.API.COUNTRIES);
    if (countriesData?.data?.items) {
      responseBody.sorts.push({
        type: "dropdown",
        text: "Quốc gia",
        value: buildSortOptions(origin, countriesData.data.items, "country"),
      });
    }

    // Home
    const homeData = await fetchJSON(CONFIG.API.HOME);
    if (!homeData) throw new Error("Failed to fetch home data");

    const cdn = homeData.data.APP_DOMAIN_CDN_IMAGE || "https://img.ophim.live";

    // Slider phim mới
    responseBody.groups.push({
      id: "ophim-all",
      display: "slider",
      grid_number: 1,
      enable_detail: true,
      channels: mapItemsToChannels(homeData.data.items, origin, cdn),
    });

    // Các nhóm bổ sung
    for (const group of CONFIG.MAIN_GROUPS) {
      const channels = await fetchGroupChannels(group, origin, cdn);
      responseBody.groups.push({
        id: group.id,
        name: group.name,
        display: "horizontal",
        grid_number: 1,
        enable_detail: true,
        channels,
        remote_data: { url: `${origin}/${group.type}/${group.slug}` },
      });
    }

    return new Response(JSON.stringify(responseBody), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Error in home handler:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
                                        }
