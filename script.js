const API_BASE = "https://ophim1.com/v1/api";
let APP_CDN = "";
let art = null;
let currentEpisodeBtn = null;

const adsRegexList = [
    new RegExp("(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)", "g"),
    /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
    /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g
];

const caches = { blob: {} };

function isContainAds(playlist) {
    return adsRegexList.some(regex => {
        regex.lastIndex = 0;
        return regex.test(playlist);
    });
}

async function removeAds(playlistUrl) {
    if (caches.blob[playlistUrl]) return caches.blob[playlistUrl];
    const req = await fetch(playlistUrl);
    let playlist = await req.text();
    playlist = playlist.replace(/^[^#].*$/gm, line => {
        try { return new URL(line, playlistUrl).href; } catch { return line; }
    });
    if (playlist.includes("#EXT-X-STREAM-INF")) {
        const newUrl = playlist.trim().split("\n").slice(-1)[0];
        caches.blob[playlistUrl] = await removeAds(newUrl);
        return caches.blob[playlistUrl];
    }
    if (isContainAds(playlist)) {
        playlist = adsRegexList.reduce((p, regex) => p.replaceAll(regex, ""), playlist);
    }
    const adFreeBlob = new Blob([playlist], { type: req.headers.get("Content-Type") ?? "text/plain" });
    const adFreeLink = URL.createObjectURL(adFreeBlob);
    caches.blob[playlistUrl] = adFreeLink;
    return adFreeLink;
}

async function loadHome() {
    const res = await fetch(`${API_BASE}/home`);
    const data = await res.json();
    APP_CDN = data.data.APP_DOMAIN_CDN_IMAGE;
    renderMovies(data.data.items);
}

function renderMovies(items) {
    const movieList = document.getElementById("movieList");
    movieList.innerHTML = "";
    items.forEach(movie => {
        const imgPath = movie.thumb_url.startsWith("http")
            ? movie.thumb_url
            : APP_CDN + "/uploads/movies/" + movie.thumb_url;
        const col = document.createElement("div");
        col.className = "col-md-3 mb-4 animate__animated animate__fadeInUp";
        col.innerHTML = `
            <div class="card h-100">
                <img src="${imgPath}" class="card-img-top" alt="${movie.name}">
                <div class="card-body">
                    <h6 class="card-title text-truncate">${movie.name}</h6>
                    <button class="btn btn-danger w-100" onclick="playMovie('${movie.slug}')">Xem ngay</button>
                </div>
            </div>`;
        movieList.appendChild(col);
    });
}

async function playMovie(slug) {
    const res = await fetch(`${API_BASE}/phim/${slug}`);
    const data = await res.json();
    const movie = data.data.item;
    document.getElementById("movieTitle").textContent = movie.name;
    const episodeList = document.getElementById("episodeList");
    episodeList.innerHTML = "";
    currentEpisodeBtn = null;
    movie.episodes.forEach(server => {
        const serverTitle = document.createElement("h6");
        serverTitle.className = "text-warning mt-2";
        serverTitle.textContent = server.server_name;
        episodeList.appendChild(serverTitle);
        server.server_data.forEach(ep => {
            const btn = document.createElement("button");
            btn.className = "w-100 mb-1";
            btn.textContent = ep.name;
            btn.onclick = () => loadEpisode(ep.link_m3u8, btn);
            episodeList.appendChild(btn);
        });
    });
    const firstBtn = episodeList.querySelector("button");
    if (firstBtn) firstBtn.click();
    new bootstrap.Modal(document.getElementById("playerModal")).show();
}

async function loadEpisode(link, btn) {
    if (art) {
        try { art.destroy(); } catch(e) {}
        art = null;
    }
    if (currentEpisodeBtn) currentEpisodeBtn.classList.remove("active-episode");
    btn.classList.add("active-episode");
    currentEpisodeBtn = btn;
    const adFreeLink = await removeAds(link);
    if (!window.Hls) {
        const hlsScript = document.createElement('script');
        hlsScript.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        document.head.appendChild(hlsScript);
        await new Promise(resolve => hlsScript.onload = resolve);
    }
    if (window.Hls.isSupported()) {
        const hls = new window.Hls();
        hls.loadSource(adFreeLink);
        art = new window.Artplayer({
            container: '#player',
            url: '',
            type: 'm3u8',
            autoplay: true,
            screenshot: true,
            fullscreen: true,
            miniProgressBar: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            subtitleOffset: true,
            airplay: true,
            theme: '#ff4747',
        });
        hls.attachMedia(art.video);
        art.hls = hls;
        art.on("destroy", () => {
            try { hls.destroy(); } catch(e) {}
        });
    } else {
        art = new window.Artplayer({
            container: '#player',
            url: adFreeLink,
            type: 'm3u8',
            autoplay: true,
            screenshot: true,
            fullscreen: true,
            miniProgressBar: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            subtitleOffset: true,
            airplay: true,
            theme: '#ff4747',
        });
    }
    try { art.play(); } catch(e) {}
}

const playerModalEl = document.getElementById('playerModal');
if (playerModalEl) {
    playerModalEl.addEventListener('hidden.bs.modal', () => {
        if (!art) return;
        try {
            if (art.video && typeof art.video.pause === 'function') {
                art.video.pause();
            }
            if (art.video && art.video.src) {
                try { art.video.removeAttribute('src'); } catch(e) {}
                try { art.video.load(); } catch(e) {}
            }
            if (art.hls && typeof art.hls.destroy === 'function') {
                try { art.hls.destroy(); } catch(e) {}
                art.hls = null;
            }
            if (typeof art.destroy === 'function') {
                try { art.destroy(); } catch(e) {}
            }
        } catch (e) {}
        art = null;
    });
}

document.getElementById("searchForm").addEventListener("submit", async e => {
    e.preventDefault();
    const keyword = document.getElementById("searchInput").value.trim();
    if (!keyword) return;
    const res = await fetch(`${API_BASE}/tim-kiem?keyword=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    APP_CDN = data.data.APP_DOMAIN_CDN_IMAGE || APP_CDN;
    renderMovies(data.data.items);
});

loadHome();
