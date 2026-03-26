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

const usernames = [
  'xX_breakingbad_fan_Xx', 'naruto_ran_so_we_could_walk', 'totoro_is_life23',
  'officefan_XD', 'izuku_my_hero_lol', 'stranger_things_nerd11', 'the_wire_appreciator',
  'attackontitanXx', 'ghibli_obsessed99', 'one_piece_enjoyer_:3', 'peakyblinder_irl',
  'deathnote_was_peak', 'hxh_cried_twice', 'avgn_fan_forever', 'bojack_horsefan_xd',
  'gravity_falls_truther', 'over_the_garden_wall_fan', 'steven_universe_rock',
  'adventure_time_jake', 'regularshow_mordecai', 'invincible_spoilers_lol',
  'south_park_cartman_xd', 'futurama_fry_meme', 'spongebob_irl_:D',
  'arcane_cried_ngl', 'castlevania_dracula', 'midnight_mass_believer',
  'its_always_sunny_gang', 'the_boys_hughie_fan', 'ozark_wendy_apologist',
  'succession_kendall_xD', 'andor_deserved_more', 'blue_eye_samurai_art',
];

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const existing = await redis.get('article_ids');
const ids = existing ? JSON.parse(existing) : [];

for (const id of ids) {
  const raw = await redis.get(`article:${id}`);
  if (!raw) continue;
  const article = JSON.parse(raw);
  const newAuthor = usernames[Math.floor(Math.random() * usernames.length)];
  await redis.set(`article:${id}`, JSON.stringify({ ...article, author: newAuthor }));
  console.log(`✓ ${article.title} → ${newAuthor}`);
}

await redis.disconnect();
console.log('Done.');
