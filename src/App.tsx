import { useContext, useState, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Community from './pages/Community';
import Profile from './pages/Profile';
import MovieDetails from './pages/MovieDetails';
import UserSearch from './pages/UserSearch';
import AboutUs from './pages/AboutUs';
import MovieCatalogSearch from './pages/MovieCatalogSearch';
import { supabase } from './utils/supabaseClient';
import './App.css';

type View = 'dashboard' | 'community' | 'user-search' | 'profile' | 'movie-details' | 'about' | 'movie-search';

function App() {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<View>('dashboard');
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [navAvatarUrl, setNavAvatarUrl] = useState('');

  useEffect(() => {
    if (!user) {
      const t = setTimeout(() => { setPendingRequestsCount(0); setNavAvatarUrl(''); }, 0);
      return () => clearTimeout(t);
    }
    const fetchAvatar = async () => {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
      if (data?.avatar_url) setNavAvatarUrl(data.avatar_url);
    };
    fetchAvatar();
    const fetchCount = async () => {
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');
      setPendingRequestsCount(count ?? 0);
    };
    const timer = setTimeout(() => { fetchCount(); }, 0);
    const channel = supabase.channel('friendship-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `receiver_id=eq.${user.id}` },
        () => { fetchCount(); }
      )
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [user]);

  const handleSelectMovie = (id: number) => {
    setSelectedMovieId(id);
    setView('movie-details');
  };

  const handleSelectProfile = (id: string) => {
    setSelectedProfileId(id);
    setView('profile');
  };

  const handleViewOwnProfile = () => {
    setSelectedProfileId(null);
    setView('profile');
  };

  const renderView = () => {
    switch (view) {
      case 'movie-details':
        return selectedMovieId !== null ? (
          <MovieDetails
            movieId={selectedMovieId}
            onBack={() => setView('dashboard')}
            onRequireAuth={() => setShowAuthModal(true)}
          />
        ) : null;
      case 'profile':
        return (
          <Profile
            profileId={selectedProfileId}
            onRequireAuth={() => setShowAuthModal(true)}
            onSelectMovie={handleSelectMovie}
            onPendingRequestChange={(delta) => setPendingRequestsCount(c => Math.max(0, c + delta))}
            onAvatarUpdate={(url) => setNavAvatarUrl(url)}
          />
        );
      case 'community':
        return <Community onRequireAuth={() => setShowAuthModal(true)} onSelectProfile={handleSelectProfile} />;
      case 'user-search':
        return <UserSearch onRequireAuth={() => setShowAuthModal(true)} onSelectProfile={handleSelectProfile} />;
      case 'about':
        return <AboutUs />;
      case 'movie-search':
        return <MovieCatalogSearch onSelectMovie={handleSelectMovie} />;
      default:
        return <Dashboard onRequireAuth={() => setShowAuthModal(true)} onSelectMovie={handleSelectMovie} />;
    }
  };

  return (
    <div className="app-container">
      <header className="nav-header">
        <div className="nav-left">
          <div className="nav-brand" onClick={() => setView('dashboard')}>
            Seek<span>Mov</span>
          </div>
          <nav className="nav-links">
            <button className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
              Dashboard
            </button>
            <button className={`nav-btn ${view === 'community' ? 'active' : ''}`} onClick={() => setView('community')}>
              Community
            </button>
            <button className={`nav-btn ${view === 'movie-search' ? 'active' : ''}`} onClick={() => setView('movie-search')}>
              Explore Movies
            </button>
            {user && (
              <button className={`nav-btn ${view === 'user-search' ? 'active' : ''}`} onClick={() => setView('user-search')}>
                User Search
              </button>
            )}
          </nav>
        </div>
        <div className="nav-right">
          {user && (
            <div className="nav-profile-wrapper">
              <button className={`nav-btn ${view === 'profile' ? 'active' : ''}`} onClick={handleViewOwnProfile}>
                Profile
              </button>
              {pendingRequestsCount > 0 && (
                <span className="nav-badge">
                  {pendingRequestsCount > 10 ? '10+' : pendingRequestsCount}
                </span>
              )}
            </div>
          )}
          <div className="nav-auth-section">
            {user ? (
              <div className="user-nav-profile">
                {navAvatarUrl ? (
                  <img src={navAvatarUrl} alt="" className="nav-avatar-img" />
                ) : (
                  <span className="nav-avatar-fallback">
                    {(user.email?.charAt(0) || 'U').toUpperCase()}
                  </span>
                )}
                <span className="welcome-txt">Hey, {user.email?.split('@')[0]}</span>
                <button onClick={() => supabase.auth.signOut()} className="btn-logout">Sign Out</button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="btn-signin-nav">Sign In / Register</button>
            )}
          </div>
        </div>
      </header>

      {showAuthModal && !user && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="auth-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-modal-btn" onClick={() => setShowAuthModal(false)}>×</button>
            <Auth />
          </div>
        </div>
      )}

      <main className="main-content">{renderView()}</main>

      <footer className="app-footer">
        <div className="footer-inner">
          <nav className="footer-links">
            <button className="footer-link" onClick={() => setView('about')}>About Us</button>
            <span className="footer-sep">·</span>
            <button className="footer-link" onClick={() => setView('dashboard')}>Dashboard</button>
            <span className="footer-sep">·</span>
            <button className="footer-link" onClick={() => setView('community')}>Community</button>
          </nav>
          <p className="footer-copy">© 2026 SeekMov. All rights reserved.</p>
          <p className="footer-tmdb">
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
