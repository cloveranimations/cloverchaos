'use client';

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#0d1f0d',
      border: '1px solid rgba(74,222,128,0.3)',
      borderRadius: '12px',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      maxWidth: '620px',
      width: 'calc(100% - 40px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: 0, flex: 1 }}>
        We use cookies to improve your experience and analyze site traffic.{' '}
        <a href="/privacy" style={{ color: '#4ade80', textDecoration: 'underline' }}>Privacy Policy</a>
      </p>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{ background: 'transparent', border: '1px solid rgba(74,222,128,0.3)', color: '#64748b', fontSize: '13px', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{ background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', border: 'none', color: '#000', fontSize: '13px', fontWeight: '700', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
