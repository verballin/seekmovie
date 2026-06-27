import { useState, useEffect, useContext } from 'react';
import type { FormEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { searchMoviesPaginated, getMovieDetails } from '../utils/tmdb';
import type { TMDBMovie } from '../utils/tmdb';
import './Community.css';

interface PostWithProfile {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { id: string; username: string } | null;
  tagged_tmdb_id: string | null;
  movie_title: string | null;
  rating: number | null;
}

interface ReplyWithProfile {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { id: string; username: string } | null;
}

interface ReactionCounts {
  likes: number;
  dislikes: number;
}

interface CommunityProps {
  onRequireAuth: () => void;
  onSelectProfile: (id: string) => void;
}

const STAR_COUNT = 5;

export default function Community({ onRequireAuth, onSelectProfile }: CommunityProps) {
  const { user } = useContext(AuthContext);

  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<number, ReactionCounts>>({});
  const [userReactions, setUserReactions] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, ReplyWithProfile[]>>({});
  const [showReplies, setShowReplies] = useState<Record<number, boolean>>({});

  const [newPostContent, setNewPostContent] = useState('');
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});

  // Poster cache: tagged_tmdb_id -> poster_path
  const [posterMap, setPosterMap] = useState<Record<string, string>>({});

  // Post error banner
  const [postError, setPostError] = useState('');

  const isRateLimitError = (err: unknown): string | null => {
    const msg =
      (err as { message?: string })?.message ||
      (err as { details?: string })?.details ||
      (err as { error?: string })?.error ||
      String(err);
    if (/rate\s*limit/i.test(msg)) {
      return '⚠️ Slow down! You\'re posting too fast. Please wait a minute before trying again.';
    }
    return null;
  };

  // Movie tagging state
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState<TMDBMovie[]>([]);
  const [movieSearchPage, setMovieSearchPage] = useState(1);
  const [movieSearchTotalPages, setMovieSearchTotalPages] = useState(1);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showMovieSearch, setShowMovieSearch] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*, profiles(id, username)')
        .order('created_at', { ascending: false });

      if (error || !postsData) return;

      const typedPosts = postsData as unknown as PostWithProfile[];
      setPosts(typedPosts);

      const postIds = typedPosts.map((p) => p.id);
      if (postIds.length === 0) return;

      const [reactionsResult, repliesResult] = await Promise.all([
        supabase.from('post_reactions').select('*').in('post_id', postIds),
        supabase
          .from('replies')
          .select('*, profiles(id, username)')
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
      ]);

      const counts: Record<number, ReactionCounts> = {};
      const userReact: Record<number, boolean> = {};

      typedPosts.forEach((p) => {
        counts[p.id] = { likes: 0, dislikes: 0 };
      });

      if (reactionsResult.data) {
        reactionsResult.data.forEach((r) => {
          if (r.is_like) counts[r.post_id].likes++;
          else counts[r.post_id].dislikes++;
          if (user && r.user_id === user.id) {
            userReact[r.post_id] = r.is_like;
          }
        });
      }

      setReactionCounts(counts);
      setUserReactions(userReact);

      if (repliesResult.data) {
        const repliesMap: Record<number, ReplyWithProfile[]> = {};
        (repliesResult.data as unknown as ReplyWithProfile[]).forEach((r) => {
          if (!repliesMap[r.post_id]) repliesMap[r.post_id] = [];
          repliesMap[r.post_id].push(r);
        });
        setReplies(repliesMap);
      }

      // Fetch poster paths for tagged movies
      const taggedIds = [...new Set(typedPosts.map(p => p.tagged_tmdb_id).filter(Boolean) as string[])];
      const posterAccum: Record<string, string> = {};
      await Promise.all(taggedIds.map(async (id) => {
        const details = await getMovieDetails(Number(id));
        if (details?.poster_path) posterAccum[id] = details.poster_path;
      }));
      setPosterMap(prev => ({ ...prev, ...posterAccum }));
    };

    fetchData();
  }, [user]);

  // Reset page to 1 when query changes
  useEffect(() => {
    setMovieSearchPage(1);
  }, [movieSearchQuery]);

  // Debounced movie search with pagination
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (movieSearchQuery.trim().length < 2) {
        setMovieSearchResults([]);
        setMovieSearchTotalPages(1);
        return;
      }
      const result = await searchMoviesPaginated(movieSearchQuery, movieSearchPage);
      setMovieSearchResults(result.results);
      setMovieSearchTotalPages(result.total_pages);
    }, 300);
    return () => clearTimeout(timer);
  }, [movieSearchQuery, movieSearchPage]);

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    setPostError('');

    if (!user || !newPostContent.trim()) return;

    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        content: newPostContent.trim(),
      };

      if (selectedMovie) {
        payload.tagged_tmdb_id = selectedMovie.id.toString();
        payload.movie_title = selectedMovie.title;
      }
      if (rating > 0) {
        payload.rating = Number(rating);
      }

      const { data, error } = await supabase
        .from('posts')
        .insert(payload)
        .select('*, profiles(id, username)')
        .single();

      if (error) {
        const friendly = isRateLimitError(error);
        if (friendly) {
          setPostError(friendly);
          return;
        }
        console.error(error);
        setPostError("Supabase Error: " + error.message);
        return;
      }

      if (data) {
        const newPost = data as unknown as PostWithProfile;
        if (selectedMovie && selectedMovie.poster_path) {
          const poster = selectedMovie.poster_path;
          setPosterMap(prev => ({ ...prev, [selectedMovie.id.toString()]: poster }));
        }
        setNewPostContent('');
        setSelectedMovie(null);
        setRating(0);
        setMovieSearchQuery('');
        setShowMovieSearch(false);
        setPosts([newPost, ...posts]);
        setReactionCounts({ ...reactionCounts, [newPost.id]: { likes: 0, dislikes: 0 } });
      }
    } catch (error) {
      const friendly = isRateLimitError(error);
      if (friendly) {
        setPostError(friendly);
        return;
      }
      console.error(error);
      setPostError("Supabase Error: " + (error as Error).message);
    }
  };

  const toggleReaction = async (postId: number, isLike: boolean) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    const currentReaction = userReactions[postId];

    if (currentReaction === isLike) {
      await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      const newUserReactions = { ...userReactions };
      delete newUserReactions[postId];
      setUserReactions(newUserReactions);

      const newCounts = { ...reactionCounts };
      if (isLike) newCounts[postId].likes--;
      else newCounts[postId].dislikes--;
      setReactionCounts(newCounts);
    } else {
      await supabase.from('post_reactions').upsert(
        { post_id: postId, user_id: user.id, is_like: isLike },
        { onConflict: 'post_id, user_id' },
      );

      const newCounts = { ...reactionCounts };
      if (currentReaction !== undefined) {
        if (currentReaction) newCounts[postId].likes--;
        else newCounts[postId].dislikes--;
      }
      if (isLike) newCounts[postId].likes++;
      else newCounts[postId].dislikes++;
      setReactionCounts(newCounts);
      setUserReactions({ ...userReactions, [postId]: isLike });
    }
  };

  const handleAddReply = async (postId: number) => {
    if (!user) {
      onRequireAuth();
      return;
    }

    const content = replyInputs[postId]?.trim();
    if (!content) return;

    const { data, error } = await supabase
      .from('replies')
      .insert({ post_id: postId, user_id: user.id, content })
      .select('*, profiles(id, username)')
      .single();

    if (!error && data) {
      const newReply = data as unknown as ReplyWithProfile;
      setReplyInputs({ ...replyInputs, [postId]: '' });
      const newReplies = { ...replies };
      if (!newReplies[postId]) newReplies[postId] = [];
      newReplies[postId] = [...newReplies[postId], newReply];
      setReplies(newReplies);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
      if (error) { console.error(error); alert("Delete Error: " + error.message); return; }
      setPosts(posts.filter(p => p.id !== postId));
      const newCounts = { ...reactionCounts };
      delete newCounts[postId];
      setReactionCounts(newCounts);
      const newReplies = { ...replies };
      delete newReplies[postId];
      setReplies(newReplies);
    } catch (error) {
      console.error(error);
      alert("Delete Error: " + (error as Error).message);
    }
  };

  const handleDeleteReply = async (postId: number, replyId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('replies').delete().eq('id', replyId).eq('user_id', user.id);
      if (error) { console.error(error); alert("Delete Reply Error: " + error.message); return; }
      const newReplies = { ...replies };
      newReplies[postId] = newReplies[postId].filter(r => r.id !== replyId);
      setReplies(newReplies);
    } catch (error) {
      console.error(error);
      alert("Delete Reply Error: " + (error as Error).message);
    }
  };

  const toggleShowReplies = (postId: number) => {
    setShowReplies({ ...showReplies, [postId]: !showReplies[postId] });
  };

  const getPageNumbers = (): number[] => {
    const total = movieSearchTotalPages;
    const current = movieSearchPage;
    const maxVisible = 5;
    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const half = Math.floor(maxVisible / 2);
    let start = current - half;
    let end = current + half;
    if (start < 1) { start = 1; end = start + maxVisible - 1; }
    if (end > total) { end = total; start = end - maxVisible + 1; }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const selectMovieForTag = (movie: TMDBMovie) => {
    setSelectedMovie(movie);
    setMovieSearchQuery(movie.title);
    setMovieSearchResults([]);
    setShowMovieSearch(false);
  };

  const clearMovieTag = () => {
    setSelectedMovie(null);
    setMovieSearchQuery('');
    setMovieSearchResults([]);
    setMovieSearchPage(1);
    setMovieSearchTotalPages(1);
    setRating(0);
  };

  const renderStars = (currentRating: number, interactive = false) => {
    const stars: React.ReactNode[] = [];
    const displayRating = interactive ? hoveredRating || rating : currentRating;

    for (let i = 1; i <= STAR_COUNT; i++) {
      stars.push(
        <span
          key={i}
          className={`star ${i <= displayRating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
          onClick={() => interactive && setRating(i)}
          onMouseEnter={() => interactive && setHoveredRating(i)}
          onMouseLeave={() => interactive && setHoveredRating(0)}
        >
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <div className="community-container">
      <section className="community-header">
        <h2>Community Wall</h2>
        <p>Share your thoughts on movies, start discussions, and connect with others.</p>
      </section>

      {user ? (
        <form className="post-form" onSubmit={handleCreatePost}>
          <textarea
            className="post-textarea"
            placeholder="What's on your mind?"
            value={newPostContent}
            onChange={(e) => { setNewPostContent(e.target.value); if (postError) setPostError(''); }}
          />

          <div className="post-form-tag-area">
            <div className="movie-tag-input-row">
              {selectedMovie ? (
                <div className="movie-tag-badge">
                  <span className="movie-tag-badge-label">{selectedMovie.title}</span>
                  <button type="button" className="movie-tag-badge-remove" onClick={clearMovieTag}>×</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="movie-search-input"
                    placeholder="Tag a movie (optional)..."
                    value={movieSearchQuery}
                    onChange={(e) => { setMovieSearchQuery(e.target.value); setShowMovieSearch(true); }}
                    onFocus={() => setShowMovieSearch(true)}
                  />
                  {showMovieSearch && movieSearchResults.length > 0 && (
                    <div className="movie-search-dropdown">
                      {movieSearchResults.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          className="movie-search-option"
                          onClick={() => selectMovieForTag(m)}
                        >
                          <img
                            src={m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : ''}
                            alt=""
                            className="movie-search-option-poster"
                          />
                          <div className="movie-search-option-info">
                            <span className="movie-search-option-title">{m.title}</span>
                            <span className="movie-search-option-year">
                              {m.release_date?.substring(0, 4) || ''}
                            </span>
                          </div>
                        </button>
                      ))}
                      {movieSearchTotalPages > 1 && (
                        <div className="movie-search-pagination">
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={movieSearchPage <= 1}
                            onClick={() => setMovieSearchPage(p => Math.max(1, p - 1))}
                          >
                            &lt; Prev
                          </button>
                          {getPageNumbers().map(p => (
                            <button
                              key={p}
                              type="button"
                              className={`page-num-btn${p === movieSearchPage ? ' active' : ''}`}
                              onClick={() => setMovieSearchPage(p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="pagination-btn"
                            disabled={movieSearchPage >= movieSearchTotalPages}
                            onClick={() => setMovieSearchPage(p => Math.min(movieSearchTotalPages, p + 1))}
                          >
                            Next &gt;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="star-rating-row">
              <span className="star-rating-label">Rating:</span>
              <div className="star-rating">{renderStars(rating, true)}</div>
            </div>
          </div>

          {postError && <div className="post-error-banner">{postError}</div>}

          <button type="submit" className="btn-post" disabled={!newPostContent.trim()}>
            Post
          </button>
        </form>
      ) : (
        <div className="guest-cta" onClick={onRequireAuth}>
          <p>Want to join the discussion? Sign in to write posts, react, and reply.</p>
        </div>
      )}

      <div className="posts-feed">
        {posts.map((post) => {
          const counts = reactionCounts[post.id] || { likes: 0, dislikes: 0 };
          const userReact = userReactions[post.id];
          const postReplies = replies[post.id] || [];
          const replyCount = postReplies.length;

          return (
            <article key={post.id} className="post-card">
              <div className="post-author">
                <span
                  className="post-username clickable-username"
                  onClick={() => onSelectProfile(post.user_id)}
                >
                  {post.profiles?.username || 'Unknown'}
                </span>
                <span className="post-time">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
                {user && post.user_id === user.id && (
                  <button className="btn-delete-post" onClick={() => handleDeletePost(post.id)}>
                    Delete Post
                  </button>
                )}
              </div>

              {post.movie_title && (() => {
                const posterPath = post.tagged_tmdb_id ? posterMap[post.tagged_tmdb_id] : null;
                return (
                  <div className="movie-tag-banner">
                    {posterPath && (
                      <img
                        className="movie-tag-thumb"
                        src={`https://image.tmdb.org/t/p/w92${posterPath}`}
                        alt=""
                      />
                    )}
                    <div className="movie-tag-info">
                      <span className="movie-tag-banner-title">{post.movie_title}</span>
                      {post.rating != null && post.rating > 0 && (
                        <span className="movie-tag-banner-rating">{renderStars(post.rating)}</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <p className="post-content">{post.content}</p>

              <div className="post-actions">
                <button
                  className={`reaction-btn ${userReact === true ? 'liked' : ''}`}
                  onClick={() => toggleReaction(post.id, true)}
                >
                  👍 {counts.likes}
                </button>
                <button
                  className={`reaction-btn ${userReact === false ? 'disliked' : ''}`}
                  onClick={() => toggleReaction(post.id, false)}
                >
                  👎 {counts.dislikes}
                </button>
                <button
                  className="reply-toggle-btn"
                  onClick={() => toggleShowReplies(post.id)}
                >
                  💬 {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
                </button>
              </div>

              {showReplies[post.id] && (
                <div className="replies-section">
                  {postReplies.length === 0 && (
                    <p className="no-replies">No replies yet. Be the first!</p>
                  )}
                  {postReplies.map((reply) => (
                    <div key={reply.id} className="reply-item">
                      <span
                        className="reply-username clickable-username"
                        onClick={() => onSelectProfile(reply.user_id)}
                      >
                        {reply.profiles?.username || 'Unknown'}
                      </span>
                      <span className="reply-text">{reply.content}</span>
                      {user && reply.user_id === user.id && (
                        <button className="btn-delete-reply" onClick={() => handleDeleteReply(post.id, reply.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="reply-form">
                    <input
                      type="text"
                      className="reply-input"
                      placeholder="Write a reply..."
                      value={replyInputs[post.id] || ''}
                      onChange={(e) =>
                        setReplyInputs({ ...replyInputs, [post.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddReply(post.id);
                        }
                      }}
                    />
                    <button
                      className="btn-reply"
                      disabled={!replyInputs[post.id]?.trim()}
                      onClick={() => handleAddReply(post.id)}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {posts.length === 0 && (
          <p className="no-posts">No posts yet. Start the conversation!</p>
        )}
      </div>
    </div>
  );
}
