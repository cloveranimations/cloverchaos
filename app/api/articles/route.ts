import { createClient } from 'redis';
import { NextResponse } from 'next/server';

export async function GET() {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();

  try {
    const existing = await redis.get('article_ids');
    const ids: string[] = existing ? JSON.parse(existing) : [];
    const articles = await Promise.all(ids.map(async (id) => {
      const data = await redis.get(`article:${id}`);
      return data ? JSON.parse(data) : null;
    }));
    return NextResponse.json(articles.filter(Boolean));
  } finally {
    await redis.disconnect();
  }
}
