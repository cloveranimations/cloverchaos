import { createClient } from 'redis';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    await redis.connect();
  } catch (e) {
    return NextResponse.json({ error: 'Redis connect failed', detail: String(e) }, { status: 500 });
  }
  try {
    const data = await redis.get(`article:${id}`);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(JSON.parse(data));
  } finally {
    await redis.disconnect();
  }
}
