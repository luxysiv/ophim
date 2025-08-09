$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/phim/';
    const video = document.getElementById('video-player');
    let hls;

    function getUrlParameter(name) {
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
    }

    async function loadEpisode(m3u8Url) {
        if (Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls();
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = m3u8Url;
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
