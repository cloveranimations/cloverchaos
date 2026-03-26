import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
console.log(`Shortening ${ids.length} articles...`);

for (const id of ids) {
  const raw = await redis.get(`article:${id}`);
  if (!raw) continue;
  const article = JSON.parse(raw);
  console.log(`  "${article.title}"...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Rewrite this Clover Chaos wiki article to be shorter and more casual — like a real fan wiki entry, not an essay. Keep all facts correct. Aim for 100-180 words max. Should feel like someone dashed it off because they wanted to share something cool, not like a school report. Some articles can be really short (2-3 sentences) if the topic is simple. Keep the typos and slang if there are any.

Title: ${article.title}
Content: ${article.content}

Return ONLY valid JSON:
{"title": "...", "excerpt": "one sentence summary", "content": "shortened article with paragraphs separated by \\n\\n"}`
    }]
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { console.log('    ✗ failed'); continue; }

  const shortened = JSON.parse(match[0]);
  const updated = { ...article, ...shortened };
  await redis.set(`article:${id}`, JSON.stringify(updated));
  console.log(`    ✓ done`);

  await new Promise(r => setTimeout(r, 800));
}

await redis.disconnect();
console.log('All done.');
