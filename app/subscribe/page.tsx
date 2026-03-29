'use client';

import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

export default function SubscribePage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px 20px 100px', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <img src="/logo.png" style={{ width: '100px', height: '100px', borderRadius: '50%', display: 'block', margin: '0 auto 32px', filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.4))' }} />
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontFamily: 'Cubano, var(--font-display)', fontWeight: '700', marginBottom: '24px', background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Join the Chaos
          </h1>
          <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '48px', lineHeight: '1.8' }}>
            All episodes are completely free. Subscribe on YouTube to get notified the moment new chapters drop.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <a
              href="https://www.youtube.com/@cloverranimations?sub_confirmation=1"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', color: '#000', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '18px', padding: '18px 48px', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(74, 222, 128, 0.3)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              ▶ Subscribe on YouTube
            </a>
            <a
              href="https://www.patreon.com/cw/CloverrAnimations"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'transparent', color: '#4ade80', fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '16px', padding: '14px 40px', borderRadius: '8px', textDecoration: 'none', border: '2px solid rgba(74,222,128,0.4)', transition: 'all 0.2s ease' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.9)'; (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.4)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Support us on Patreon!
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
