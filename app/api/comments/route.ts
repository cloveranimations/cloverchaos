import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

type Comment = {
  id: string;
  text: string;
  authorName: string;
  authorImage: string;
  authorEmail: string;
  parentId: string | null;
  createdAt: string;
};

async function getRedis() {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  return redis;
}

export async function GET() {
  const redis = await getRedis();
  try {
    const data = await redis.get('comments');
    const comments: Comment[] = data ? JSON.parse(data) : [];
    return NextResponse.json(comments);
  } finally {
    await redis.disconnect();
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { text, parentId } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });

  const comment: Comment = {
    id: Date.now().toString(),
    text: text.trim().slice(0, 1000),
    authorName: session.user.name || 'Anonymous',
    authorImage: session.user.image || '',
    authorEmail: session.user.email || '',
    parentId: parentId || null,
    createdAt: new Date().toISOString(),
  };

  const redis = await getRedis();
  try {
    const data = await redis.get('comments');
    const comments: Comment[] = data ? JSON.parse(data) : [];
    comments.push(comment);
    await redis.set('comments', JSON.stringify(comments));
    return NextResponse.json(comment);
  } finally {
    await redis.disconnect();
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const isOwner = session.user.email === process.env.OWNER_EMAIL;
  const { id } = await req.json();

  const redis = await getRedis();
  try {
    const data = await redis.get('comments');
    const comments: Comment[] = data ? JSON.parse(data) : [];
    const comment = comments.find(c => c.id === id);
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canDelete = isOwner || comment.authorEmail === session.user.email;
    if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // delete comment and all its replies
    const filtered = comments.filter(c => c.id !== id && c.parentId !== id);
    await redis.set('comments', JSON.stringify(filtered));
    return NextResponse.json({ success: true });
  } finally {
    await redis.disconnect();
  }
}
