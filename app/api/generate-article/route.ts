import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';
import { NextResponse } from 'next/server';

const topics = [
  'a deep lore analysis of the Theaneb dimension and its connection to Montreal',
  'a character spotlight on Pat and how his cluelessness accidentally shapes the story',
  'a character spotlight on Kasey Heffley and her motivations',
  'a deep dive into what Kasey Heffley actually wants and why she is the way she is',
  'an analysis of Mark Heffley as the mastermind villain of Phase 1',
  'a breakdown of the StarGazer machine and its consequences',
  'a character spotlight on Valentina Venezetti and her portal abilities',
  'a theory about what Phase 2 holds for the Clover Chaos universe',
  'an analysis of the friendship dynamics between Pat, Sarah, and Matthew, and the tragedy of Matthew\'s sacrifice',
  'the significance of the magical pocketwatch in Clover Chaos',
  'Montreal as a character in Clover Chaos',
  'the role of Velma the robot sidekick in the series',
  'how Phase 1 sets up the events of Phase 2',
  'the symbolism of the shamrock in Clover Chaos',
  'the breakdown of the cute-intense visual aesthetic of Clover Chaos',
];

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

function randomDate(): string {
  const start = new Date('2022-08-24').getTime();
  const end = new Date('2026-03-25').getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
}

const lore = `Clover Chaos is an indie animated web series set in 2018 Montreal. Main characters: Pat (protagonist, wields a magical pocketwatch — he is not brave or heroic, just clueless and stumbles into situations), Sarah (anxious and shy friend), Matthew (grumpy, perpetually bored friend who sacrifices his life to help save Montreal — he dies at the end of Phase 1), Kasey Heffley (rival trapped in the Theaneb dimension, obsessed with the pocketwatch and world conquest), Valentina Venezetti (The Engineer — Kasey's former best friend, possesses portal-jumping abilities, works with her robot sidekick Velma to protect the world), Mark Heffley (villain/mastermind — a mysterious neighbor who invented the StarGazer and is the true architect of Phase 1, willing to sacrifice even his own daughter for recognition). Important lore: Montreal is saved by the trio — Pat, Sarah, and Matthew — together, not by Pat alone. Matthew's death is a major emotional cost of their victory. Pat's role is accidental and driven by confusion rather than courage. Phase 1 episodes: Ep1 "The Bucket List" (the trio's last normal summer, pilot), Ep2 "A Tale Of Incidents" (the 'Crazy Father'/Mark begins interfering), Ep3 "Back To Reality" (a massive tear in reality, the Interdimensional Being arrives), Ep4 "A Fading Shamrock" (the Father's threat is stopped but at great cost, the Interdimensional Being delivers a final warning setting up Phase 2).`;

const styleGuide = `Writing style: Write like an actual fan who edited a wiki page. Keep it short — 100 to 180 words max. Casual, conversational, a little rough. Some entries can be really short (2-3 sentences) if the topic is simple. Include occasional mild typos (missing apostrophe, or a repeated word once), light fan slang (ngl, tbh, idk, honestly, kinda, sorta, rly). Max 1-2 typos. No dramatic AI language. No "tapestry", "culmination", "delves", "testament", "beacon", "pivotal", "resonate", "captivating". Short sentences. Sound like someone who loves the show dashed this off real quick.`;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = createClient({ url: process.env.REDIS_URL });
  try {
    await redis.connect();
  } catch (e) {
    return NextResponse.json({ error: 'Redis connect failed', detail: String(e) }, { status: 500 });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const author = usernames[Math.floor(Math.random() * usernames.length)];

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Write a wiki-style article (300-400 words) for the Clover Chaos fan wiki about: ${topic}.

${lore}

${styleGuide}

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
    const articleData = { id, ...article, author, createdAt: randomDate() };

    const existing = await redis.get('article_ids');
    const ids: string[] = existing ? JSON.parse(existing) : [];
    await redis.set(`article:${id}`, JSON.stringify(articleData));
    await redis.set('article_ids', JSON.stringify([id, ...ids].slice(0, 200)));

    return NextResponse.json({ success: true, article: articleData });
  } catch (e) {
    return NextResponse.json({ error: 'Generation failed', detail: String(e) }, { status: 500 });
  } finally {
    await redis.disconnect();
  }
}
