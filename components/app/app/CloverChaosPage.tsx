'use client';

import { useState, useEffect, useRef } from 'react';
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
    title: 'The Clover Awakens',
    desc: 'A tiny clover sprout discovers it can manipulate the chaos beneath the garden soil.',
    duration: '12 min',
    tags: ['PILOT', 'ADVENTURE'],
  },
  {
    num: '02',
    title: 'Root Riot',
    desc: 'Underground tensions boil over when the dandelions refuse to share sunlight.',
    duration: '13 min',
    tags: ['ACTION', 'MYSTERY'],
  },
  {
    num: '03',
    title: 'Petal to the Metal',
    desc: 'Our hero enters the Great Meadow Race with nothing but vibes and chlorophyll.',
    duration: '14 min',
    tags: ['COMEDY', 'RACE'],
  },
  {
    num: '04',
    title: 'Moss & Memories',
    desc: 'A chance meeting with an ancient moss elder reveals secrets about Clover\'s past.',
    duration: '12 min',
    tags: ['DRAMA', 'REVEAL'],
  },
];

const characters = [
  {
    name: 'Clover',
    role: 'The Protagonist',
    bio: 'A rebellious young clover with chaos-bending powers and too many questions.',
    emoji: '☘️',
    color: '#2dd4bf',
  },
  {
    name: 'Thistle',
    role: 'The Rival',
    bio: 'Sharp, ambitious, and determined to prove she\'s the strongest in the garden.',
    emoji: '🥀',
    color: '#f87171',
  },
  {
    name: 'Moss',
    role: 'The Mentor',
    bio: 'Ancient, wise, and vaguely cryptic. Knows way more than he\'s telling.',
    emoji: '🌱',
    color: '#a78bfa',
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
          padding: '120px 20px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '1000px', textAlign: 'center' }}>
          <AnimatedElement delay={0.1}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: '500',
                letterSpacing: '2px',
                color: '#2dd4bf',
                background: 'rgba(45, 212, 191, 0.1)',
                border: '1px solid rgba(45, 212, 191, 0.3)',
                padding: '8px 16px',
                borderRadius: '24px',
                marginBottom: '32px',
                textTransform: 'uppercase',
              }}
            >
              ☘ An Indie Animated Series
            </span>
          </AnimatedElement>

          <AnimatedElement delay={0.2}>
            <h1
              style={{
                fontSize: 'clamp(48px, 8vw, 120px)',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                lineHeight: '1.1',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #0ea5e9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.02em',
              }}
            >
              Clover<br />Chaos
            </h1>
          </AnimatedElement>

          <AnimatedElement delay={0.3}>
            <p
              style={{
                fontSize: '18px',
                maxWidth: '600px',
                margin: '0 auto 48px',
                color: '#cbd5e1',
                lineHeight: '1.8',
              }}
            >
              A tiny clover with enormous problems, chaotic powers, and a heart of gold. Born on the internet. Built with passion.
            </p>
          </AnimatedElement>

          <AnimatedElement delay={0.4}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary">Watch Now ☘</button>
              <button className="btn btn-secondary">View Episodes</button>
            </div>
          </AnimatedElement>
        </div>

        {/* Scroll indicator */}
        <AnimatedElement delay={0.8}>
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
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
                color: '#2dd4bf',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Scroll
            </span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </AnimatedElement>
      </section>

      {/* EPISODES SECTION */}
      <section id="episodes" style={{ padding: '100px 20px', background: 'rgba(226, 232, 240, 0.02)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <AnimatedElement>
            <div style={{ marginBottom: '64px' }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '2px',
                  color: '#2dd4bf',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                }}
              >
                Season One
              </span>
              <h2
                style={{
                  fontSize: 'clamp(36px, 5vw, 72px)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #2dd4bf 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Episodes
              </h2>
            </div>
          </AnimatedElement>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(45, 212, 191, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226, 232, 240, 0.1)';
                  }}
                >
                  {/* Episode number background */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      fontSize: '120px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: '700',
                      color: 'rgba(45, 212, 191, 0.05)',
                      lineHeight: '1',
                    }}
                  >
                    {ep.num}
                  </div>

                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      {ep.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            fontWeight: '600',
                            letterSpacing: '1px',
                            color: '#2dd4bf',
                            background: 'rgba(45, 212, 191, 0.1)',
                            border: '1px solid rgba(45, 212, 191, 0.3)',
                            padding: '4px 10px',
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
                        fontSize: '22px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: '700',
                        marginBottom: '12px',
                        color: '#e2e8f0',
                      }}
                    >
                      {ep.title}
                    </h3>

                    <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '15px' }}>
                      {ep.desc}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(226, 232, 240, 0.1)',
                        color: '#64748b',
                        fontSize: '13px',
                      }}
                    >
                      <span>{ep.duration}</span>
                      <span style={{ color: '#2dd4bf' }}>▶ Watch</span>
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
                  color: '#2dd4bf',
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
                  background: 'linear-gradient(135deg, #2dd4bf 0%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Characters
              </h2>
            </div>
          </AnimatedElement>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '32px',
              maxWidth: '1000px',
              margin: '0 auto',
            }}
          >
            {characters.map((char, idx) => (
              <AnimatedElement key={char.name} delay={idx * 0.15} direction="up">
                <div
                  className="card"
                  style={{
                    textAlign: 'center',
                    padding: '32px 24px',
                    borderColor: `${char.color}20`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${char.color}50`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${char.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${char.color}20`;
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      fontSize: '64px',
                      marginBottom: '20px',
                      display: 'inline-block',
                      animation: 'float 4s ease-in-out infinite',
                    }}
                  >
                    {char.emoji}
                  </div>

                  <h3
                    style={{
                      fontSize: '26px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: '700',
                      marginBottom: '8px',
                      color: char.color,
                    }}
                  >
                    {char.name}
                  </h3>

                  <p
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: '#64748b',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      marginBottom: '16px',
                    }}
                  >
                    {char.role}
                  </p>

                  <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.6' }}>
                    {char.bio}
                  </p>
                </div>
              </AnimatedElement>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        style={{
          padding: '100px 20px',
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <AnimatedElement>
            <h2
              style={{
                fontSize: 'clamp(36px, 5vw, 72px)',
                fontFamily: 'var(--font-display)',
                fontWeight: '700',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #0ea5e9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Ready to Join the Chaos?
            </h2>
          </AnimatedElement>

          <AnimatedElement delay={0.1}>
            <p style={{ fontSize: '18px', color: '#cbd5e1', marginBottom: '40px', lineHeight: '1.8' }}>
              All episodes are completely free. No signup, no paywalls, no algorithms. Just pure animated chaos.
            </p>
          </AnimatedElement>

          <AnimatedElement delay={0.2}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ fontSize: '16px', padding: '16px 40px' }}>
                Watch All Episodes
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '16px', padding: '16px 40px' }}>
                Follow Updates
              </button>
            </div>
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
        <p style={{ marginBottom: '16px' }}>© {new Date().getFullYear()} Clover Chaos — Made with chaos & chlorophyll ☘</p>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['YouTube', 'Instagram', 'Twitter', 'Discord'].map((social) => (
            <a
              key={social}
              href="#"
              style={{
                color: '#64748b',
                transition: 'color 0.3s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#2dd4bf';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = '#64748b';
              }}
            >
              {social}
            </a>
          ))}
        </div>
      </footer>
    </main>
  );
}