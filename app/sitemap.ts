import type { MetadataRoute } from 'next';
import { createClient } from 'redis';

async function getArticleIds(): Promise<string[]> {
  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    await redis.connect();
    const existing = await redis.get('article_ids');
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  } finally {
    await redis.disconnect();
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = [
    { url: 'https://cloverchaos.com', priority: 1, changeFrequency: 'monthly' as const },
    { url: 'https://cloverchaos.com/about', priority: 0.8, changeFrequency: 'monthly' as const },
    { url: 'https://cloverchaos.com/episodes', priority: 0.8, changeFrequency: 'monthly' as const },
    { url: 'https://cloverchaos.com/characters', priority: 0.8, changeFrequency: 'monthly' as const },
    { url: 'https://cloverchaos.com/articles', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: 'https://cloverchaos.com/subscribe', priority: 0.6, changeFrequency: 'monthly' as const },
  ].map((p) => ({ ...p, lastModified: new Date() }));

  const ids = await getArticleIds();
  const articlePages = ids.map((id) => ({
    url: `https://cloverchaos.com/articles/${id}`,
    lastModified: new Date(),
    changeFrequency: 'never' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...articlePages];
}
