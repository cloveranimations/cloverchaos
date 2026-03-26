import { notFound } from 'next/navigation';
import { createClient } from 'redis';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

type Article = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  createdAt: string;
  author?: string;
};

async function getArticle(id: string): Promise<Article | null> {
  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    await redis.connect();
    const data = await redis.get(`article:${id}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  } finally {
    await redis.disconnect();
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return { title: 'Article Not Found' };
  return {
    title: `${article.title} | Clover Chaos Wiki`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          <a
            href="/articles"
            style={{ display: 'inline-block', background: 'transparent', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', marginBottom: '48px', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '1px' }}
          >
            ← Back to Articles
          </a>

          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>
            Wiki Article
          </span>

          <h1 style={{ fontSize: 'clamp(28px, 5vw, 60px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '16px', lineHeight: '1.15' }}>
            {article.title}
          </h1>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#64748b', marginBottom: '48px' }}>
            {new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {article.author && <span style={{ marginLeft: '16px' }}>— {article.author}</span>}
          </p>

          <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: '1.7', marginBottom: '40px', fontStyle: 'italic', borderLeft: '3px solid rgba(74,222,128,0.4)', paddingLeft: '20px' }}>
            {article.excerpt}
          </p>

          <div>
            {article.content.split('\n\n').map((para, i) => (
              <p key={i} style={{ color: '#cbd5e1', fontSize: '17px', lineHeight: '1.9', marginBottom: '24px' }}>
                {para}
              </p>
            ))}
          </div>

        </div>
      </section>
    </main>
  );
}
