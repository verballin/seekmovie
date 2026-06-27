const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  runtime: number;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genres: { id: number; name: string }[];
}

export const GENRE_MAP: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Horror: 27,
  Romance: 10749,
  Comedy: 35,
};

export const searchMovies = async (query: string): Promise<TMDBMovie[]> => {
  if (!query) return [];
  try {
    const response = await fetch(
      `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch movies from TMDB:", error);
    return [];
  }
};

export const searchMoviesPaginated = async (query: string, page: number): Promise<{ results: TMDBMovie[]; total_pages: number }> => {
  if (!query) return { results: [], total_pages: 1 };
  try {
    const response = await fetch(
      `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}&include_adult=false`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return { results: data.results || [], total_pages: Math.min(data.total_pages || 1, 500) };
  } catch (error) {
    console.error("Failed to fetch movies from TMDB:", error);
    return { results: [], total_pages: 1 };
  }
};

export const getPopularMovies = async (): Promise<TMDBMovie[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch popular movies from TMDB:", error);
    return [];
  }
};

export const getTrendingMovies = async (): Promise<TMDBMovie[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch trending movies from TMDB:", error);
    return [];
  }
};

export const getNowPlaying = async (): Promise<TMDBMovie[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch now-playing movies from TMDB:", error);
    return [];
  }
};

export const getMoviesByGenre = async (genreId: number): Promise<TMDBMovie[]> => {
  try {
    const response = await fetch(
      `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&with_genres=${genreId}&page=1`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch movies by genre from TMDB:", error);
    return [];
  }
};

export const getMovieDetails = async (movieId: number): Promise<TMDBMovieDetails | null> => {
  try {
    const response = await fetch(
      `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
    );
    if (!response.ok) throw new Error(`TMDB API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch movie details:", error);
    return null;
  }
};
