import './AboutUs.css';

export default function AboutUs() {
  return (
    <div className="about-container">
      <section className="about-hero">
        <h1>About <span className="about-brand">Seek<span className="about-brand-accent">Mov</span></span></h1>
        <p className="about-tagline">
          A premium tracking and social discussion platform built for cinephiles.
        </p>
      </section>

      <section className="about-section">
        <h2>Our Mission</h2>
        <p>
          SeekMov was created to unite movie lovers under one roof. We believe every film
          sparks a conversation worth having — whether it is a blockbuster premiere, an
          indie gem, or a timeless classic. Our platform gives you the tools to discover,
          save, and discuss the films that matter to you.
        </p>
      </section>

      <section className="about-features">
        <div className="about-feature-card">
          <div className="about-feature-icon">🎬</div>
          <h3>Movie Explorer</h3>
          <p>
            Browse trending, top-rated, and upcoming films with rich TMDB-powered
            details. Save your favorites and rate what you have watched.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon">💬</div>
          <h3>Community Forums</h3>
          <p>
            Share your thoughts on the Community Wall. React with likes or dislikes,
            reply to discussions, and tag movies with your personal ratings.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon">🤝</div>
          <h3>Social Network</h3>
          <p>
            Connect with fellow cinephiles through our friendship system. Send
            requests, build your network, and discover what your friends are watching.
          </p>
        </div>
      </section>

      <section className="about-section">
        <h2>Why SeekMov?</h2>
        <p>
          We combine the depth of a dedicated movie database with the energy of a
          social community. Every feature — from the sleek dark-neon interface to the
          real-time friend notifications — is designed to keep the focus on what
          matters most: great cinema and great conversation.
        </p>
      </section>

      <footer className="about-footer">
        <p>SeekMov &mdash; Built with passion for movie lovers everywhere.</p>
      </footer>
    </div>
  );
}
