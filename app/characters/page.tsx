'use client';

import { useRef, useState, useEffect } from 'react';
import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.unobserve(entry.target); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function AnimatedElement({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, animation: inView ? `fadeInUp 0.6s ease-out forwards` : 'none', animationDelay: inView ? `${delay}s` : '0s' }}>
      {children}
    </div>
  );
}

const mainCast = [
  { name: 'Pat', role: 'The Protagonist', bio: 'Clueless, silly, and occasionally just plain stupid, Pat somehow finds himself the primary wielder of the magical pocketwatch. His accidental leadership is what keeps the group moving forward—even if he isn\'t always sure where they\'re going.', color: '#4ade80', image: 'https://i.imgur.com/m6CXyWD.png' },
  { name: 'Sarah', role: 'The Anxious Heart', bio: 'Sharing much of Pat\'s silly nature, Sarah adds a layer of shyness and anxiety to the group\'s dynamic. She is often the most stressed by the supernatural incidents, especially when Pat\'s "clueless" decisions leave her feeling overwhelmed.', color: '#f9a8d4', image: 'https://i.imgur.com/5bXuwk1.png' },
  { name: 'Matthew', role: 'The Reluctant Member', bio: 'Perpetually bored, annoyed, and grumpy. He treats interdimensional threats and city-wide fires as massive inconveniences. His grounded, cynical attitude provides a necessary balance to the team\'s more frantic energy.', color: '#fbbf24', image: 'https://i.imgur.com/H5gr7Xe.png' },
];

const rivalCast = [
  { name: 'Kasey Heffley', role: 'The Trapped Rival', bio: 'Trapped within the Theaneb, her "evil" streak is fueled by a desire for power and a plan to conquer the world once she escapes. She is relentless in her pursuit of the pocketwatch, viewing everyone—including her own father—as an obstacle.', color: '#f87171', image: 'https://i.imgur.com/0ELhwgN.png' },
  { name: 'Valentina Venezetti', role: 'The Engineer', bio: 'Just as determined and ambitious as her former best friend Kasey, Valentina uses her drive for protection rather than conquest. Alongside her robot sidekick Velma, she uses her portal-jumping abilities to shield the world from darkness.', color: '#c084fc', image: 'https://i.imgur.com/NUGITUU.png' },
  { name: 'Mark Heffley', role: 'The Mastermind', bio: 'The neighbor of the three teenagers and the true mastermind of Phase 1. A dark, mysterious figure whose "pure evil" nature is revealed through his invention of the StarGazer—a man who would sacrifice his own daughter for a Nobel Prize.', color: '#94a3b8', image: 'https://i.imgur.com/yVxWcFU.png' },
];

export default function CharactersPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <AnimatedElement>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>
                Meet the Cast
              </span>
              <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80' }}>
                Characters
              </h1>
            </div>
          </AnimatedElement>

          {[{ label: 'Main Cast', group: mainCast }, { label: 'The Heffleys & The Rival', group: rivalCast }].map(({ label, group }) => (
            <div key={label} style={{ marginBottom: '64px' }}>
              <AnimatedElement>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', textTransform: 'uppercase', marginBottom: '24px' }}>{label}</p>
              </AnimatedElement>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {group.map((char, idx) => (
                  <AnimatedElement key={char.name} delay={idx * 0.1}>
                    <div
                      className="card"
                      style={{ padding: '0', overflow: 'hidden', borderColor: `${char.color}20`, position: 'relative', minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundImage: char.image ? `url(${char.image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundColor: char.image ? undefined : `${char.color}15` }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${char.color}60`; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${char.color}20`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${char.color}20`; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.3) 100%)' }} />
                      <div style={{ position: 'relative', zIndex: 2, padding: '24px' }}>
                        <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '4px', color: char.color }}>{char.name}</h3>
                        <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>{char.role}</p>
                        <p style={{ color: char.color, fontSize: '14px', lineHeight: '1.6' }}>{char.bio}</p>
                      </div>
                    </div>
                  </AnimatedElement>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
