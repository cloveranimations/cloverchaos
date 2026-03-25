'use client';

import { useState, useEffect } from 'react';

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backdropFilter: scrolled ? 'blur(12px)' : 'blur(0px)',
        background: scrolled ? 'rgba(3, 10, 3, 0.85)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(226, 232, 240, 0.1)' : '1px solid transparent',
        transition: 'all 0.3s ease',
        padding: '12px 20px',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#4ade80',
            }}
          >
            The Official Clover Chaos Page
          </span>
        </a>

        {/* Desktop Menu */}
        <div className="hide-mobile" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          {['Episodes', 'Characters', 'About', 'Subscribe'].map((item) => (
            <a
              key={item}
              href={item === 'Characters' ? '/characters' : `#${item.toLowerCase()}`}
              style={{
                color: '#e2e8f0',
                fontSize: '14px',
                fontWeight: '500',
                letterSpacing: '0.5px',
                position: 'relative',
                transition: 'color 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#4ade80';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#e2e8f0';
              }}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'none',
            background: 'transparent',
            color: '#4ade80',
            fontSize: '24px',
          }}
          className="show-mobile"
        >
          {mobileOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{
            display: 'none',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(226, 232, 240, 0.1)',
          }}
          className="show-mobile"
        >
          {['Episodes', 'Characters', 'About', 'Subscribe'].map((item) => (
            <a
              key={item}
              href={item === 'Characters' ? '/characters' : `#${item.toLowerCase()}`}
              onClick={() => setMobileOpen(false)}
              style={{ color: '#4ade80', fontSize: '14px' }}
            >
              {item}
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .show-mobile { display: flex !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
