'use client';

import { useState } from 'react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

export default function WritePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);

  function handlePublish() {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPublished(true);
    }, 1800);
  }

  if (published) {
    return (
      <main>
        <AnimatedBackground />
        <Navigation />
        <section style={{ padding: '140px 20px 100px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🍀</div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontFamily: 'var(--font-display)', color: '#4ade80', marginBottom: '16px' }}>
              Article Published!
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '16px', lineHeight: '1.7', marginBottom: '32px' }}>
              Your article <strong style={{ color: '#e2e8f0' }}>"{title}"</strong> is now live on the Clover Chaos Wiki. Thanks for contributing, {author || 'anonymous'}!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a
                href="/articles"
                style={{ background: '#4ade80', color: '#000', padding: '12px 28px', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}
              >
                Back to Articles
              </a>
              <button
                onClick={() => { setPublished(false); setTitle(''); setContent(''); setAuthor(''); }}
                style={{ background: 'transparent', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', padding: '12px 28px', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
              >
                Write Another
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          <div style={{ marginBottom: '48px' }}>
            <a
              href="/articles"
              style={{ display: 'inline-block', color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', textDecoration: 'none', marginBottom: '24px', opacity: 0.7 }}
            >
              ← Back to Articles
            </a>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '12px', textTransform: 'uppercase' }}>Wiki</span>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '8px' }}>Write an Article</h1>
            <p style={{ color: '#64748b', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>Share your theories, character breakdowns, and lore analysis with the community.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div>
              <label style={{ display: 'block', color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Article Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Why Matthew Was the Real Hero All Along"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: '8px', padding: '14px 18px', color: '#e2e8f0', fontSize: '16px',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.2)'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Your Name / Username
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. gravity_falls_truther"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: '8px', padding: '14px 18px', color: '#e2e8f0', fontSize: '16px',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.2)'; }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Article Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article here. Share theories, character analysis, episode breakdowns, lore deep-dives — anything goes."
                rows={16}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: '8px', padding: '14px 18px', color: '#e2e8f0', fontSize: '16px',
                  fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: '1.8',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(74,222,128,0.2)'; }}
              />
              <p style={{ color: '#475569', fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
                {content.length} characters · {content.trim() ? content.trim().split(/\s+/).length : 0} words
              </p>
            </div>

            <button
              onClick={handlePublish}
              disabled={!title.trim() || !content.trim() || loading}
              style={{
                background: title.trim() && content.trim() ? '#4ade80' : 'rgba(74,222,128,0.2)',
                color: title.trim() && content.trim() ? '#000' : '#4ade80',
                border: 'none', borderRadius: '8px', padding: '16px 40px',
                fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px',
                cursor: title.trim() && content.trim() ? 'pointer' : 'not-allowed',
                alignSelf: 'flex-start', transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Publishing...' : 'Publish Article'}
            </button>

          </div>
        </div>
      </section>
    </main>
  );
}
