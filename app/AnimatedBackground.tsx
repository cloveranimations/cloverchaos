'use client';

export default function AnimatedBackground() {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          background: 'linear-gradient(180deg, #030a03 0%, #020602 50%, #000000 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Orb 1 - Green */}
      <div
        style={{
          position: 'fixed',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(74, 222, 128, 0.3) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '10%',
          right: '-200px',
          zIndex: -1,
          filter: 'blur(80px)',
          animation: 'float 8s ease-in-out infinite',
        }}
      />

      {/* Orb 2 - Dark green */}
      <div
        style={{
          position: 'fixed',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
          borderRadius: '50%',
          bottom: '15%',
          left: '-150px',
          zIndex: -1,
          filter: 'blur(80px)',
          animation: 'float 10s ease-in-out infinite 1s',
        }}
      />

      {/* Orb 3 - Green accent */}
      <div
        style={{
          position: 'fixed',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(22, 163, 74, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          top: '50%',
          left: '10%',
          zIndex: -1,
          filter: 'blur(80px)',
          animation: 'float 12s ease-in-out infinite 2s',
        }}
      />

      {/* Grid pattern overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          backgroundImage: `
            linear-gradient(rgba(74, 222, 128, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74, 222, 128, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          backgroundPosition: '0 0, 0 0',
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          33% {
            transform: translateY(-30px) translateX(20px);
          }
          66% {
            transform: translateY(15px) translateX(-15px);
          }
        }
      `}</style>
    </>
  );
}
