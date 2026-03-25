'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  createdAt: string;
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/articles')
      .then((r) => r.json())
      .then((data) => { setArticles(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ marginBottom: '64px' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>Wiki</span>
            <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80' }}>Articles</h1>
          </div>

          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', marginBottom: '40px', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px' }}
              >
                ← Back to Articles
              </button>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                {new Date(selected.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <h2 style={{ fontSize: 'clamp(24px, 4vw, 48px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '32px' }}>{selected.title}</h2>
              {selected.content.split('\n\n').map((para, i) => (
                <p key={i} style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.9', marginBottom: '20px' }}>{para}</p>
              ))}
            </div>
          ) : loading ? (
            <p style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>Loading articles...</p>
          ) : articles.length === 0 ? (
            <p style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>No articles yet. Check back soon.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="card"
                  style={{ cursor: 'pointer', borderColor: 'rgba(74,222,128,0.15)' }}
                  onClick={() => setSelected(article)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.5)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.15)'; }}
                >
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                    {new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '10px' }}>{article.title}</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>{article.excerpt}</p>
                  <span style={{ display: 'inline-block', marginTop: '16px', color: '#4ade80', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Read more →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
