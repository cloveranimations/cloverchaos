'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function AnimatedElement({
  children,
  delay = 0,
  direction = 'up',
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}) {
  const { ref, inView } = useInView();

  const animationName = {
    up: 'fadeInUp',
    down: 'fadeInDown',
    left: 'slideInLeft',
    right: 'slideInRight',
  }[direction];

  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        animation: inView ? `${animationName} 0.6s ease-out forwards` : 'none',
        animationDelay: inView ? `${delay}s` : '0s',
      }}
    >
      {children}
    </div>
  );
}

const episodes = [
  {
    num: '01',
    title: 'The Bucket List',
    desc: 'The series premiere introduces Pat and his two best friends in a stylized 2018 Montreal. The trio is looking forward to a typical summer break, but the atmosphere is quickly established as "cheesy yet satirical." The episode sets the groundwork for the show\'s unique "cute-intense" aesthetic.',
    duration: '12:57',
    tags: ['PILOT', 'ADVENTURE'],
    url: 'https://youtu.be/KRkx658fbEk?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc',
    thumbnail: 'https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg',
  },
  {
    num: '02',
    title: 'A Tale Of Incidents',
    desc: 'The stakes escalate as the "Crazy Father" begins to actively interfere with the trio\'s plans. This episode focuses heavily on character dynamics, showcasing the chemistry between Pat and his teammates as they attempt to investigate the strange occurrences around their homes.',
    duration: '31:53',
    tags: ['ACTION', 'MYSTERY'],
    url: 'https://youtu.be/1GT0ThpLdV0?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc',
    thumbnail: 'https://img.youtube.com/vi/1GT0ThpLdV0/maxresdefault.jpg',
  },
  {
    num: '03',
    title: 'Back To Reality',
    desc: 'The "Satirical" tone takes a backseat to "Mystery" and "Lore" in this pivotal episode. A massive tear in reality occurs, leading to the arrival of the Interdimensional Being. The trio finds themselves caught in a three-way conflict between their summer goals, the Father\'s madness, and this new cosmic entity.',
    duration: '41:36',
    tags: ['COMEDY', 'RACE'],
    url: 'https://youtu.be/3AxVSqjbE0s?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc',
    thumbnail: 'https://img.youtube.com/vi/3AxVSqjbE0s/maxresdefault.jpg',
  },
  {
    num: '04',
    title: 'A Fading Shamrock',
    desc: "The team successfully fends off the Father's immediate threat, but at a great cost to their anonymity. The Interdimensional Being delivers a final warning before vanishing, setting the stage for Phase 2.",
    duration: '39:54',
    tags: ['DRAMA', 'REVEAL'],
    url: 'https://youtu.be/K3Da51RfROM?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc',
    thumbnail: 'https://img.youtube.com/vi/K3Da51RfROM/maxresdefault.jpg',
  },
  {
    num: '05',
    title: 'Taradiddle',
    desc: 'Pat returns to Montreal after 10 months and stumbles upon the old building, getting chased by Mark\'s drones. Saved by former agent McCallister and Velma, the trio hunts down Mark\'s mythical headquarters — only for Pat and Valentina to be captured by Mark himself.',
    duration: '13:06',
    tags: ['PHASE 2', 'ADVENTURE'],
    url: 'https://youtu.be/R8kc1_Nusrs',
    thumbnail: 'https://img.youtube.com/vi/R8kc1_Nusrs/maxresdefault.jpg',
  },
  { num: '06', title: 'Death over Deal', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
  { num: '07', title: 'Catalyst', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
  { num: '08', title: 'Clover Chaos', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
];

const mainCast = [
  {
    name: 'Pat',
    role: 'The Protagonist',
    bio: 'Clueless, silly, and occasionally just plain stupid, Pat somehow finds himself the primary wielder of the magical pocketwatch. His accidental leadership is what keeps the group moving forward—even if he isn\'t always sure where they\'re going.',
    color: '#4ade80',
    image: 'https://i.imgur.com/m6CXyWD.png',
  },
  {
    name: 'Sarah',
    role: 'The Anxious Heart',
    bio: 'Sharing much of Pat\'s silly nature, Sarah adds a layer of shyness and anxiety to the group\'s dynamic. She is often the most stressed by the supernatural incidents, especially when Pat\'s "clueless" decisions leave her feeling overwhelmed.',
    color: '#f9a8d4',
    image: 'https://i.imgur.com/5bXuwk1.png',
  },
  {
    name: 'Matthew',
    role: 'The Reluctant Member',
    bio: 'Perpetually bored, annoyed, and grumpy. He treats interdimensional threats and city-wide fires as massive inconveniences. His grounded, cynical attitude provides a necessary balance to the team\'s more frantic energy.',
    color: '#fbbf24',
    image: 'https://i.imgur.com/H5gr7Xe.png',
  },
];

const rivalCast = [
  {
    name: 'Kasey Heffley',
    role: 'The Trapped Rival',
    bio: 'Trapped within the Theaneb, her "evil" streak is fueled by a desire for power and a plan to conquer the world once she escapes. She is relentless in her pursuit of the pocketwatch, viewing everyone—including her own father—as an obstacle.',
    color: '#f87171',
    image: 'https://i.imgur.com/0ELhwgN.png',
  },
  {
    name: 'Valentina Venezetti',
    role: 'The Engineer',
    bio: 'Just as determined and ambitious as her former best friend Kasey, Valentina uses her drive for protection rather than conquest. Alongside her robot sidekick Velma, she uses her portal-jumping abilities to shield the world from darkness.',
    color: '#c084fc',
    image: 'https://i.imgur.com/NUGITUU.png',
  },
  {
    name: 'Mark Heffley',
    role: 'The Mastermind',
    bio: 'The neighbor of the three teenagers and the true mastermind of Phase 1. A dark, mysterious figure whose "pure evil" nature is revealed through his invention of the StarGazer—a man who would sacrifice his own daughter for a Nobel Prize.',
    color: '#94a3b8',
    image: 'https://i.imgur.com/yVxWcFU.png',
  },
];

export default function Home() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      {/* HERO SECTION */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 20px 40px',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'url(https://i.imgur.com/9drHW0y.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 0 }} />
        <div style={{ maxWidth: '1000px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <AnimatedElement delay={0.1}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: '500',
                letterSpacing: '2px',
                color: '#4ade80',
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                padding: '8px 16px',
                borderRadius: '24px',
                marginBottom: '16px',
                textTransform: 'uppercase',
              }}
            >
              An Indie Animated Series
            </span>
          </AnimatedElement>

          <AnimatedElement delay={0.15}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <Image
                src="/logo.png"
                alt="Clover Chaos Logo"
                width={120}
                height={120}
                priority
                style={{
                  borderRadius: '50%',
                  filter: 'drop-shadow(0 0 30px rgba(74, 222, 128, 0.4))',
                }}
              />
            </div>
          </AnimatedElement>

          <AnimatedElement delay={0.2}>
            <h1
              style={{
                fontSize: 'clamp(40px, 7vw, 90px)',
                fontFamily: 'Cubano, var(--font-display)',
                fontWeight: '700',
                lineHeight: '0.9',
                marginBottom: '12px',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.02em',
              }}
            >
              Clover<br />Chaos
            </h1>
            <p
              style={{
                fontFamily: 'Cubano, var(--font-display)',
                fontSize: 'clamp(16px, 2.5vw, 28px)',
                color: '#4ade80',
                lineHeight: '0.75',
                letterSpacing: '0.05em',
                marginTop: '-12px',
                marginBottom: '0',
              }}
            >
              Clover Animations
            </p>
          </AnimatedElement>


          <AnimatedElement delay={0.4}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '28px' }}>
              <a href="https://www.youtube.com/@cloverranimations" target="_blank" rel="noopener noreferrer" className="btn btn-primary">Watch Now</a>
              <a href="https://www.patreon.com/cw/CloverrAnimations" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Support Us!</a>
              <a href="https://clover-chaos.fandom.com/wiki/Clover_Chaos_Wiki" target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Know More</a>
              <a href="#episodes" className="btn btn-secondary">View Episodes</a>
            </div>
          </AnimatedElement>
        </div>

        {/* Scroll indicator */}
        <AnimatedElement delay={0.8}>
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#4ade80',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Scroll
            </span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </AnimatedElement>
      </section>

      {/* EPISODES SECTION */}
      <section id="episodes" style={{ padding: '100px 20px', position: 'relative', overflow: 'hidden' }}>
        {/* Video background */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'url(https://img.youtube.com/vi/zXVoG3z8CMo/maxresdefault.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(4px)', transform: 'scale(1.05)' }} />
        {/* Dark overlay over video */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 0 }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <AnimatedElement>
            <div style={{ marginBottom: '64px', textAlign: 'center' }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '2px',
                  color: '#4ade80',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                }}
              >
                Phase One
              </span>
              <h2
                style={{
                  fontSize: 'clamp(36px, 5vw, 72px)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '700',
                  color: '#4ade80',
                }}
              >
                Episodes
              </h2>
            </div>
          </AnimatedElement>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            {episodes.map((ep, idx) => (
              <AnimatedElement key={ep.num} delay={idx * 0.1}>
                <div
                  className="card"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    backgroundImage: ep.thumbnail ? `url(${ep.thumbnail})` : 'none',
                    backgroundColor: ep.thumbnail ? 'transparent' : '#0f172a',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    height: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '0',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74, 222, 128, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226, 232, 240, 0.1)';
                  }}
                >
                  {/* Dark overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                      zIndex: 1,
                    }}
                  />
                  {/* Chapter number watermark */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      fontSize: '110px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.25)',
                      lineHeight: '1',
                      zIndex: 2,
                      userSelect: 'none',
                    }}
                  >
                    {parseInt(ep.num)}
                  </div>

                  <div style={{ position: 'relative', zIndex: 3, padding: '14px' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {ep.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '9px',
                            fontWeight: '600',
                            letterSpacing: '1px',
                            color: '#4ade80',
                            background: 'rgba(74, 222, 128, 0.15)',
                            border: '1px solid rgba(74, 222, 128, 0.3)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <h3
                      style={{
                        fontSize: '14px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: '700',
                        marginBottom: '6px',
                        color: '#e2e8f0',
                        lineHeight: '1.3',
                      }}
                    >
                      {ep.title}
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(226, 232, 240, 0.15)',
                        color: '#64748b',
                        fontSize: '11px',
                      }}
                    >
                      <span>{ep.duration}</span>
                      {ep.url ? (
                        <a href={ep.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', textDecoration: 'none', fontSize: '11px' }}>&#9654; Watch</a>
                      ) : (
                        <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px' }}>COMING SOON</span>
                      )}
                    </div>
                  </div>
                </div>
              </AnimatedElement>
            ))}
          </div>
        </div>
      </section>

      {/* CHARACTERS SECTION */}
      <section id="characters" style={{ padding: '100px 20px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <AnimatedElement>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '2px',
                  color: '#4ade80',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                }}
              >
                Meet the Cast
              </span>
              <h2
                style={{
                  fontSize: 'clamp(36px, 5vw, 72px)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '700',
                  color: '#4ade80',
                }}
              >
                Characters
              </h2>
            </div>
          </AnimatedElement>

          {[{ label: 'Main Cast', group: mainCast }, { label: 'The Heffleys & The Rival', group: rivalCast }].map(({ label, group }) => (
            <div key={label} style={{ marginBottom: '64px' }}>
              <AnimatedElement>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', textTransform: 'uppercase', marginBottom: '24px' }}>{label}</p>
              </AnimatedElement>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {group.map((char, idx) => (
                  <AnimatedElement key={char.name} delay={idx * 0.1} direction="up">
                    <div
                      className="card"
                      style={{
                        padding: '0',
                        overflow: 'hidden',
                        borderColor: `${char.color}20`,
                        position: 'relative',
                        minHeight: '320px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        backgroundImage: char.image ? `url(${char.image})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center top',
                        backgroundColor: char.image ? undefined : `${char.color}15`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${char.color}60`;
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${char.color}20`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${char.color}20`;
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.3) 100%)' }} />
                      <div style={{ position: 'relative', zIndex: 2, padding: '24px' }}>
                        <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '4px', color: char.color }}>
                          {char.name}
                        </h3>
                        <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
                          {char.role}
                        </p>
                        <p style={{ color: char.color, fontSize: '14px', lineHeight: '1.6' }}>
                          {char.bio}
                        </p>
                      </div>
                    </div>
                  </AnimatedElement>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" style={{ padding: '100px 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <AnimatedElement>
            <div style={{ marginBottom: '48px' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>
                The Series
              </span>
              <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontFamily: 'var(--font-display)', fontWeight: '700', background: 'linear-gradient(135deg, #4ade80 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '32px' }}>
                About Clover Chaos
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.9', marginBottom: '16px' }}>
                Clover Chaos is an independent animated web series by Clover Animations that transforms the familiar streets of 2018 Montreal into a surreal playground for interdimensional mystery and dark satire. The story follows a teenager named Pat and his small team of friends who find themselves in the middle of a citywide crisis during what should have been a standard summer break. Their journey quickly escalates as they are pursued by a calculating mastermind known as the Father and a powerful interdimensional entity whose arrival threatens the fabric of their reality. Combining a "cute but intense" aesthetic with high-energy action, the show balances its lighthearted, comic-inspired visuals against a deeply layered narrative full of hidden lore and high stakes.
              </p>
              <p style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.9' }}>
                The series is built on a cinematic foundation, utilizing driving rhythms and dramatic vocal swells to highlight its most pivotal moments. As the characters navigate their stylized urban environment, the show explores themes of resilience and the consequences of meddling with forces beyond human understanding. With Phase 1 establishing the core conflict between the trio and the Father's erratic schemes, the story has since expanded into Phase 2, offering a more complex look at the origins of the chaos and the true nature of the beings haunting Montreal. By blending relatable teenage dynamics with large-scale supernatural events, Clover Chaos has carved out a unique space in the indie animation scene as a project that is as visually polished as it is narratively ambitious.
              </p>
            </div>
          </AnimatedElement>

          <AnimatedElement delay={0.1}>
            <div style={{ borderTop: '1px solid rgba(74, 222, 128, 0.2)', paddingTop: '48px' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '32px', textTransform: 'uppercase' }}>
                Summary
              </span>

              {[
                {
                  chapter: 'Chapter 1: The Bucketlist',
                  text: "The series begins with Pat discovering a mysterious, magical pocketwatch that serves as a tether between realities. During a sudden portal opening, Pat is pulled into a dark dimension known as the Theaneb, where he encounters Kasey Heffley. Trapped within this void, Kasey attempts to seize the watch to fuel her escape, leading to a high-stakes confrontation. Pat manages to overcome her and return to his own reality, but his sudden disappearance and lack of explanation leave his friend Sarah feeling deeply betrayed, straining the team's dynamic from the very start.",
                },
                {
                  chapter: 'Chapter 2: A Tale Of Incidents',
                  text: "Hoping to extend his summer and unravel the mysteries of the previous encounter, Pat finds himself drawn back into the interdimensional void. He seeks out Kasey, offering to hand over the pocketwatch in exchange for a way to manipulate time and save the summer. However, the deal collapses when Pat realizes Kasey's true intentions: she plans to use the artifact to stage a global takeover once she is freed. A fierce battle ensues throughout the dimension until both are forcibly ejected back into the present day, leaving the fate of the watch and the world hanging in the balance.",
                },
                {
                  chapter: 'Chapter 3: Back To Reality',
                  text: "As summer draws to a close, the missing pocketwatch falls into the hands of a mysterious neighbor revealed to be Mark Heffley, the father of Kasey. Unaware of the danger, Pat, Sarah, and Matthew board a train to leave Montreal for their respective home cities. The departure is interrupted when Kasey ambushes the train, terrorizing the teenagers in a desperate search for the watch they no longer possess. Just as the situation turns dire, a new player named Valentina Venezetti—Kasey's estranged childhood best friend—intervenes and portals Kasey back into the Theaneb. The trio returns to Montreal only to find their base of operations engulfed in a devastating fire.",
                },
                {
                  chapter: 'Chapter 4: A Fading Shamrock',
                  text: "Trapped within the burning building, the team escapes through the vents into a secret underground bunker. They discover the StarGazer, a top-secret portal machine developed by Mark Heffley to secure a Nobel Prize and immense wealth. As Valentina and her robotic sidekick Velma monitor the machine's power, it is revealed that Mark intentionally trapped his own daughter in the Theaneb. This betrayal causes his bodyguard, Michael McCallister, to rebel, prematurely activating the StarGazer without the necessary stabilizing substances. The resulting imbalance causes the machine to implode, creating a localized black hole that emits purple radiation, contaminating Montreal's vegetation. In the chaos, Kasey returns and turns against her father after learning the truth. Mark destroys the magical pocketwatch and flees the scene after a final standoff with the teenagers and arriving authorities. The chapter ends on a somber note as the friends share a gloomy farewell, only for Pat to see a news report on the fire's victims that compels him to return to Montreal, setting the stage for Phase 2.",
                },
                {
                  chapter: 'Chapter 5: Taradiddle',
                  text: 'Mark evades the authority and escapes to his hideout. Pat comes back to Montreal after 10 months. Stumbles across the old run down building and gets chased by Mark\'s drones. He gets saved by Charles "Micheal" McCallister — the former agent — and Velma, on the hunt for answers as it is the first time they appear since Delta One, the spinoff film. All three hunt Mark\'s hideout until they stumble across his Headquarters, which former agent McCallister thought was a myth. They invade and Pat gets caught by Mark Heffley himself. Valentina is locked in the room as well. For a search for answers, Mark tries to see into the future of the Eclipse Project — the Stargazer was just a mere act and test for the Eclipse Project — by forcing a headset plugged to a screen.',
                },
              ].map((item, idx) => (
                <AnimatedElement key={idx} delay={idx * 0.1}>
                  <div style={{ marginBottom: '40px', paddingLeft: '20px', borderLeft: '2px solid rgba(74, 222, 128, 0.3)' }}>
                    <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '12px' }}>
                      {item.chapter}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.9' }}>
                      {item.text}
                    </p>
                  </div>
                </AnimatedElement>
              ))}
            </div>
          </AnimatedElement>
        </div>
      </section>

      {/* SUBSCRIBE SECTION */}
      <section
        id="subscribe"
        style={{
          padding: '100px 20px',
          background: 'linear-gradient(180deg, rgba(74, 222, 128, 0.05) 0%, rgba(0,0,0,0) 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <AnimatedElement>
            <img src="/logo.png" style={{ width: '80px', height: '80px', borderRadius: '50%', display: 'block', margin: '0 auto 24px', filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.4))' }} />
            <h2
              style={{
                fontSize: 'clamp(36px, 5vw, 72px)',
                fontFamily: 'Cubano, var(--font-display)',
                fontWeight: '700',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Join the Chaos
            </h2>
          </AnimatedElement>

          <AnimatedElement delay={0.1}>
            <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '48px', lineHeight: '1.8' }}>
              All episodes are completely free. Subscribe on YouTube to get notified the moment new chapters drop. Support us on Patreon and see what benefits are included in our package!
            </p>
          </AnimatedElement>

          <AnimatedElement delay={0.2}>
            <a
              href="https://www.youtube.com/@cloverranimations?sub_confirmation=1"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                color: '#000',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                fontSize: '18px',
                padding: '18px 48px',
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(74, 222, 128, 0.3)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 48px rgba(74, 222, 128, 0.45)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(74, 222, 128, 0.3)';
              }}
            >
              Subscribe on YouTube
            </a>
          </AnimatedElement>
          <AnimatedElement delay={0.3}>
            <a
              href="https://www.patreon.com/cw/CloverrAnimations"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'transparent',
                color: '#4ade80',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                fontSize: '16px',
                padding: '14px 40px',
                borderRadius: '8px',
                textDecoration: 'none',
                border: '2px solid rgba(74,222,128,0.4)',
                marginTop: '16px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.9)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.4)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              Support us on Patreon!
            </a>
          </AnimatedElement>
          <AnimatedElement delay={0.4}>
            <p style={{ color: '#64748b', fontSize: '13px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', margin: '0' }}>Only for 4.99$ CAD — Animated Benefits Included!</p>
          </AnimatedElement>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid rgba(226, 232, 240, 0.1)',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '14px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <img src="/logo.png" style={{ width: '48px', height: '48px', borderRadius: '50%', opacity: 0.7, display: 'inline-block' }} />
        </div>
        <p style={{ marginBottom: '16px' }}>&copy; {new Date().getFullYear()} Clover Chaos — Made with chaos &amp; chlorophyll</p>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'YouTube', href: 'https://www.youtube.com/@cloverranimations', external: true },
            { label: 'See More', href: 'https://cloveranimations.carrd.co/', external: true },
            { label: 'Know More', href: 'https://clover-chaos.fandom.com/wiki/Clover_Chaos_Wiki', external: true },
            { label: 'Terms of Service', href: '/terms', external: false },
            { label: 'Privacy Policy', href: '/privacy', external: false },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? '_blank' : '_self'}
              rel={link.external ? 'noopener noreferrer' : undefined}
              style={{ color: '#64748b', transition: 'color 0.3s ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </main>
  );
}
