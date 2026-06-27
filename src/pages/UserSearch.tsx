import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import './UserSearch.css';

interface UserSearchProps {
  onRequireAuth: () => void;
  onSelectProfile: (id: string) => void;
}

interface ProfileResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export default function UserSearch({ onRequireAuth, onSelectProfile }: UserSearchProps) {
  const { user } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [friendStatusMap, setFriendStatusMap] = useState<Record<string, FriendStatus>>({});
  const [loading, setLoading] = useState(false);

  const loadFriendStatuses = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!data) return;
    const map: Record<string, FriendStatus> = {};
    data.forEach(f => {
      const otherId = f.sender_id === user.id ? f.receiver_id : f.sender_id;
      if (f.status === 'accepted') {
        map[otherId] = 'accepted';
      } else if (f.status === 'pending') {
        map[otherId] = f.sender_id === user.id ? 'pending_sent' : 'pending_received';
      }
    });
    setFriendStatusMap(map);
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => { loadFriendStatuses(); }, 0);
    return () => clearTimeout(timer);
  }, [loadFriendStatuses]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 1) { setResults([]); return; }
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query.trim()}%`)
        .limit(20);
      if (data) {
        setResults(data.filter(p => p.id !== user?.id));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  const handleSendRequest = async (targetId: string) => {
    if (!user) { onRequireAuth(); return; }
    try {
      const { error } = await supabase
        .from('friendships')
        .insert({ sender_id: user.id, receiver_id: targetId, status: 'pending' });
      if (error) {
        alert("Friend Error: " + error.message);
        return;
      }
      setFriendStatusMap(prev => ({ ...prev, [targetId]: 'pending_sent' }));
    } catch (err) {
      alert("Friend Error: " + (err as Error).message);
    }
  };

  const handleCancelRequest = async (targetId: string) => {
    if (!user) return;
    await supabase
      .from('friendships')
      .delete()
      .eq('sender_id', user.id)
      .eq('receiver_id', targetId);
    setFriendStatusMap(prev => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
  };

  const handleRemoveFriend = async (targetId: string) => {
    if (!user) return;
    await supabase
      .from('friendships')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${user.id})`);
    setFriendStatusMap(prev => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
  };

  const renderActionButton = (profile: ProfileResult) => {
    const status = friendStatusMap[profile.id] || 'none';
    switch (status) {
      case 'accepted':
        return (
          <button className="us-btn us-btn-danger" onClick={() => handleRemoveFriend(profile.id)}>
            Remove Friend
          </button>
        );
      case 'pending_sent':
        return (
          <button className="us-btn us-btn-muted" onClick={() => handleCancelRequest(profile.id)}>
            Cancel Request
          </button>
        );
      case 'pending_received':
        return (
          <span className="us-btn us-btn-static">Pending Incoming</span>
        );
      default:
        return (
          <button className="us-btn us-btn-primary" onClick={() => handleSendRequest(profile.id)}>
            Add Friend
          </button>
        );
    }
  };

  return (
    <div className="us-container">
      <section className="us-header">
        <h2>User Discovery</h2>
        <p>Find other movie lovers and connect with them.</p>
      </section>

      <div className="us-search-row">
        <input
          type="text"
          className="us-search-input"
          placeholder="Search by username..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="us-results">
        {loading && <p className="us-status">Searching...</p>}
        {!loading && query.trim().length > 0 && results.length === 0 && (
          <p className="us-status">No users found matching "{query}"</p>
        )}
        {!loading && results.map(profile => (
          <div key={profile.id} className="us-card">
            <div className="us-card-left clickable" onClick={() => onSelectProfile(profile.id)}>
              <div className="us-avatar">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="us-avatar-img" />
                ) : (
                  <span className="us-avatar-fallback">{profile.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="us-card-info">
                <span className="us-username">@{profile.username}</span>
              </div>
            </div>
            <div className="us-card-right">
              {renderActionButton(profile)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
