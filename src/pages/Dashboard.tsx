import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { searchMovies, getTrendingMovies, getNowPlaying, getMoviesByGenre } from '../utils/tmdb';
import { GENRE_MAP } from '../utils/tmdb';
import type { TMDBMovie } from '../utils/tmdb';
import './Dashboard.css';

interface DashboardProps {
  onRequireAuth: () => void;
  onSelectMovie: (id: number) => void;
}

interface PostPreview {
  id: number;
  content: string;
  profiles: { username: string } | null;
  likes: number;
  replyCount: number;
}

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const PLACEHOLDER = 'https://via.placeholder.com/500x750?text=No+Poster';

export default function Dashboard({ onRequireAuth, onSelectMovie }: DashboardProps) {
  const { user } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<TMDBMovie[]>([]);
  const [recentMovies, setRecentMovies] = useState<TMDBMovie[]>([]);
  const [genreMovies, setGenreMovies] = useState<TMDBMovie[]>([]);
  const [activeGenre, setActiveGenre] = useState('Action');
  const [topPosts, setTopPosts] = useState<PostPreview[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      const [trending, nowPlaying] = await Promise.all([
        getTrendingMovies(),
        getNowPlaying(),
      ]);
      setTrendingMovies(trending.slice(0, 20));
      setRecentMovies(nowPlaying.slice(0, 20));

      const { data: postsData } = await supabase
        .from('posts')
        .select('id, content, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(3);

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(p => p.id);

        const [likesRes, repliesRes] = await Promise.all([
          supabase.from('post_reactions').select('post_id').in('post_id', postIds).eq('is_like', true),
          supabase.from('replies').select('post_id').in('post_id', postIds),
        ]);

        const likeCounts: Record<number, number> = {};
        const replyCounts: Record<number, number> = {};

        if (likesRes.data) {
          likesRes.data.forEach(r => { likeCounts[r.post_id] = (likeCounts[r.post_id] || 0) + 1; });
        }
        if (repliesRes.data) {
          repliesRes.data.forEach(r => { replyCounts[r.post_id] = (replyCounts[r.post_id] || 0) + 1; });
        }

        setTopPosts((postsData as unknown as { id: number; content: string; profiles: { username: string } | null }[]).map(p => ({
          id: p.id,
          content: p.content,
          profiles: p.profiles,
          likes: likeCounts[p.id] || 0,
          replyCount: replyCounts[p.id] || 0,
        })));
      }
    };

    loadDashboardData();
  }, []);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites([]);
        return;
      }
      const { data } = await supabase.from('favorites').select('tmdb_movie_id').eq('user_id', user.id);
      if (data) setFavorites(data.map(f => f.tmdb_movie_id));
    };
    fetchFavorites();
  }, [user]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (query.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      const results = await searchMovies(query);
      setSearchResults(results || []);
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Fetch genre movies when active genre changes
  useEffect(() => {
    const genreId = GENRE_MAP[activeGenre];
    if (!genreId) return;
    getMoviesByGenre(genreId).then(results => setGenreMovies(results.slice(0, 20)));
  }, [activeGenre]);

  const handleFavoriteToggle = async (movie: TMDBMovie) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const movieIdStr = movie.id.toString();
    const isFav = favorites.includes(movieIdStr);

    if (isFav) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('tmdb_movie_id', movieIdStr);
      if (!error) setFavorites(favorites.filter(id => id !== movieIdStr));
    } else {
      const { error } = await supabase.from('favorites').insert([{
        user_id: user.id,
        tmdb_movie_id: movieIdStr,
        title: movie.title,
        poster_path: movie.poster_path
      }]);
      if (!error) setFavorites([...favorites, movieIdStr]);
    }
  };

  const posterUrl = (movie: TMDBMovie) =>
    movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : PLACEHOLDER;

  const renderCarousel = (movies: TMDBMovie[], title: string, subtitle?: string) => (
    <section className="carousel-section">
      <div className="carousel-header">
        <h2>{title}</h2>
        {subtitle && <span className="carousel-subtitle">{subtitle}</span>}
      </div>
      <div className="movie-carousel-rack">
        {movies.map(movie => {
          const isFav = favorites.includes(movie.id.toString());
          return (
            <div key={movie.id} className="carousel-card" onClick={() => onSelectMovie(movie.id)}>
              <div className="carousel-card-poster">
                <img src={posterUrl(movie)} alt={movie.title} />
                <div className="carousel-card-overlay">
                  <button
                    onClick={e => { e.stopPropagation(); handleFavoriteToggle(movie); }}
                    className={`carousel-fav-btn ${isFav ? 'active' : ''}`}
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                </div>
              </div>
              <div className="carousel-card-info">
                <span className="carousel-card-title">{movie.title}</span>
                <span className="carousel-card-year">
                  {movie.release_date?.substring(0, 4) || 'N/A'} &middot; ★ {movie.vote_average?.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const genreNames = Object.keys(GENRE_MAP);

  const renderSearchGrid = (movies: TMDBMovie[]) => (
    <div className="search-grid">
      {movies.map(movie => {
        const isFav = favorites.includes(movie.id.toString());
        return (
          <div key={movie.id} className="search-card" onClick={() => onSelectMovie(movie.id)}>
            <div className="search-card-poster">
              <img src={posterUrl(movie)} alt={movie.title} />
              <div className="search-card-overlay">
                <button
                  onClick={e => { e.stopPropagation(); handleFavoriteToggle(movie); }}
                  className={`search-fav-btn ${isFav ? 'active' : ''}`}
                >
                  {isFav ? '❤️ Saved' : '🤍 Save'}
                </button>
              </div>
            </div>
            <div className="search-card-info">
              <span className="search-card-title">{movie.title}</span>
              <span className="search-card-year">{movie.release_date?.substring(0, 4) || 'N/A'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="dashboard-container">
      <div className="search-section">
        <input
          type="text"
          className="search-bar"
          placeholder="Search movies globally..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {query.trim().length >= 2 ? (
        <section className="dashboard-block">
          <h2 className="block-title">Search Results</h2>
          {renderSearchGrid(searchResults)}
        </section>
      ) : (
        <div className="dashboard-main-layout">
          <div className="dashboard-main-content">
            {renderCarousel(trendingMovies, 'Trending & Popular Now', 'What everyone is watching this week')}

            {renderCarousel(recentMovies, 'Top Recent Movies', 'Now playing in theatres')}

            <section className="genre-section">
              <div className="genre-pills-row">
                <span className="genre-label">Genres:</span>
                {genreNames.map(name => (
                  <button
                    key={name}
                    className={`genre-pill${activeGenre === name ? ' active' : ''}`}
                    onClick={() => setActiveGenre(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>

            {renderCarousel(genreMovies, `Trending in ${activeGenre}`, `Popular ${activeGenre.toLowerCase()} films`)}
          </div>

          <aside className="dashboard-sidebar">
            <div className="sidebar-sticky-card">
              <h3>Community Pulse</h3>
              <div className="pulse-list">
                {topPosts.length === 0 && <p className="pulse-empty">No recent posts yet.</p>}
                {topPosts.map(post => (
                  <div key={post.id} className="pulse-card">
                    <div className="pulse-card-header">
                      <span className="pulse-author">@{post.profiles?.username || 'anonymous'}</span>
                    </div>
                    <p className="pulse-content">"{post.content}"</p>
                    <div className="pulse-card-footer">
                      <span className="pulse-stat">👍 {post.likes}</span>
                      <span className="pulse-stat">💬 {post.replyCount} {post.replyCount === 1 ? 'Reply' : 'Replies'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
