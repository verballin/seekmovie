import { useState, useEffect, useRef } from 'react';
import { searchMoviesPaginated } from '../utils/tmdb';
import type { TMDBMovie } from '../utils/tmdb';
import './MovieCatalogSearch.css';

interface MovieCatalogSearchProps {
  onSelectMovie: (id: number) => void;
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = currentPage - half;
  let end = currentPage + half;
  if (start < 1) { start = 1; end = start + maxVisible - 1; }
  if (end > totalPages) { end = totalPages; start = end - maxVisible + 1; }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function MovieCatalogSearch({ onSelectMovie }: MovieCatalogSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset page when query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Debounced fetch
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setTotalPages(1);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await searchMoviesPaginated(searchQuery, currentPage);
      setResults(result.results);
      setTotalPages(result.total_pages);
      setHasSearched(true);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setCurrentPage(1);
  };

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="catalog-container" ref={resultsRef}>
      <section className="catalog-header">
        <h2>Movie Catalog Search</h2>
        <p>Search the full TMDB library — every film, every page.</p>
      </section>

      <form className="catalog-search-row" onSubmit={handleSearchSubmit}>
        <div className="catalog-search-wrapper">
          <input
            type="text"
            className="catalog-search-input"
            placeholder="Search for any movie..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="catalog-search-btn">
            🔍
          </button>
        </div>
      </form>

      {loading && <p className="catalog-status">Searching...</p>}

      {!loading && hasSearched && results.length === 0 && (
        <p className="catalog-status">No movies found for "{searchQuery}".</p>
      )}

      {results.length > 0 && (
        <>
          <div className="catalog-grid">
            {results.map(movie => (
              <div key={movie.id} className="catalog-card">
                <div className="catalog-card-poster">
                  <img
                    src={
                      movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : 'https://via.placeholder.com/500x750?text=No+Poster'
                    }
                    alt={movie.title}
                  />
                </div>
                <div className="catalog-card-info">
                  <h3 className="catalog-card-title">{movie.title}</h3>
                  <div className="catalog-card-meta">
                    <span className="catalog-card-year">
                      {movie.release_date?.substring(0, 4) || 'N/A'}
                    </span>
                    <span className="catalog-card-rating">
                      ★ {movie.vote_average?.toFixed(1) || '?'}
                    </span>
                  </div>
                  <button
                    className="catalog-view-btn"
                    onClick={() => onSelectMovie(movie.id)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="catalog-pagination">
              <button
                className="pagination-edge-btn"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                &lt; Prev
              </button>

              {pageNumbers.map(p => (
                <button
                  key={p}
                  className={`pagination-num-btn${p === currentPage ? ' active' : ''}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ))}

              <button
                className="pagination-edge-btn"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next &gt;
              </button>
            </div>
          )}
        </>
      )}

      {!hasSearched && searchQuery.trim().length < 2 && (
        <div className="catalog-empty">
          <p>Enter at least 2 characters to start browsing the movie catalog.</p>
        </div>
      )}
    </div>
  );
}
