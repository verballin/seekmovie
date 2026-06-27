import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../utils/supabaseClient';
import './Auth.css'; // Load our modernized layout

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: data.user.id, username: username }]);

          if (profileError) throw profileError;
          setMessage('Registration successful! Please sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error: unknown) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="brand-title">Seek<span>Mov</span></h1>
        <p className="auth-subtitle">
          {isSignUp ? 'Create an account to track and share movies' : 'Sign in to access your dashboard'}
        </p>
        
        <form onSubmit={handleAuth}>
          {isSignUp && (
            <div className="form-group">
              <label>USERNAME</label>
              <input 
                type="text" 
                required={isSignUp} 
                placeholder="e.g., movie_buff"
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
              />
            </div>
          )}

          <div className="form-group">
            <label>EMAIL ADDRESS</label>
            <input 
              type="email" 
              required 
              placeholder="you@example.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>PASSWORD</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${isError ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <p className="auth-toggle-text">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }} 
            className="btn-toggle"
          >
            {isSignUp ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}