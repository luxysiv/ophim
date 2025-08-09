$(document).ready(function () {
    const API_BASE_URL = 'https://ophim1.com/v1/api/';
    const CDN_IMAGE_URL = 'https://img.ophim.live/uploads/movies/';

    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        const results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

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

    function renderPagination(currentPage, totalPages, slug) {
        if (totalPages <= 1) {
            $('#pagination').html('');
            return;
        }

        let paginationHtml = '<ul class="pagination justify-content-center">';
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (currentPage > 1) {
            paginationHtml += `<li class="page-item"><a class="page-link" href="genre.html?slug=${slug}&page=${currentPage - 1}"><i class="fas fa-angle-left"></i></a></li>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            paginationHtml += `
                <li class="page-item ${active}">
                    <a class="page-link" href="genre.html?slug=${slug}&page=${i}">${i}</a>
                </li>
            `;
        }
        
        if (currentPage < totalPages) {
             paginationHtml += `<li class="page-item"><a class="page-link" href="genre.html?slug=${slug}&page=${currentPage + 1}"><i class="fas fa-angle-right"></i></a></li>`;
        }
        
        paginationHtml += '</ul>';
        $('#pagination').html(paginationHtml);
    }
    
    function loadGenreMovies(genreSlug, page = 1) {
        const apiUrl = `${API_BASE_URL}the-loai/${genreSlug}?page=${page}`;
        $.getJSON(apiUrl, function (data) {
            if (data.status === 'success') {
                renderMovies(data.data.items);
                renderPagination(data.data.pagination.currentPage, data.data.pagination.totalPages, genreSlug);
                $('#page-title').text(`Phim Thể Loại: ${data.data.titlePage} 🎥`);
                $('title').text(`Phim Thể Loại: ${data.data.titlePage}`);
            }
        });
    }

    function populateFilters() {
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

    $('#search-form').on('submit', function (e) {
        e.preventDefault();
        const searchQuery = $('#search-input').val();
        if (searchQuery) {
            window.location.href = `index.html?keyword=${encodeURIComponent(searchQuery)}`;
        }
    });

    const genreSlug = getUrlParameter('slug');
    const page = parseInt(getUrlParameter('page')) || 1;

    if (genreSlug) {
        loadGenreMovies(genreSlug, page);
    } else {
        $('#movie-list').html('<div class="col-12"><p class="text-center text-muted">Vui lòng chọn một thể loại từ menu.</p></div>');
    }
    
    populateFilters();
});
