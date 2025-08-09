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

            // Sử dụng các regex có sẵn từ script ban đầu để loại bỏ quảng cáo
            const adRegexList = [
                new RegExp("(?<!#EXT-X-DISCONTINUITY[\\s\\S]*)#EXT-X-DISCONTINUITY\\n(?:.*?\\n){18,24}#EXT-X-DISCONTINUITY\\n(?![\\s\\S]*#EXT-X-DISCONTINUITY)", "g"),
                /#EXT-X-DISCONTINUITY\n(?:#EXT-X-KEY:METHOD=NONE\n(?:.*\n){18,24})?#EXT-X-DISCONTINUITY\n|convertv7\//g,
                /#EXT-X-DISCONTINUITY\n#EXTINF:3\.920000,\n.*\n#EXTINF:0\.760000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.500000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.420000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.780000,\n.*\n#EXTINF:1\.960000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.760000,\n.*\n#EXTINF:3\.200000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:1\.360000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:2\.000000,\n.*\n#EXTINF:0\.720000,\n.*/g
            ];
            
            adRegexList.forEach(regex => {
                playlist = playlist.replace(regex, "");
            });

            // Tạo Blob URL từ playlist đã được làm sạch
            const blob = new Blob([playlist], { type: 'application/vnd.apple.mpegurl' });
            const blobUrl = URL.createObjectURL(blob);

            hls.loadSource(blobUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
                // Giải phóng Blob URL sau khi sử dụng
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
            // Fallback nếu việc fetch playlist thất bại
            video.src = m3u8Url;
            video.addEventListener('loadedmetadata', () => video.play());
        }

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Đối với trình duyệt không hỗ trợ Hls.js
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', () => video.play());
    }
}
