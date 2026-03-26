import { createClient } from 'redis';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

export const dynamic = 'force-dynamic';

type Article = {
  id: string;
  title: string;
  excerpt: string;
  createdAt: string;
};

async function getArticles(): Promise<Article[]> {
  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    await redis.connect();
    const existing = await redis.get('article_ids');
    const ids: string[] = existing ? JSON.parse(existing) : [];
    const articles = await Promise.all(
      ids.map(async (id) => {
        const data = await redis.get(`article:${id}`);
        return data ? JSON.parse(data) : null;
      })
    );
    return articles.filter(Boolean);
  } catch {
    return [];
  } finally {
    await redis.disconnect();
  }
}

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ marginBottom: '64px' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>Wiki</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', margin: 0 }}>Articles</h1>
              <a
                href="/articles/write"
                style={{ background: '#4ade80', color: '#000', padding: '12px 28px', borderRadius: '8px', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '15px', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                Write
              </a>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '16px', marginTop: '12px' }}>Articles made to be seen! Write yours now!</p>
          </div>

          {articles.length === 0 ? (
            <p style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>No articles yet. Check back soon.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {articles.map((article) => (
                <a
                  key={article.id}
                  href={`/articles/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div
                    className="card"
                    style={{ borderColor: 'rgba(74,222,128,0.15)', height: '100%' }}
                  >
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                      {new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '10px' }}>{article.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>{article.excerpt}</p>
                    <span style={{ display: 'inline-block', marginTop: '16px', color: '#4ade80', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>Read more →</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
