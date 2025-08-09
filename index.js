$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/';
    const CDN_IMAGE_URL = 'https://img.ophim.live/uploads/movies/';

    function renderMovies(movies) {
        let movieHtml = '';
        if (movies && movies.length > 0) {
            movies.forEach(movie => {
                const posterUrl = CDN_IMAGE_URL + movie.thumb_url;
                movieHtml += `
                    <div class="col">
                        <a href="movie.html?slug=${movie.slug}" class="card-link">
                            <div class="card h-100 shadow-sm">
                                <img src="${posterUrl}" class="card-img-top" alt="${movie.name}">
                                <div class="card-body">
                                    <h5 class="card-title">${movie.name}</h5>
                                    <p class="card-text text-muted">${movie.origin_name}</p>
                                </div>
                                <div class="card-footer">
                                    <small class="text-muted">Tập: ${movie.episode_current} - Chất lượng: ${movie.quality}</small>
                                </div>
                            </div>
                        </a>
                    </div>
                `;
            });
        } else {
            movieHtml = '<div class="col-12"><p class="text-center text-muted">Không tìm thấy phim nào.</p></div>';
        }
        $('#movie-list').html(movieHtml);
    }

    function loadHome() {
        const apiUrl = `${API_BASE_URL}home`;
        $.getJSON(apiUrl, function (data) {
            if (data.status === 'success') {
                renderMovies(data.data.items);
            }
        });
    }
    
    function populateFilters(page) {
        $.getJSON(API_BASE_URL + 'the-loai', function (data) {
            if (data.status === 'success') {
                const genres = data.data.items;
                let genreHtml = genres.map(genre =>
                    `<li><a class="dropdown-item" href="genre.html?slug=${genre.slug}?page=1">${genre.name}</a></li>`
                ).join('');
                $('#genres-list').html(genreHtml);
            }
        });

        $.getJSON(API_BASE_URL + 'quoc-gia', function (data) {
            if (data.status === 'success') {
                const countries = data.data.items;
                let countryHtml = countries.map(country =>
                    `<li><a class="dropdown-item" href="country.html?slug=${country.slug}?page=1">${country.name}</a></li>`
                ).join('');
                $('#countries-list').html(countryHtml);
            }
        });
    }
    
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    function loadSearchResults(searchQuery) {
        const apiUrl = `${API_BASE_URL}tim-kiem?keyword=${encodeURIComponent(searchQuery)}`;
        $.getJSON(apiUrl, function (data) {
            if (data.status === 'success') {
                renderMovies(data.data.items);
                $('#pagination').html('');
                $('#main-content').prepend(`<h1 class="mb-4 text-center">Kết quả tìm kiếm cho: "${searchQuery}"</h1>`);
            }
        });
    }

    $('#search-form').on('submit', function (e) {
        e.preventDefault();
        const searchQuery = $('#search-input').val();
        if (searchQuery) {
            loadSearchResults(searchQuery);
            $('#movie-list').html('<div class="col-12"><p class="text-center text-muted">Đang tìm kiếm...</p></div>');
            $('#page-title').text(`Kết quả tìm kiếm cho: "${searchQuery}"`);
        }
    });

    const searchQuery = getUrlParameter('keyword');
    if (searchQuery) {
        loadSearchResults(searchQuery);
    } else {
        loadHome();
    }
    
    populateFilters();
});
