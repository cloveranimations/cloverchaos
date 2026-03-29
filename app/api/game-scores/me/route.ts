import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

type Entry = { email: string; name: string; image: string; score: number };

async function getRedis() {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  return redis;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ score: 0 });
  }
  const redis = await getRedis();
  try {
    const raw = await redis.get('game_leaderboard');
    const entries: Entry[] = raw ? JSON.parse(raw as string) : [];
    const mine = entries.find(e => e.email === session.user!.email);
    return NextResponse.json({ score: mine?.score ?? 0 });
  } finally {
    await redis.disconnect();
  }
}
