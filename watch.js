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

            try {
                const response = await fetch(m3u8Url);
                if (!response.ok) {
                    throw new Error('Failed to fetch m3u8 playlist');
                }
                let playlist = await response.text();

                // Lấy base URL từ m3u8Url gốc để xử lý đường dẫn tương đối
                const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

                // Chuyển tất cả các đường dẫn tương đối thành tuyệt đối
                playlist = playlist.replace(/(^[^#].*)$/gm, (line) => {
                    return new URL(line, baseUrl).href;
                });
                
                // Sử dụng các regex có sẵn từ script ban đầu để loại bỏ quảng cáo
                const adRegexList = [
                    new RegExp("(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)", "g"),
                    /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
                    /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g
                ];
                
                adRegexList.forEach(regex => {
                    playlist = playlist.replace(regex, "");
                });

                // Tạo Blob URL từ playlist đã được làm sạch và đã xử lý đường dẫn
                const blob = new Blob([playlist], { type: 'application/vnd.apple.mpegurl' });
                const blobUrl = URL.createObjectURL(blob);

                hls.loadSource(blobUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play();
                    URL.revokeObjectURL(blobUrl);
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error('HLS Error:', data);
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.log('Network error, trying to recover...');
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log('Media error, trying to recover...');
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
                                break;
                        }
                    }
                });

            } catch (error) {
                console.error('Error loading HLS video:', error);
                video.src = m3u8Url;
                video.addEventListener('loadedmetadata', () => video.play());
            }

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
