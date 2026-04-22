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
    <div ref={ref} style={{ opacity: inView ? 1 : 0, animation: inView ? `fadeInUp 0.6s ease-out forwards` : 'none', animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

const episodes = [
  { num: '01', title: 'The Bucket List', desc: 'The series premiere introduces Pat and his two best friends in a stylized 2018 Montreal. The trio is looking forward to a typical summer break, but the atmosphere is quickly established as "cheesy yet satirical." The episode sets the groundwork for the show\'s unique "cute-intense" aesthetic.', duration: '12:57', tags: ['PILOT', 'ADVENTURE'], url: 'https://youtu.be/KRkx658fbEk?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc', thumbnail: 'https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg' },
  { num: '02', title: 'A Tale Of Incidents', desc: 'The stakes escalate as the "Crazy Father" begins to actively interfere with the trio\'s plans. This episode focuses heavily on character dynamics, showcasing the chemistry between Pat and his teammates as they attempt to investigate the strange occurrences around their homes.', duration: '31:53', tags: ['ACTION', 'MYSTERY'], url: 'https://youtu.be/1GT0ThpLdV0?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc', thumbnail: 'https://img.youtube.com/vi/1GT0ThpLdV0/maxresdefault.jpg' },
  { num: '03', title: 'Back To Reality', desc: 'The "Satirical" tone takes a backseat to "Mystery" and "Lore" in this pivotal episode. A massive tear in reality occurs, leading to the arrival of the Interdimensional Being. The trio finds themselves caught in a three-way conflict between their summer goals, the Father\'s madness, and this new cosmic entity.', duration: '41:36', tags: ['COMEDY', 'RACE'], url: 'https://youtu.be/3AxVSqjbE0s?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc', thumbnail: 'https://img.youtube.com/vi/3AxVSqjbE0s/maxresdefault.jpg' },
  { num: '04', title: 'A Fading Shamrock', desc: "The team successfully fends off the Father's immediate threat, but at a great cost to their anonymity. The Interdimensional Being delivers a final warning before vanishing, setting the stage for Phase 2.", duration: '39:54', tags: ['DRAMA', 'REVEAL'], url: 'https://youtu.be/K3Da51RfROM?list=PL_buqz0LdeD57LW39dn6W8SW-IpZi-4Hc', thumbnail: 'https://img.youtube.com/vi/K3Da51RfROM/maxresdefault.jpg' },
  { num: '05', title: 'Taradiddle', desc: 'Pat returns to Montreal after 10 months and stumbles upon the old building, getting chased by Mark\'s drones. Saved by former agent McCallister and Velma, the trio hunts down Mark\'s mythical headquarters — only for Pat and Valentina to be captured by Mark himself.', duration: '13:06', tags: ['PHASE 2', 'ADVENTURE'], url: 'https://youtu.be/R8kc1_Nusrs', thumbnail: 'https://img.youtube.com/vi/R8kc1_Nusrs/maxresdefault.jpg' },
  { num: '06', title: 'Death over Deal', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
  { num: '07', title: 'Clover Chaos pt. 1', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
  { num: '08', title: 'Clover Chaos pt. 2', desc: '███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████.', duration: '--:--', tags: ['TBA'], url: '', thumbnail: '' },
];

export default function EpisodesPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <section style={{ padding: '140px 20px 100px', minHeight: '100vh', position: 'relative', overflow: 'hidden', backgroundImage: 'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.72)), url(https://img.youtube.com/vi/zXVoG3z8CMo/maxresdefault.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Video background — plays on top of thumbnail fallback */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
          <iframe
            src="https://www.youtube.com/embed/zXVoG3z8CMo?autoplay=1&mute=1&loop=1&playlist=zXVoG3z8CMo&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1"
            allow="autoplay; encrypted-media"
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100vw', height: '56.25vw', minHeight: '100vh', minWidth: '177.78vh', border: 'none', pointerEvents: 'none' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
        </div>
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <AnimatedElement>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80' }}>Episodes</h1>
            </div>
          </AnimatedElement>

          {/* PHASE ONE */}
          <AnimatedElement delay={0.1}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(74,222,128,0.4), transparent)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '3px', color: '#4ade80', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', padding: '6px 16px', borderRadius: '20px' }}>Phase One</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, rgba(74,222,128,0.4), transparent)' }} />
            </div>
          </AnimatedElement>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '64px' }}>
            {episodes.slice(0, 4).map((ep, idx) => (
              <AnimatedElement key={ep.num} delay={idx * 0.1}>
                <a href={ep.url || undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="card"
                  style={{ position: 'relative', overflow: 'hidden', cursor: ep.url ? 'pointer' : 'default', backgroundImage: ep.thumbnail ? `url(${ep.thumbnail})` : 'none', backgroundColor: ep.thumbnail ? 'transparent' : '#0f172a', backgroundSize: 'cover', backgroundPosition: 'center', height: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0', filter: ep.thumbnail ? 'none' : undefined }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74, 222, 128, 0.5)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226, 232, 240, 0.1)'; }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)', zIndex: 1 }} />
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '110px', fontFamily: 'var(--font-display)', fontWeight: '700', color: 'rgba(255,255,255,0.25)', lineHeight: '1', zIndex: 2, userSelect: 'none' }}>{parseInt(ep.num)}</div>
                  <div style={{ position: 'relative', zIndex: 3, padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {ep.tags.map((tag) => (
                        <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '1px', color: '#4ade80', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '3px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>{tag}</span>
                      ))}
                    </div>
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '6px', color: '#e2e8f0' }}>{ep.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', marginBottom: '10px' }}>{ep.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(226, 232, 240, 0.15)', fontSize: '11px' }}>
                      <span style={{ color: '#64748b' }}>{ep.duration}</span>
                      {ep.url ? (
                        <a href={ep.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4ade80', textDecoration: 'none' }}>&#9654; Watch</a>
                      ) : (
                        <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px' }}>COMING SOON</span>
                      )}
                    </div>
                  </div>
                </div>
                </a>
              </AnimatedElement>
            ))}
          </div>

          {/* PHASE TWO */}
          <AnimatedElement delay={0.1}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(167,139,250,0.4), transparent)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '3px', color: '#a78bfa', textTransform: 'uppercase', whiteSpace: 'nowrap', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', padding: '6px 16px', borderRadius: '20px' }}>Phase Two</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, rgba(167,139,250,0.4), transparent)' }} />
            </div>
          </AnimatedElement>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {episodes.slice(4).map((ep, idx) => (
              <AnimatedElement key={ep.num} delay={idx * 0.1}>
                <a href={ep.url || undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="card"
                  style={{ position: 'relative', overflow: 'hidden', cursor: ep.url ? 'pointer' : 'default', backgroundImage: ep.thumbnail ? `url(${ep.thumbnail})` : 'none', backgroundColor: ep.thumbnail ? 'transparent' : '#0f172a', backgroundSize: 'cover', backgroundPosition: 'center', height: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0', borderColor: 'rgba(167,139,250,0.2)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.5)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.2)'; }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)', zIndex: 1 }} />
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '110px', fontFamily: 'var(--font-display)', fontWeight: '700', color: 'rgba(167,139,250,0.15)', lineHeight: '1', zIndex: 2, userSelect: 'none' }}>{parseInt(ep.num)}</div>
                  <div style={{ position: 'relative', zIndex: 3, padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {ep.tags.map((tag) => (
                        <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '1px', color: '#a78bfa', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', padding: '3px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>{tag}</span>
                      ))}
                    </div>
                    <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-display)', fontWeight: '700', marginBottom: '6px', color: '#e2e8f0' }}>{ep.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', marginBottom: '10px' }}>{ep.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(167,139,250,0.15)', fontSize: '11px' }}>
                      <span style={{ color: '#64748b' }}>{ep.duration}</span>
                      {ep.url ? (
                        <a href={ep.url} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>&#9654; Watch</a>
                      ) : (
                        <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px' }}>COMING SOON</span>
                      )}
                    </div>
                  </div>
                </div>
                </a>
              </AnimatedElement>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
