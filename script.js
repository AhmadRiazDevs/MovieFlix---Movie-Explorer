class MovieExplorer {
    constructor(){
        this.API_KEY = 'd17a9bc94564698ec7d0da33b5f82eb4';
        this.BASE_URL = 'http://api.themoviedb.org/3';
        this.IMAGE_URL = 'https://image.tmdb.org/t/p/w500';
        this.FALLBACKIMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDI4MCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8y';
        this.genres = {};
        this.currentPage = 1;
        this.issearching = false;
        this.currentfilter = { genre: '',
                               year: '', 
                               sort: '' 
        }
    }   

    saveToStorage(key, value){
        try { 
            localStorage.setItem(key, JSON.stringify(value));
        } catch(e){
            console.warn('Storage error', e);
        }
    }

    loadFromStorage(key){
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch(e){
            console.warn('Storage parse error', e);
            return null;
        }
    }

    applySavedFilters(){
        const saved = this.loadFromStorage('savedFilters');
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;

        const genreSelect = document.getElementById('genreFilter');
        const yearSelect = document.getElementById('yearFilter');
        const sortSelect = document.getElementById('sortFilter');

        if (genreSelect && saved.genre) genreSelect.value = saved.genre;
        if (yearSelect && saved.year) yearSelect.value = saved.year;
        if (sortSelect && saved.sort) sortSelect.value = saved.sort;

        this.currentfilter = {
            genre: saved.genre || '',
            year: saved.year || '',
            sort: saved.sort || ''
        };
    }

    async init(){
        this.setupEventListeners();
        await this.loadGenre();
        this.setupYearFilter();
        this.applySavedFilters();
        await this.loadTrendingMovies();
        this.renderSearchHistory();
        this.renderRecentlyViewed();
        if (this.currentfilter.genre || this.currentfilter.year || this.currentfilter.sort) {
            await this.loadFilteredMovie();
        } else {
            await this.loadRandomMovies();
        }
    }

    

    setupEventListeners(){
        const searchInput = document.getElementById('searchInput');
        const genreFilter = document.getElementById('genreFilter');
        const yearFilter = document.getElementById('yearFilter');
        const sortFilter = document.getElementById('sortFilter');
        const clearBtn = document.getElementById('clearBtn');
        const trendingPrevBtn = document.getElementById('trendingPrevBtn');
        const trendingNextBtn = document.getElementById('trendingNextBtn');
        this.modal = document.getElementById('movieModal');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');

        let searchTimeout;
        searchInput.addEventListener('input', (event) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.handleSearch(event.target.value);
            }, 500);
        });

        genreFilter.addEventListener("change", ()=>this.handleFilterChange());
        yearFilter.addEventListener("change", ()=>this.handleFilterChange());
        sortFilter.addEventListener("change", ()=>this.handleFilterChange());
        clearBtn.addEventListener("click", ()=>this.clearAllFilters());
        trendingPrevBtn.addEventListener("click", ()=>this.scrollCarousel('prev'));
        trendingNextBtn.addEventListener("click", ()=>this.scrollCarousel('next'));
        this.modalCloseBtn.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.closeModal();
            }
        });

        const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
        const searchHistoryList = document.getElementById('searchHistoryList');
        const recentViewedList = document.getElementById('recentViewedList');
        const clearSearchHistoryBtn = document.getElementById('clearSearchHistoryBtn');
        const clearRecentlyViewedBtn = document.getElementById('clearRecentlyViewedBtn');

        if (searchHistoryDropdown) {
            document.addEventListener('click', (event) => {
                if (!searchHistoryDropdown.contains(event.target) && event.target.id !== 'searchInput') {
                    searchHistoryDropdown.classList.remove('open');
                }
            });
        }

        if (searchHistoryList){
            searchHistoryList.addEventListener('click', (event) => {
                const removeButton = event.target.closest('.search-history-remove');
                if (removeButton) {
                    const item = removeButton.closest('.history-item');
                    if (!item) return;
                    const query = item.dataset.search;
                    this.removeSearchHistory(query);
                    return;
                }
                const item = event.target.closest('.search-history-item');
                if (!item) return;
                const query = item.dataset.search;
                const input = document.getElementById('searchInput');
                if (input && query) {
                    input.value = query;
                    this.handleSearch(query);
                }
            });
        }

        if (searchHistoryDropdown){
            searchHistoryDropdown.addEventListener('click', (event) => {
                const removeButton = event.target.closest('.search-history-remove');
                if (removeButton) {
                    const item = removeButton.closest('.search-history-item');
                    if (!item) return;
                    const query = item.dataset.search;
                    this.removeSearchHistory(query);
                    return;
                }
                const item = event.target.closest('.search-history-item');
                if (!item) return;
                const query = item.dataset.search;
                const input = document.getElementById('searchInput');
                if (input && query) {
                    input.value = query;
                    this.handleSearch(query);
                    searchHistoryDropdown.classList.remove('open');
                }
            });
        }

        if (recentViewedList){
            recentViewedList.addEventListener('click', (event) => {
                const removeButton = event.target.closest('.history-remove');
                if (removeButton) {
                    const item = removeButton.closest('.history-item');
                    if (!item) return;
                    const itemId = item.dataset.id;
                    this.removeRecentlyViewed(itemId);
                    return;
                }
                const item = event.target.closest('.history-item');
                if (!item) return;
                const movieData = {
                    title: item.dataset.title,
                    poster: item.dataset.poster,
                    rating: item.dataset.rating,
                    year: item.dataset.year,
                    genres: item.dataset.genres,
                    overview: item.dataset.overview || 'No overview available.',
                    releaseDate: item.dataset.releaseDate
                };
                this.openModal(movieData);
            });
        }

        if (clearSearchHistoryBtn){
            clearSearchHistoryBtn.addEventListener('click', () => {
                localStorage.removeItem('searchHistory');
                this.renderSearchHistory();
            });
        }

        if (searchInput){
            searchInput.addEventListener('focus', () => this.showSearchHistoryDropdown());
            searchInput.addEventListener('input', () => this.showSearchHistoryDropdown());
        }

        if (clearRecentlyViewedBtn){
            clearRecentlyViewedBtn.addEventListener('click', () => {
                localStorage.removeItem('recentlyViewed');
                this.renderRecentlyViewed();
            });
        }
    }

    async loadGenre(){
        try{
            const response = await fetch(`${this.BASE_URL}/genre/movie/list?api_key=${this.API_KEY}`);

            const data = await response.json();

            this.genres = data.genres.reduce((acc, genre) => {
                acc[genre.id] = genre.name;
                return acc;
            }, {});
            const genreSelect = document.getElementById("genreFilter");
            data.genres.forEach(genre => {
                const option = document.createElement("option");
                option.value = genre.id;
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });

        }
        catch(error){
            console.error("Error loading genres:", error);
        }
    }

    setupYearFilter(){
        const yearSelect = document.getElementById("yearFilter");
        const currentYear = new Date().getFullYear();

        for(let year= currentYear ; year >= 1990 ; year--){
            const option = document.createElement("option");
            option.value = year;
            option.textContent=year;
            yearSelect.appendChild(option)
        }
    }

    async loadTrendingMovies(){
        try {
            const respone = await fetch(`${this.BASE_URL}/trending/movie/week?api_key=${this.API_KEY}`);
            const data = await respone.json();

            const trendingMovies = data.results.slice(0, 10);
            this.displayTrendingMovies(trendingMovies);
        } catch (error) {
            console.error('Error loading trending movies:', error);
            document.getElementById('trendingCarousel').innerHTML = 
            '<div class="Error">Error loading trending movies. Please try again later.</div>';
        }
    }

    displayTrendingMovies(movies){
        const carousel = document.getElementById('trendingCarousel');
        carousel.innerHTML = movies.map((movie, index) => 
            this.createTrendingCard(movie, index + 1)).join("");
        this.attachTrendingClickHandlers();
    }

    createTrendingCard(movie, index){
        const posterPath = movie.poster_path ? `${this.IMAGE_URL}${movie.poster_path}` : this.FALLBACKIMAGE;

        const rating = movie.vote_average ? 
        movie.vote_average.toFixed(1) : 'N/A';

        const year = movie.release_date ?
        new Date(movie.release_date).getFullYear() : 'TBA';

        const genres = movie.genre_ids ? movie.genre_ids.slice(0,2)
            .map(id => this.genres[id]).filter(Boolean).join(', ') : 'N/A';

        const overview = movie.overview ? movie.overview : 'No overview available.';
        const releaseDate = movie.release_date || 'Unknown';

        const safeTitle = (movie.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeGenres = (genres || '').replace(/"/g, '&quot;');
        const safeOverview = (overview || '').replace(/"/g, '&quot;');
        return `
        <div class="trending-card"
            data-title="${safeTitle}"
            data-poster="${posterPath}"
            data-rating="${rating}"
            data-year="${year}"
            data-genres="${safeGenres}"
            data-overview="${safeOverview}"
        >
            <img src="${posterPath}" alt="${movie.title}" class="movie-poster"
            loading="lazy" onerror="this.src='${this.FALLBACKIMAGE}'">

            <div class="trending-rank">${index}</div>
            <div class="trending-overlay">
                <div class="trending-title">${movie.title}</div>
                <div class="trending-details">
                    <span class="trending-year">${year}</span>
                    <span class="trending-rating">${rating}</span>
                </div>
                <div class="trending-genres">${genres}</div>
            </div>
        </div>
        `;
    }

    attachTrendingClickHandlers(){
        const cards = document.querySelectorAll('.trending-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const movieData = {
                    title: card.getAttribute('data-title'),
                    poster: card.getAttribute('data-poster'),
                    rating: card.getAttribute('data-rating'),
                    year: card.getAttribute('data-year'),
                    genres: card.getAttribute('data-genres'),
                    overview: card.getAttribute('data-overview')
                };
                this.openModal(movieData);
            });
        });
    }

    openModal(movieData){
        const titleEl = document.getElementById('modalTitle');
        const posterEl = document.getElementById('modalPoster');
        const metaEl = document.getElementById('modalMeta');
        const overviewEl = document.getElementById('modalOverview');

        if (titleEl) titleEl.textContent = movieData.title || 'Untitled';
        if (posterEl) {
            posterEl.src = movieData.poster || this.FALLBACKIMAGE;
            posterEl.alt = movieData.title || 'Movie poster';
        }
        if (metaEl) {
            const release = movieData.releaseDate || movieData.year || 'Unknown';
            metaEl.innerHTML = `
                <span>Year: ${movieData.year || 'TBA'}</span>
                <span>Rating: ${movieData.rating || 'N/A'}</span>
                <span>Genres: ${movieData.genres || 'N/A'}</span>
                <span>Release Date: ${release}</span>
            `;
        }
        if (overviewEl) overviewEl.textContent = movieData.overview || 'No overview available.';

        if (this.modal) this.modal.classList.add('open');
    }

    closeModal(){
        if (this.modal) this.modal.classList.remove('open');
    }



    async loadRandomMovies(){
        try{
            const randomPage = Math.floor(Math.random() * 10) + 1;
            let url = `${this.BASE_URL}/discover/movie?api_key=${this.API_KEY}&page=${randomPage}`;
            if(this.currentfilter.sort){
                url += `&sort_by=${this.currentfilter.sort}`;
            }
            if(this.currentfilter.genre){
                url += `&with_genres=${this.currentfilter.genre}`;
            }
            const response = await fetch(url);
            const data = await response.json();

            this.displayMovies(data.results, "movieGrid");

        } catch(error){
                    console.error('Error loading random movies:', error);
        document.getElementById('movieGrid').innerHTML = 
        '<div class="Error">Failed to Load movies. Please try again later.</div>';
 
        }

    }


    displayMovies(movies, containerId){
        console.log('movies: ' + JSON.stringify(movies))
        const container = document.getElementById(containerId);
        if(movies.length === 0){
            container.innerHTML = `<div class="no-results">
            <h2>No movies found</h2>
            <p>Try adjusting your search criteriaor filters.</p>
            </div>`;
            return;
        }
        container.innerHTML = movies.map(movie => 
            this.createMovieCard(movie)).join("");
    }

    createMovieCard(movie){   
        const posterPath = movie.poster_path ? `${this.IMAGE_URL}${movie.poster_path}` : this.FALLBACKIMAGE;

        const rating = movie.vote_average ? 
        movie.vote_average.toFixed(1) : 'N/A';

        const year = movie.release_date ?
        new Date(movie.release_date).getFullYear() : 'TBA';

        const description= movie.overview || "No description availabale."
        const genres = movie.genre_ids ?movie.genre_ids.slice(0,2)
        .map(id => this.genres[id]).filter(Boolean).join(', ') : 'N/A';

        return `
        <div class="movie-card">
            <img src="${posterPath}" alt="${movie.title}" class="movie-poster"
            loading="lazy"
                onerror="this.src='${this.FALLBACKIMAGE}'">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-details">
                    <span class="movie-year">${year}</span>
                    <span class="movie-rating">${rating}</span>
                </div>
                <div class="movie-genres">${genres}</div>
                <div class="movie-description">${description}</div>
            </div>
        </div>
        `;
    }

    async handleSearch(query){
        const trimmedQuery = query.trim();
        const clearBtn = document.getElementById('clearBtn');
        const sectionTitle = document.getElementById('randomSectionTitle');
        const trendingSection = document.getElementById('trendingSection');

        if(trimmedQuery === ""){
            this.issearching = false;
            clearBtn.classList.remove('show');
            sectionTitle.textContent = '🎬 Discover Movies';
            trendingSection.style.display = 'block';
            await this.loadRandomMovies();
            return; 
        }

        this.issearching = true;
        clearBtn.classList.add('show');
        sectionTitle.textContent = `🔍 Search Results for "${trimmedQuery}"`;
        trendingSection.style.display = 'none';

        try {
            document.getElementById('movieGrid').innerHTML = 
            '<div class="loading">Searching movies...</div>';

            let url = `${this.BASE_URL}/search/movie?api_key=${this.API_KEY}&query=${encodeURIComponent(trimmedQuery)}&page=1`;

            if(this.currentfilter.year) url += `&primary_release_year=${this.currentfilter.year}`;

            const response = await fetch(url);
            const data = await response.json();

            let results = data.results;
            if(this.currentfilter.genre) {
                results = results.filter(movie =>movie.genre_ids.includes
                (parseInt(this.currentfilter.genre, 10)));
            }

            if(this.currentfilter.sort) {
                results = this.sortMovies(results, this.currentfilter.sort);
            }

            this.displayMovies(results, "movieGrid");
            this.saveSearch(trimmedQuery);
            this.renderSearchHistory();
        }catch (error) {
            console.error('Error searching movies:', error);
            document.getElementById('movieGrid').innerHTML = 
            '<div class="Error">Error searching movies. Please try again later.</div>';
        }

    }

    saveSearch(query){
        const KEY = 'searchHistory';
        const max = 10;
        let list = this.loadFromStorage(KEY);
        if (!Array.isArray(list)) list = [];
        list = list.filter(item => item !== query);
        list.unshift(query);
        list = list.slice(0, max);
        this.saveToStorage(KEY, list);
        this.renderSearchHistoryDropdown();
    }

    removeSearchHistory(query){
        const KEY = 'searchHistory';
        let list = this.loadFromStorage(KEY);
        if (!Array.isArray(list)) return;
        list = list.filter(item => item !== query);
        this.saveToStorage(KEY, list);
        this.renderSearchHistory();
        this.renderSearchHistoryDropdown();
    }

    removeRecentlyViewed(itemId){
        const KEY = 'recentlyViewed';
        let list = this.loadFromStorage(KEY);
        if (!Array.isArray(list)) return;
        list = list.filter(item => `${item.title}|${item.releaseDate || item.year || ''}` !== itemId);
        this.saveToStorage(KEY, list);
        this.renderRecentlyViewed();
    }

    showSearchHistoryDropdown(){
        const dropdown = document.getElementById('searchHistoryDropdown');
        if (!dropdown) return;
        dropdown.classList.add('open');
        this.renderSearchHistoryDropdown();
    }

    renderSearchHistoryDropdown(){
        const list = this.loadFromStorage('searchHistory') || [];
        const dropdown = document.getElementById('searchHistoryDropdown');
        if (!dropdown) return;
        if (list.length === 0) {
            dropdown.innerHTML = '<div class="search-history-empty">No recent searches.</div>';
            return;
        }
        dropdown.innerHTML = list.map(item => {
            const safeText = item
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const safeLabel = item
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `
                <div class="search-history-item" data-search="${safeText}">
                    <span class="search-history-item-title">${safeLabel}</span>
                    <button class="search-history-remove" type="button">Remove</button>
                </div>
            `;
        }).join('');
    }

    saveRecentlyViewed(movieData){
        const KEY = 'recentlyViewed';
        const max = 12;
        let list = this.loadFromStorage(KEY);
        if (!Array.isArray(list)) list = [];
        const key = `${movieData.title}|${movieData.releaseDate||movieData.year||''}`;
        list = list.filter(item => `${item.title}|${item.releaseDate||item.year||''}` !== key);
        const item = {
            title: movieData.title || 'Untitled',
            poster: movieData.poster || this.FALLBACKIMAGE,
            rating: movieData.rating || 'N/A',
            year: movieData.year || 'TBA',
            genres: movieData.genres || 'N/A',
            overview: movieData.overview || 'No overview available.',
            releaseDate: movieData.releaseDate || movieData.year || 'Unknown'
        };
        list.unshift(item);
        list = list.slice(0, max);
        this.saveToStorage(KEY, list);
    }

    renderSearchHistory(){
        const list = this.loadFromStorage('searchHistory') || [];
        const container = document.getElementById('searchHistoryList');
        if (!container) return;
        const card = container.closest('.history-card');
        if (list.length === 0) {
            container.innerHTML = '<li class="history-empty">No recent searches yet.</li>';
            if (card) card.style.display = 'none';
            return;
        }
        if (card) card.style.display = 'block';
        container.innerHTML = list.map(item => {
            const safeText = item.replace(/"/g, '&quot;');
            return `
                <li class="history-item" data-search="${safeText}">
                    <span class="history-item-title">${item}</span>
                    <button class="search-history-remove" type="button">Remove</button>
                </li>`;
        }).join('');
    }

    renderRecentlyViewed(){
        const list = this.loadFromStorage('recentlyViewed') || [];
        const container = document.getElementById('recentViewedList');
        if (!container) return;
        const card = container.closest('.history-card');
        if (list.length === 0) {
            container.innerHTML = '<li class="history-empty">No recently viewed movies yet.</li>';
            if (card) card.style.display = 'none';
            return;
        }
        if (card) card.style.display = 'block';
        container.innerHTML = list.map(movie => {
            const safeTitle = (movie.title || 'Untitled').replace(/"/g, '&quot;');
            const safeGenres = (movie.genres || 'N/A').replace(/"/g, '&quot;');
            const safeOverview = (movie.overview || 'No overview available.').replace(/"/g, '&quot;');
            const itemId = `${safeTitle}|${movie.releaseDate || movie.year || ''}`;
            return `
                <li class="history-item" 
                    data-id="${itemId}"
                    data-title="${safeTitle}"
                    data-poster="${movie.poster}"
                    data-rating="${movie.rating}"
                    data-year="${movie.year}"
                    data-genres="${safeGenres}"
                    data-overview="${safeOverview}"
                    data-release-date="${movie.releaseDate}"
                >
                    <span class="history-item-title">${movie.title}</span>
                    <span class="history-item-meta">${movie.year} · ${movie.rating}</span>
                    <button class="history-remove" type="button">Remove</button>
                </li>
            `;
        }).join('');
    }

    sortMovies(movies, sortBy){
        switch(sortBy){
            case "popularity.desc":
                return movies.sort((a, b) => b.popularity - a.popularity);
            case "vote_average.desc":
                return movies.sort((a, b) => b.vote_average - a.vote_average);
            case "release_date.desc":
                return movies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
            case "title.asc":
                return movies.sort((a, b) => a.title.localeCompare(b.title));
            default:
                return movies;
        }
    }

    async handleFilterChange(){
        const searchInput = document.getElementById('searchInput');
        const genreFilter = document.getElementById('genreFilter');
        const yearFilter = document.getElementById('yearFilter');
        const sortFilter = document.getElementById('sortFilter');
        const clearBtn = document.getElementById('clearBtn');
        const trendingSection = document.getElementById("trendingSection");

        this.currentfilter={
            genre:genreFilter.value,
            year:yearFilter.value, 
            sort:sortFilter.value
        }
        this.saveToStorage('savedFilters', this.currentfilter);
        if(this.currentfilter.genre || this.currentfilter.year || 
            this.currentfilter.sort || searchInput.value.trim()){
                clearBtn.classList.add("show")
        }else {
            clearBtn.classList.remove("show")
        }

        if(searchInput.value.trim()){
            trendingSection.style.display = "none";
            await this.handleSearch(searchInput.value.trim())
        } else {
            if(this.currentfilter.genre || this.currentfilter.year ||
                this.currentfilter.sort){
                    trendingSection.style.display = "none";
                    document.getElementById("randomSectionTitle").
                    textContent = "🎬 Filtered Movies"
                }else {
                    trendingSection.style.display = "block";
                    document.getElementById("randomSectionTitle").
                    textContent = "🎬 Discover Movies"
                }
            await this.loadFilteredMovie();
        }
    }

    async loadFilteredMovie(){
        try {
            document.getElementById('movieGrid').innerHTML = 
            '<div class="loading">Loading filtered movies...</div>';

            let url = `${this.BASE_URL}/discover/movie?api_key=${this.API_KEY}&page=1`;

            if(this.currentfilter.genre){
                url += `&with_genres=${this.currentfilter.genre}`;
            }

            if(this.currentfilter.year){
                url += `&primary_release_year=${this.currentfilter.year}`;
            }

            if(this.currentfilter.sort){
                url += `&sort_by=${this.currentfilter.sort}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            
            this.displayMovies(data.results, "movieGrid");
              
        }
        catch (error) {
            console.error('Error searching movies:', error);
            document.getElementById('movieGrid').innerHTML = 
            '<div class="Error">Failed to load filtered Movies.Please try again later.</div>';
        }

    }

    clearAllFilters(){
        const trendingSection = document.getElementById("trendingSection");
        document.getElementById("searchInput").value='';
        document.getElementById("genreFilter").value='';
        document.getElementById("yearFilter").value='';
        document.getElementById("sortFilter").value='';

        document.getElementById("clearBtn").classList.remove("show");
        document.getElementById("randomSectionTitle").textContent =
         `🎬 Discover Movies`;

        trendingSection.style.display = "block";
        this.currentfilter = {
            genre:'', year:'', sort:''
        }
        localStorage.removeItem('savedFilters');
        this.issearching = false;
        this.loadRandomMovies();

    }

    scrollCarousel(direction){
        const carousel = document.getElementById("trendingCarousel");
        const scrollAmount=320;
        if(direction === "prev"){
            carousel.scrollBy({
                left: -scrollAmount,
                behavior: "smooth"
            });
        } else {
            carousel.scrollBy({
                left: scrollAmount,
                behavior: "smooth"
            });
        }
    }

}


document.addEventListener('DOMContentLoaded', () => {
    const movieExplorer = new MovieExplorer();
    movieExplorer.init();        
});