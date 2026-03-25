import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const topics = [
  'a deep lore analysis of the Theaneb dimension and its connection to Montreal',
  'a character spotlight on Pat and his accidental heroism',
  'a character spotlight on Kasey Heffley and her motivations',
  'a theory about the true nature of the Interdimensional Being',
  'an analysis of Mark Heffley as the mastermind villain of Phase 1',
  'a breakdown of the StarGazer machine and its consequences',
  'a character spotlight on Valentina Venezetti and her portal abilities',
  'a theory about what Phase 2 holds for the Clover Chaos universe',
  'an analysis of the friendship dynamics between Pat, Sarah, and Matthew',
  'the significance of the magical pocketwatch in Clover Chaos',
  'Montreal as a character in Clover Chaos',
  'the role of Velma the robot sidekick in the series',
  'how Phase 1 sets up the events of Phase 2',
  'the symbolism of the shamrock in Clover Chaos',
  'the breakdown of the cute-intense visual aesthetic of Clover Chaos',
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();

  try {
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Write a short engaging wiki-style article (300-400 words) for the Clover Chaos fan wiki about: ${topic}.

Clover Chaos is an indie animated web series set in 2018 Montreal. Main characters: Pat (protagonist, wields a magical pocketwatch), Sarah (anxious friend), Matthew (grumpy friend), Kasey Heffley (rival trapped in the Theaneb dimension), Valentina Venezetti (engineer/gatekeeper with robot sidekick Velma), Mark Heffley (villain/mastermind who invented the StarGazer).

Format with a compelling title, 2-3 paragraphs, lore-accurate and exciting for fans.

Return ONLY valid JSON in this exact format:
{"title": "...", "excerpt": "one sentence summary", "content": "full article text with paragraphs separated by \\n\\n"}`,
        },
      ],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Failed to parse article' }, { status: 500 });

    const article = JSON.parse(jsonMatch[0]);
    const id = Date.now().toString();
    const articleData = { id, ...article, createdAt: new Date().toISOString() };

    const existing = await redis.get('article_ids');
    const ids: string[] = existing ? JSON.parse(existing) : [];
    await redis.set(`article:${id}`, JSON.stringify(articleData));
    await redis.set('article_ids', JSON.stringify([id, ...ids].slice(0, 200)));

    return NextResponse.json({ success: true, article: articleData });
  } finally {
    await redis.disconnect();
  }
}
