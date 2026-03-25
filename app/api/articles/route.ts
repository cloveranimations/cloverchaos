import redis from '@/lib/redis';
import { NextResponse } from 'next/server';

export async function GET() {
  const existing = await redis.get('article_ids');
  const ids: string[] = existing ? JSON.parse(existing) : [];
  const articles = await Promise.all(ids.map(async (id) => {
    const data = await redis.get(`article:${id}`);
    return data ? JSON.parse(data) : null;
  }));
  return NextResponse.json(articles.filter(Boolean));
}
