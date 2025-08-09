$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/phim/';
    const video = document.getElementById('video-player');
    let hls;
    const m3u8Cache = {};

    const adsRegexList = [
        /(?<!#EXT-X-DISCONTINUITY[\s\S]*)#EXT-X-DISCONTINUITY\n(?:.*?\n){18,24}#EXT-X-DISCONTINUITY\n(?![\s\S]*#EXT-X-DISCONTINUITY)/g,
        /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
        /#EXT-X-DISCONTINUITY\n#EXTINF:(?:3\.92|0\.76|2\.0|2\.5|2\.42|0\.78|1\.96|1\.76|3\.2|1\.36|0\.72)0000,\n.*\n/g
    ];
    const isContainAds = c => adsRegexList.some(r => (r.lastIndex = 0, r.test(c)));

    async function removeAdsFromM3u8(url) {
        const base = new URL(url);
        if (m3u8Cache[base]) return m3u8Cache[base];
        let text = await (await fetch(base)).text();

        text = text.replace(/^[^#].*$/gm, l => {
            try { return new URL(l, base); } catch { return l; }
        });

        if (text.includes("#EXT-X-STREAM-INF")) {
            const list = text.trim().split("\n").filter(l => l.endsWith(".m3u8"));
            return m3u8Cache[base] = await removeAdsFromM3u8(list.at(-1));
        }

        if (isContainAds(text)) adsRegexList.forEach(r => text = text.replaceAll(r, ""));
        return m3u8Cache[base] = URL.createObjectURL(new Blob([text], { type: "application/vnd.apple.mpegurl" }));
    }

    // ===== LẤY PARAM TỪ URL =====
    function getUrlParameter(name) {
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
    }

    // ===== LOAD VIDEO =====
    async function loadEpisode(m3u8Url) {
        const cleanUrl = await removeAdsFromM3u8(m3u8Url); // Chặn quảng cáo trước khi phát
        if (Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls();
            hls.loadSource(cleanUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = cleanUrl;
            video.addEventListener('loadedmetadata', () => video.play());
        }
    }

    function renderEpisodes(episodes, movieSlug, currentEpisodeSlug) {
        const episodeHtml = episodes.map(ep => `
            <li class="list-group-item bg-dark text-white border-secondary ${ep.slug === currentEpisodeSlug ? 'active' : ''}"
                data-slug="${ep.slug}" data-url="${ep.link_m3u8}">
                ${ep.name}
            </li>
        `).join('');
        $('#episodes-sidebar').html(episodeHtml);

        $('#episodes-sidebar .list-group-item').on('click', function () {
            if ($(this).hasClass('active')) return; // Chặn click trùng tập
            const newEpisodeSlug = $(this).data('slug');
            const newM3u8Url = $(this).data('url');
            window.history.pushState({}, '', `watch.html?slug=${movieSlug}&episode=${newEpisodeSlug}`);
            $('#episodes-sidebar .list-group-item').removeClass('active');
            $(this).addClass('active');
            loadEpisode(newM3u8Url);
            $('#episode-info').html(`<p class="text-muted">Đang xem: <strong>${$(this).text().trim()}</strong></p>`);
        });
    }

    const movieSlug = getUrlParameter('slug');
    let episodeSlug = getUrlParameter('episode');

    $.getJSON(API_BASE_URL + movieSlug, function (data) {
        const movie = data.data.item;
        if (!movie.episodes || movie.episodes.length === 0) {
            $('#episode-info').text('Phim chưa có dữ liệu tập.');
            return;
        }

        const episodes = movie.episodes[0].server_data;
        if (!episodeSlug) {
            episodeSlug = episodes[0].slug;
            window.history.replaceState({}, '', `watch.html?slug=${movieSlug}&episode=${episodeSlug}`);
        }

        const selectedEpisode = episodes.find(ep => ep.slug === episodeSlug);
        $('#movie-title').text(movie.name);
        $('#episode-info').html(`<p class="text-muted">Đang xem: <strong>${selectedEpisode.name}</strong></p>`);
        loadEpisode(selectedEpisode.link_m3u8);
        renderEpisodes(episodes, movieSlug, episodeSlug);
        $('title').text(`Xem Phim: ${movie.name} - ${selectedEpisode.name}`);
    });
});
