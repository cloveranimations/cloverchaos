'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

type Comment = {
  id: string;
  text: string;
  authorName: string;
  authorImage: string;
  authorEmail: string;
  parentId: string | null;
  createdAt: string;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ src, name }: { src: string; name: string }) {
  if (src) return <img src={src} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} referrerPolicy="no-referrer" />;
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function CommentBox({ onSubmit, placeholder, onCancel }: { onSubmit: (text: string) => void; placeholder: string; onCancel?: () => void }) {
  const [text, setText] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        onFocus={e => { e.target.style.borderColor = 'rgba(74,222,128,0.5)'; }}
        onBlur={e => { e.target.style.borderColor = 'rgba(74,222,128,0.2)'; }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { if (text.trim()) { onSubmit(text); setText(''); } }}
          disabled={!text.trim()}
          style={{ background: text.trim() ? '#4ade80' : 'rgba(74,222,128,0.2)', color: text.trim() ? '#000' : '#4ade80', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
        >
          Post
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function DiscussionPage() {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const isOwner = session?.user?.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;

  const fetchComments = useCallback(async () => {
    const res = await fetch('/api/comments');
    const data = await res.json();
    setComments(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  async function postComment(text: string, parentId: string | null = null) {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parentId }),
    });
    if (res.ok) fetchComments();
  }

  async function deleteComment(id: string) {
    await fetch('/api/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchComments();
  }

  const topLevel = comments.filter(c => !c.parentId);
  const replies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  const canDelete = (comment: Comment) =>
    session?.user?.email === comment.authorEmail || isOwner;

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '48px' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>Community</span>
            <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', margin: 0 }}>Discussion</h1>
            <p style={{ color: '#94a3b8', fontSize: '16px', marginTop: '12px' }}>Talk theories, share reactions, and connect with other fans.</p>
          </div>

          {/* Auth */}
          {!session ? (
            <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 12, padding: '32px', marginBottom: '40px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: 15 }}>Sign in to join the discussion</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { provider: 'google', label: 'Google', color: '#fff', bg: '#4285F4' },
                  { provider: 'github', label: 'GitHub', color: '#fff', bg: '#24292e' },
                  { provider: 'discord', label: 'Discord', color: '#fff', bg: '#5865F2' },
                ].map(({ provider, label, color, bg }) => (
                  <button
                    key={provider}
                    onClick={() => signIn(provider)}
                    style={{ background: bg, color, border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Sign in with {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar src={session.user?.image || ''} name={session.user?.name || ''} />
                <span style={{ color: '#e2e8f0', fontSize: 14 }}>Signed in as <strong>{session.user?.name}</strong></span>
                {isOwner && <span style={{ background: '#4ade80', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>OWNER</span>}
              </div>
              <button onClick={() => signOut()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', borderRadius: 6, padding: '6px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign out
              </button>
            </div>
          )}

          {/* New comment */}
          {session && (
            <div style={{ marginBottom: '48px' }}>
              <CommentBox onSubmit={text => postComment(text)} placeholder="What's on your mind? Share a theory, a reaction, anything..." />
            </div>
          )}

          {/* Comments */}
          {loading ? (
            <p style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading comments...</p>
          ) : topLevel.length === 0 ? (
            <p style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 13 }}>No comments yet. Be the first!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {topLevel.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(comment => (
                <div key={comment.id}>
                  {/* Top-level comment */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(74,222,128,0.1)', borderRadius: 10, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Avatar src={comment.authorImage} name={comment.authorName} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>{comment.authorName}</span>
                          <span style={{ color: '#475569', fontSize: 12 }}>{timeAgo(comment.createdAt)}</span>
                        </div>
                        <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.6, margin: 0, wordBreak: 'break-word' }}>{comment.text}</p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                          {session && (
                            <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} style={{ background: 'none', border: 'none', color: '#4ade80', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: 0 }}>
                              {replyingTo === comment.id ? 'cancel' : 'reply'}
                            </button>
                          )}
                          {canDelete(comment) && (
                            <button onClick={() => deleteComment(comment.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: 0 }}>
                              delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reply box */}
                  {replyingTo === comment.id && (
                    <div style={{ marginLeft: 48, marginTop: 8 }}>
                      <CommentBox
                        onSubmit={text => { postComment(text, comment.id); setReplyingTo(null); }}
                        placeholder={`Reply to ${comment.authorName}...`}
                        onCancel={() => setReplyingTo(null)}
                      />
                    </div>
                  )}

                  {/* Replies */}
                  {replies(comment.id).length > 0 && (
                    <div style={{ marginLeft: 48, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {replies(comment.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(reply => (
                        <div key={reply.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(74,222,128,0.07)', borderRadius: 8, padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <Avatar src={reply.authorImage} name={reply.authorName} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>{reply.authorName}</span>
                                <span style={{ color: '#475569', fontSize: 11 }}>{timeAgo(reply.createdAt)}</span>
                              </div>
                              <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0, wordBreak: 'break-word' }}>{reply.text}</p>
                              {canDelete(reply) && (
                                <button onClick={() => deleteComment(reply.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: 0, marginTop: 6 }}>
                                  delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
