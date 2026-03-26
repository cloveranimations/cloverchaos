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
  const redis = await getRedis();
  try {
    const raw = await redis.get('game_leaderboard');
    const entries: Entry[] = raw ? JSON.parse(raw as string) : [];
    const top10 = entries.sort((a, b) => b.score - a.score).slice(0, 10);
    return NextResponse.json(top10);
  } finally {
    await redis.disconnect();
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { score } = await req.json();
  if (typeof score !== 'number' || score < 0 || !Number.isFinite(score)) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
  }

  const email = session.user.email;
  const redis = await getRedis();
  try {
    const raw = await redis.get('game_leaderboard');
    const entries: Entry[] = raw ? JSON.parse(raw as string) : [];
    const existing = entries.find(e => e.email === email);
    if (existing && existing.score >= score) {
      return NextResponse.json({ updated: false, best: existing.score });
    }
    const newEntry: Entry = {
      email,
      name: session.user.name || 'Anonymous',
      image: session.user.image || '',
      score,
    };
    const updated = existing
      ? entries.map(e => e.email === email ? newEntry : e)
      : [...entries, newEntry];
    await redis.set('game_leaderboard', JSON.stringify(updated));
    return NextResponse.json({ updated: true, score });
  } finally {
    await redis.disconnect();
  }
}
