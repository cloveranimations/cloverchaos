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

const usernames = [
  'xXNightStalker77Xx', 'creeper_aw_man', 'notabot_trust', 'blazeit_420noscope',
  'link_to_the_past99', 'luigi_number1', 'enderman_slayer', 'sonic_was_here',
  'peely_banana42', 'dragonborn_irl', 'sans_undertale_fan', 'pikachufan2007',
  'master_chief_117', 'kratos_god_mode', 'toad_is_underrated', 'spyro_reignited',
  'minecraft_steve404', 'goku_ultra_fan', 'kirby_inhale_bro', 'the_real_herobrine',
  'squid_game_loser', 'roblox_refugee', 'pokefan_2016', 'zeldanerdd',
  'valorant_hardstuck', 'among_us_red', 'stardew_farmer99', 'fnaf_lore_guy',
];

function randomDate() {
  const start = new Date('2022-08-24').getTime();
  const end = new Date('2026-03-25').getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
}

function randomUser() {
  return usernames[Math.floor(Math.random() * usernames.length)];
}

const existing = await redis.get('article_ids');
const ids = existing ? JSON.parse(existing) : [];
console.log(`Humanizing ${ids.length} articles...`);

for (const id of ids) {
  const raw = await redis.get(`article:${id}`);
  if (!raw) continue;
  const article = JSON.parse(raw);
  console.log(`  "${article.title}"...`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Rewrite this Clover Chaos wiki article so it sounds like a real fan wrote it. Keep all facts the same.

Title: ${article.title}
Content: ${article.content}

Writing style: casual, conversational, a little rough. Include 1-2 subtle typos (like missing apostrophe or minor misspelling). Use light fan slang occasionally (ngl, tbh, honestly, kinda, sorta, like actually, idk why but). No dramatic AI language. No "tapestry", "culmination", "delves", "testament", "beacon", "pivotal", "resonate", "captivating". Short sentences. Sound like someone who loves the show wrote this late at night.

Return ONLY valid JSON:
{"title": "...", "excerpt": "one sentence summary", "content": "full rewritten article with paragraphs separated by \\n\\n"}`
    }]
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) { console.log('    ✗ parse failed'); continue; }

  const rewritten = JSON.parse(match[0]);
  const updated = {
    ...article,
    ...rewritten,
    author: article.author || randomUser(),
    createdAt: randomDate(),
  };
  await redis.set(`article:${id}`, JSON.stringify(updated));
  console.log(`    ✓ done`);

  await new Promise(r => setTimeout(r, 800));
}

await redis.disconnect();
console.log('All done.');
