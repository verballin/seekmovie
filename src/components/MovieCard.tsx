export interface Movie {
  title: string;
  release_date: string;
  imageUrl: string;
}

interface MovieCardProps {
  movie: Movie;
}

export default function MovieCard({ movie }: MovieCardProps) {
  function onfavoriteClick() {
    alert("clicked favorite button for " + movie.title);
  }

    return (
        <div className="movie-card">
        <img src={movie.imageUrl} alt={movie.title} />
        <div className="movie-overlay">
            <button className="favorite-btn" onClick={onfavoriteClick}>
            ❤️
            </button>
        </div>
    
    <div className="movie-info">
            <h2>{movie.title}</h2>
            <p>{movie.release_date}</p>
        </div>
        </div>
  );
}