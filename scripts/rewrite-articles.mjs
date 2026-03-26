import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// manually parse .env.local
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf8');
for (const line of envFile.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const existing = await redis.get('article_ids');
const ids = existing ? JSON.parse(existing) : [];
console.log(`Found ${ids.length} articles to rewrite...`);

for (const id of ids) {
  const raw = await redis.get(`article:${id}`);
  if (!raw) continue;
  const article = JSON.parse(raw);
  console.log(`Rewriting: "${article.title}"...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Rewrite this Clover Chaos wiki article with a more human, natural tone. Keep all the facts exactly the same but change the writing style.

Original article:
Title: ${article.title}
Content: ${article.content}

Clover Chaos lore: Pat is clueless not brave, Montreal is saved by Pat+Sarah+Matthew together, Matthew dies at the end of Phase 1 as the cost of their victory.

Writing style rules:
- Write like a real fan who watched the show and wants to share what they found interesting
- Conversational and grounded, not dramatic or over-the-top
- Short clear sentences
- Avoid: "tapestry", "culmination", "delves", "testament", "beacon", "pivotal", "resonate", "embark", "captivating", "showcase", "stands as", "serves as a reminder", "it is worth noting"
- No flowery intros or conclusions
- Sound like a human wrote it, not an AI

Return ONLY valid JSON:
{"title": "...", "excerpt": "one sentence summary", "content": "full rewritten article with paragraphs separated by \\n\\n"}`
    }]
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { console.log('  ✗ Failed to parse'); continue; }

  const rewritten = JSON.parse(match[0]);
  const updated = { ...article, ...rewritten };
  await redis.set(`article:${id}`, JSON.stringify(updated));
  console.log(`  ✓ Done: "${rewritten.title}"`);

  await new Promise(r => setTimeout(r, 1000));
}

await redis.disconnect();
console.log('All articles rewritten.');
