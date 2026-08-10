'use client';

import AnimatedBackground from '@/app/AnimatedBackground';
import Navigation from '@/app/Navigation';
import BlindShot from './BlindShot';

export default function BlindShotPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '110px 16px 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <span
              style={{
                display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px',
                letterSpacing: '2px', color: '#4ade80', marginBottom: '10px', textTransform: 'uppercase',
              }}
            >
              Mining Game
            </span>
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 56px)', fontFamily: 'Cubano, var(--font-display)',
                color: '#4ade80', marginBottom: '8px',
              }}
            >
              BlindShot
            </h1>
            <p style={{ color: '#64748b', fontSize: '14px', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              10,000 blocks of dark. One golden block buried at the bottom of it.
              Sling a ball into the walls, dig by feel, and spend what you find on the tech tree.
            </p>
          </div>

          <BlindShot />

          <div
            style={{
              marginTop: '40px', display: 'grid', gap: '18px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#64748b', lineHeight: 1.7,
            }}
          >
            <div>
              <h2 style={{ color: '#4ade80', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>
                How to play
              </h2>
              <p>
                Hold anywhere on the map and drag <em>away</em> from where you want to shoot — the further
                you pull, the harder the ball flies. Let go to fire. Balls ricochet until they run out
                of bounces, chewing through rock as they go.
              </p>
            </div>
            <div>
              <h2 style={{ color: '#4ade80', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Digging deeper
              </h2>
              <p>
                Tap any carved-out space to move there — you stop at the first wall. Every 12 blocks
                down is a new level with tougher rock, so a ball that shredded the topsoil will barely
                scratch the core.
              </p>
            </div>
            <div>
              <h2 style={{ color: '#4ade80', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Upgrades
              </h2>
              <p>
                Glowing white blocks drop <span style={{ color: '#fff' }}>◆ tokens</span>. Spend them in
                the tech tree on damage, splash, chain lightning, poison, extra projectiles, and the
                compass that finally points at the golden block. There aren&apos;t enough tokens for
                everything — pick a lane.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
