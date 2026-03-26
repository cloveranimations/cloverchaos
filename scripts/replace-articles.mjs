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

const idsToReplace = ['1774467366485', '1774467298571', '1774467270386'];

const kaseyTopics = [
  "Kasey Heffley's obsession with the pocketwatch and what it says about her",
  "what it's actually like for Kasey being stuck in the Theaneb dimension",
  "Kasey and Valentina's friendship before everything went wrong",
];

const lore = `Clover Chaos is an indie animated web series set in 2018 Montreal. Main characters: Pat (protagonist, wields a magical pocketwatch — clueless, not brave), Sarah (anxious and shy), Matthew (grumpy friend who dies at the end of Phase 1 sacrificing himself to save Montreal), Kasey Heffley (rival trapped in the Theaneb dimension, obsessed with the pocketwatch and world conquest — but also kind of tragic), Valentina Venezetti (The Engineer — Kasey's former best friend, portal-jumping abilities, robot sidekick Velma), Mark Heffley (villain, invented the StarGazer, willing to sacrifice his own daughter Kasey for recognition). Montreal is saved by Pat, Sarah, and Matthew together.`;

for (let i = 0; i < idsToReplace.length; i++) {
  const id = idsToReplace[i];
  const topic = kaseyTopics[i];
  console.log(`Generating new Kasey article: "${topic}"...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Write a wiki-style article (300-400 words) for the Clover Chaos fan wiki about: ${topic}.

${lore}

Writing style: casual, conversational, like a real fan wrote it. Short clear sentences. No dramatic flair. No words like "tapestry", "culmination", "delves", "testament", "beacon", "pivotal", "resonate", "captivating". Sound human.

Return ONLY valid JSON:
{"title": "...", "excerpt": "one sentence summary", "content": "full article with paragraphs separated by \\n\\n"}`
    }]
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { console.log('  ✗ Failed'); continue; }

  const article = JSON.parse(match[0]);
  const articleData = { id, ...article, createdAt: new Date().toISOString() };
  await redis.set(`article:${id}`, JSON.stringify(articleData));
  console.log(`  ✓ "${article.title}"`);

  await new Promise(r => setTimeout(r, 1000));
}

await redis.disconnect();
console.log('Done.');
