$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/phim/';
    const video = document.getElementById('video-player');
    let hls;

    function getUrlParameter(name) {
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
    }

    // Các regex để chặn quảng cáo
    const adRegexList = [
        new RegExp("(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)", "g"),
        /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
        /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g
    ];
    
    // Cache các Blob URL để quản lý bộ nhớ tốt hơn
    const blobCache = {};

    async function processPlaylist(url) {
        if (blobCache[url]) {
            return blobCache[url];
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch playlist: ${url}`);
        }
        let playlist = await response.text();

        // Chuyển đường dẫn tương đối thành tuyệt đối trước khi xử lý
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        playlist = playlist.replace(/(^[^#].*)$/gm, (line) => {
            return new URL(line, baseUrl).href;
        });

        // Áp dụng tất cả regex để xóa quảng cáo
        adRegexList.forEach(regex => {
            playlist = playlist.replace(regex, "");
        });

        // Tạo Blob URL cho playlist đã xử lý và lưu vào cache
        const blob = new Blob([playlist], { type: 'application/vnd.apple.mpegurl' });
        const blobUrl = URL.createObjectURL(blob);
        blobCache[url] = blobUrl;

        return blobUrl;
    }

    async function loadEpisode(m3u8Url) {
        if (Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls();

            try {
                const masterPlaylistResponse = await fetch(m3u8Url);
                if (!masterPlaylistResponse.ok) {
                    throw new Error('Failed to fetch master playlist');
                }
                let masterPlaylist = await masterPlaylistResponse.text();
                const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

                // Regex để tìm các URL playlist con trong playlist chính
                const subPlaylistRegex = /^(?!#).*m3u8.*$/gm;
                const subPlaylistUrls = masterPlaylist.match(subPlaylistRegex);

                if (subPlaylistUrls) {
                    // Nếu là playlist chính, xử lý từng playlist con
                    const processedSubPlaylistUrls = await Promise.all(
                        subPlaylistUrls.map(async (subUrl) => {
                            const absoluteSubUrl = new URL(subUrl, baseUrl).href;
                            const processedBlobUrl = await processPlaylist(absoluteSubUrl);
                            return processedBlobUrl;
                        })
                    );
                    
                    // Thay thế các URL playlist con gốc bằng các Blob URL đã xử lý
                    let subUrlIndex = 0;
                    masterPlaylist = masterPlaylist.replace(subPlaylistRegex, () => {
                        return processedSubPlaylistUrls[subUrlIndex++];
                    });
                } else {
                    // Nếu chỉ là một playlist đơn, xử lý trực tiếp
                    const processedBlobUrl = await processPlaylist(m3u8Url);
                    masterPlaylist = await fetch(processedBlobUrl).then(res => res.text());
                }

                // Tạo Blob URL cho master playlist cuối cùng và load vào HLS
                const finalBlob = new Blob([masterPlaylist], { type: 'application/vnd.apple.mpegurl' });
                const finalBlobUrl = URL.createObjectURL(finalBlob);

                hls.loadSource(finalBlobUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play();
                    // Giải phóng tất cả các Blob URL đã tạo
                    URL.revokeObjectURL(finalBlobUrl);
                    for (const key in blobCache) {
                        URL.revokeObjectURL(blobCache[key]);
                        delete blobCache[key];
                    }
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
