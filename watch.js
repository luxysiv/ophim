$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/phim/';
    const videoElement = document.getElementById('video-player');
    const videoWrapper = document.getElementById('video-wrapper');
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

        const dataUri = "data:application/vnd.apple.mpegurl;base64," +
                        btoa(unescape(encodeURIComponent(text)));
        return m3u8Cache[base] = dataUri;
    }

    function getUrlParameter(name) {
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
    }

    async function loadEpisode(m3u8Url) {
        try {
            const cleanUrl = await removeAdsFromM3u8(m3u8Url);
            player.src({
                src: cleanUrl,
                type: 'application/vnd.apple.mpegurl'
            });

            player.muted(true);
            player.play().catch(() => {
                console.warn("Autoplay bị chặn, chờ người dùng bấm play");
            });
        } catch (err) {
            console.error("Lỗi khi load video:", err);
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
            if ($(this).hasClass('active')) return;
            const newEpisodeSlug = $(this).data('slug');
            const newM3u8Url = $(this).data('url');
            window.history.pushState({}, '', `watch.html?slug=${movieSlug}&episode=${newEpisodeSlug}`);
            $('#episodes-sidebar .list-group-item').removeClass('active');
            $(this).addClass('active');
            loadEpisode(newM3u8Url);
            $('#episode-info').html(`<p class="text-muted">Đang xem: <strong>${$(this).text().trim()}</strong></p>`);
        });
    }

    const player = videojs(videoElement, {
        autoplay: 'muted',
        muted: true,
        controls: true,
        preload: 'auto',
        fluid: true,
        controlBar: {
            volumePanel: { inline: false }
        }
    });

    // Double tap tua 10s + Ripple
    let lastTapTime = 0;
    videoWrapper.addEventListener('touchend', function (e) {
        const currentTime = Date.now();
        const tapX = e.changedTouches[0].clientX;
        const screenWidth = window.innerWidth;

        if (currentTime - lastTapTime < 300) {
            if (tapX < screenWidth / 2) {
                player.currentTime(player.currentTime() - 10);
                showTapIndicator('left');
            } else {
                player.currentTime(player.currentTime() + 10);
                showTapIndicator('right');
            }
            createRipple(tapX, e.changedTouches[0].clientY);
        }
        lastTapTime = currentTime;
    });

    function showTapIndicator(side) {
        const el = document.querySelector(side === 'left' ? '.tap-left' : '.tap-right');
        el.classList.add('tap-show');
        setTimeout(() => el.classList.remove('tap-show'), 500);
    }

    function createRipple(x, y) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        ripple.style.left = `${x - videoWrapper.getBoundingClientRect().left}px`;
        ripple.style.top = `${y - videoWrapper.getBoundingClientRect().top}px`;
        videoWrapper.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
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
