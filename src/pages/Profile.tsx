import { useState, useEffect, useContext, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import './Profile.css';

type ProfileTab = 'saved' | 'activity' | 'connections' | 'security';

interface SavedMovie {
  tmdb_movie_id: string;
  title: string;
  poster_path: string | null;
}

interface ActivityItem {
  id: number;
  type: 'post' | 'reply';
  content: string;
  post_id?: number;
  created_at: string;
}

interface FriendProfile {
  id: string;
  username: string;
}

interface PendingRequest {
  sender_id: string;
  username: string;
}

interface ProfileProps {
  profileId?: string | null;
  onRequireAuth: () => void;
  onSelectMovie: (id: number) => void;
  onPendingRequestChange?: (delta: number) => void;
  onAvatarUpdate?: (url: string) => void;
}

export default function Profile({ profileId, onRequireAuth, onSelectMovie, onPendingRequestChange, onAvatarUpdate }: ProfileProps) {
  const { user } = useContext(AuthContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('saved');

  const [savedMovies, setSavedMovies] = useState<SavedMovie[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  const [profileUsername, setProfileUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const isOwnProfile = !profileId && !!user;

  const targetUserId = profileId || user?.id;

  useEffect(() => {
    if (!targetUserId) { onRequireAuth(); return; }

    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', targetUserId).single();
      if (data) {
        setProfileUsername(data.username || '');
        setAvatarUrl(data.avatar_url || '');
      }
    };

    const loadSaved = async () => {
      const { data } = await supabase
        .from('favorites')
        .select('tmdb_movie_id, title, poster_path')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      if (data) setSavedMovies(data);
    };

    const loadActivity = async () => {
      if (!targetUserId) return;
      const [postsRes, repliesRes] = await Promise.all([
        supabase.from('posts').select('id, content, created_at').eq('user_id', targetUserId).order('created_at', { ascending: false }),
        supabase.from('replies').select('id, content, created_at, post_id').eq('user_id', targetUserId).order('created_at', { ascending: false }),
      ]);
      const merged: ActivityItem[] = [
        ...(postsRes.data || []).map(p => ({ ...p, type: 'post' as const })),
        ...(repliesRes.data || []).map(r => ({ ...r, type: 'reply' as const })),
      ];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivities(merged);
    };

    const loadConnections = async () => {
      if (!targetUserId) return;
      const [friendshipsRes, pendingRes] = await Promise.all([
        supabase.from('friendships').select('sender_id, receiver_id').or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`).eq('status', 'accepted'),
        supabase.from('friendships').select('sender_id').eq('receiver_id', targetUserId).eq('status', 'pending'),
      ]);

      if (friendshipsRes.data) {
        const friendIds = friendshipsRes.data.map(f => f.sender_id === targetUserId ? f.receiver_id : f.sender_id);
        if (friendIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', friendIds);
          if (profiles) setFriends(profiles);
        }
      }

      if (pendingRes.data && pendingRes.data.length > 0) {
        const senderIds = pendingRes.data.map(p => p.sender_id);
        const { data: senders } = await supabase.from('profiles').select('id, username').in('id', senderIds);
        if (senders) {
          setPendingRequests(pendingRes.data.map(p => ({
            sender_id: p.sender_id,
            username: senders.find(s => s.id === p.sender_id)?.username || 'Unknown',
          })));
        }
      }
    };

    loadProfile();
    loadSaved();
    loadActivity();
    if (isOwnProfile) loadConnections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, isOwnProfile]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File too large. Please select an image under 5MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) { alert('Upload Error: ' + uploadError.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || '';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) { alert('Avatar Error: ' + updateError.message); setUploading(false); return; }

      setAvatarUrl(publicUrl);
      onAvatarUpdate?.(publicUrl);
    } catch (err) {
      alert('Upload Error: ' + (err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) { onRequireAuth(); return; }
    setPasswordMsg('');
    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert("Password Error: " + error.message);
      setPasswordMsg('Failed to update password.');
    } else {
      setPasswordMsg('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleAccept = async (senderId: string) => {
    if (!user) return;
    await supabase.from('friendships').update({ status: 'accepted' }).eq('sender_id', senderId).eq('receiver_id', user.id);
    const sender = pendingRequests.find(p => p.sender_id === senderId);
    if (sender) {
      setFriends([...friends, { id: sender.sender_id, username: sender.username }]);
      setPendingRequests(pendingRequests.filter(p => p.sender_id !== senderId));
      onPendingRequestChange?.(-1);
    }
  };

  const handleDecline = async (senderId: string) => {
    if (!user) return;
    await supabase.from('friendships').delete().eq('sender_id', senderId).eq('receiver_id', user.id);
    setPendingRequests(pendingRequests.filter(p => p.sender_id !== senderId));
    onPendingRequestChange?.(-1);
  };

  const handleDeletePost = async (postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
      if (error) { console.error(error); return; }
      setActivities(activities.filter(a => !(a.type === 'post' && a.id === postId)));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('replies').delete().eq('id', replyId).eq('user_id', user.id);
      if (error) { console.error(error); return; }
      setActivities(activities.filter(a => !(a.type === 'reply' && a.id === replyId)));
    } catch (error) {
      console.error(error);
    }
  };

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'saved', label: 'Saved Movies' },
    { key: 'activity', label: 'Activity' },
    ...(isOwnProfile ? [{ key: 'connections' as const, label: 'Connections' }, { key: 'security' as const, label: 'Security' }] : []),
  ];

  return (
    <div className="profile-container">
      <div className="profile-hero">
        <div className="profile-hero-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-fallback">
              {(profileUsername || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="profile-hero-text">
          <h2>
            {isOwnProfile
              ? `Hello, ${profileUsername || user?.email?.split('@')[0] || 'User'}! Welcome to your dashboard`
              : `${profileUsername || 'User'}'s Profile`}
          </h2>
          {isOwnProfile && <p className="profile-email">{user?.email}</p>}
        </div>
      </div>

      <div className="profile-tabs">
        {tabs.map(tab => (
          <button key={tab.key} className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="profile-tab-content">
        {activeTab === 'saved' && (
          <div className="saved-grid">
            {savedMovies.length === 0 && <p className="empty-state">No saved movies yet.</p>}
            {savedMovies.map(movie => (
              <div key={movie.tmdb_movie_id} className="saved-card" onClick={() => onSelectMovie(Number(movie.tmdb_movie_id))}>
                <img
                  className="saved-poster"
                  src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Poster'}
                  alt={movie.title}
                />
                <p className="saved-title">{movie.title}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="activity-list">
            {activities.length === 0 && <p className="empty-state">No activity yet.</p>}
            {activities.map(item => (
              <div key={`${item.type}-${item.id}`} className="activity-item">
                <span className="activity-badge">{item.type === 'post' ? '📝 Post' : '💬 Reply'}</span>
                <p className="activity-content">{item.content}</p>
                <span className="activity-time">{new Date(item.created_at).toLocaleDateString()}</span>
                {isOwnProfile && (
                  <button
                    className="activity-delete-btn"
                    onClick={() => item.type === 'post' ? handleDeletePost(item.id) : handleDeleteReply(item.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isOwnProfile && activeTab === 'connections' && (
          <div className="connections-section">
            <div className="conn-block">
              <h3>Friends ({friends.length})</h3>
              {friends.length === 0 && <p className="empty-state">No friends yet.</p>}
              {friends.map(f => (
                <div key={f.id} className="friend-row">
                  <span className="friend-name">@{f.username}</span>
                </div>
              ))}
            </div>

            <div className="conn-block">
              <div className="incoming-header">
                <h3>Incoming Requests</h3>
                {pendingRequests.length > 0 && (
                  <span className="pending-badge">{pendingRequests.length}</span>
                )}
              </div>
              {pendingRequests.length > 0 && (
                <p className="incoming-hint">
                  🔔 You have {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}.
                </p>
              )}
              {pendingRequests.length === 0 && <p className="empty-state">No pending requests.</p>}
              {pendingRequests.map(req => (
                <div key={req.sender_id} className="friend-row">
                  <span className="friend-name">@{req.username}</span>
                  <div className="req-actions">
                    <button className="btn-accept" onClick={() => handleAccept(req.sender_id)}>Accept</button>
                    <button className="btn-decline" onClick={() => handleDecline(req.sender_id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOwnProfile && activeTab === 'security' && (
          <div className="security-section">
            <div className="security-card">
              <h3>Profile Picture</h3>
              <p className="security-desc">Upload a custom avatar image from your device. Supported formats: JPG, PNG, GIF (max 5MB).</p>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div className="avatar-edit-row">
                <button
                  className="btn-upload-avatar"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload Avatar'}
                </button>
              </div>

              {avatarUrl && (
                <div className="avatar-preview-row">
                  <img src={avatarUrl} alt="Current avatar" className="avatar-preview-img" />
                </div>
              )}
            </div>

            <div className="security-card">
              <h3>Change Password</h3>
              <p className="security-desc">Update your account password. Must be at least 6 characters.</p>
              <div className="password-fields">
                <input
                  type="password"
                  className="security-input"
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="security-input"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button className="btn-save" onClick={handleUpdatePassword} disabled={!newPassword || !confirmPassword}>
                  Update Password
                </button>
              </div>
              {passwordMsg && (
                <p className={`password-msg ${passwordMsg.includes('success') ? 'success' : 'error'}`}>
                  {passwordMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
