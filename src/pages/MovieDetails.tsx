import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { getMovieDetails } from '../utils/tmdb';
import type { TMDBMovieDetails } from '../utils/tmdb';
import './MovieDetails.css';

interface MovieDetailsProps {
  movieId: number;
  onBack: () => void;
  onRequireAuth: () => void;
}

export default function MovieDetails({ movieId, onBack, onRequireAuth }: MovieDetailsProps) {
  const { user } = useContext(AuthContext);
  const [movie, setMovie] = useState<TMDBMovieDetails | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const details = await getMovieDetails(movieId);
      setMovie(details);
      setLoading(false);
    };
    load();
  }, [movieId]);

  useEffect(() => {
    if (!user || !movie) return;
    supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('tmdb_movie_id', movie.id.toString())
      .single()
      .then(({ data }) => setIsFav(!!data));
  }, [user, movie]);

  const toggleFavorite = async () => {
    if (!user) { onRequireAuth(); return; }
    if (!movie) return;
    const movieIdStr = movie.id.toString();
    if (isFav) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('tmdb_movie_id', movieIdStr);
      if (!error) setIsFav(false);
    } else {
      const { error } = await supabase.from('favorites').insert([{ user_id: user.id, tmdb_movie_id: movieIdStr, title: movie.title, poster_path: movie.poster_path }]);
      if (!error) setIsFav(true);
    }
  };

  if (loading) return <div className="details-loading">Loading...</div>;
  if (!movie) return <div className="details-error">Failed to load movie details.</div>;

  return (
    <div className="details-container">
      <button className="back-btn" onClick={onBack}>← Back</button>
      {movie.backdrop_path && (
        <div className="details-backdrop" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/w1280${movie.backdrop_path})` }} />
      )}
      <div className="details-content">
        <div className="details-poster-col">
          <img
            className="details-poster-img"
            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster'}
            alt={movie.title}
          />
        </div>
        <div className="details-info-col">
          <h1 className="details-title">{movie.title}</h1>
          <div className="details-meta-row">
            <span>{movie.release_date?.substring(0, 4) || 'N/A'}</span>
            {movie.runtime > 0 && <span>{movie.runtime} min</span>}
            <span>★ {movie.vote_average?.toFixed(1)}</span>
          </div>
          <div className="details-genres">
            {movie.genres?.map(g => <span key={g.id} className="genre-tag">{g.name}</span>)}
          </div>
          <p className="details-overview">{movie.overview}</p>
          <button onClick={toggleFavorite} className={`favorite-btn ${isFav ? 'active' : ''}`}>
            {isFav ? '❤️ Saved' : '🤍 Favorite'}
          </button>
        </div>
      </div>
    </div>
  );
}
