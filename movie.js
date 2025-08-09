$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/phim/';
    const CDN_IMAGE_URL = 'https://img.ophim.live/uploads/movies/';

    function getUrlParameter(name) {
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results ? decodeURIComponent(results[1].replace(/\+/g, ' ')) : '';
    }

    const movieSlug = getUrlParameter('slug');

    $.getJSON(API_BASE_URL + movieSlug, function (data) {
        const movie = data.data.item;
        const posterUrl = CDN_IMAGE_URL + movie.poster_url;
        const actors = movie.actor.join(', ');
        const categories = movie.category.map(cat => cat.name).join(', ');
        const countries = movie.country.map(coun => coun.name).join(', ');
        const content = movie.content;
        const episodes = movie.episodes[0].server_data;

        const movieHtml = `
            <div class="row">
                <div class="col-md-4 text-center">
                    <img src="${posterUrl}" class="movie-poster" alt="${movie.name}">
                </div>
                <div class="col-md-8 mt-4 mt-md-0">
                    <h2>${movie.name} (${movie.year})</h2>
                    <p class="text-muted">${movie.origin_name}</p>
                    <p><strong><i class="fas fa-info-circle text-danger"></i> Trạng thái:</strong> ${movie.status}</p>
                    <p><strong><i class="far fa-clock text-danger"></i> Thời lượng:</strong> ${movie.time}</p>
                    <p><strong><i class="fas fa-tags text-danger"></i> Thể loại:</strong> ${categories}</p>
                    <p><strong><i class="fas fa-globe text-danger"></i> Quốc gia:</strong> ${countries}</p>
                    <p><strong><i class="fas fa-users text-danger"></i> Diễn viên:</strong> ${actors}</p>
                    <p><strong><i class="fas fa-file-alt text-danger"></i> Mô tả:</strong> ${content}</p>

                    <h4 class="mt-4">Danh sách tập</h4>
                    <div class="episode-list row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2 mt-2">
                        ${episodes.map(episode => `
                            <div class="col">
                                <a href="watch.html?slug=${movie.slug}&episode=${episode.slug}" class="btn btn-outline-danger w-100">${episode.name}</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        $('#movie-detail').html(movieHtml);
        $('title').text(`Chi Tiết Phim: ${movie.name}`);
    });
});
