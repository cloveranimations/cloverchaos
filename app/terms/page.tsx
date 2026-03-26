import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

export const metadata = {
  title: 'Terms of Service | Clover Chaos Wiki',
};

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using the Clover Chaos Official Page ("the Site"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Site.',
  },
  {
    title: '2. Fan-Made Content',
    body: 'This is the official and fan-made hybrid page for Clover Chaos. While this site serves as an official presence for the series, all original Clover Chaos characters, story, artwork, and media remain the intellectual property of Clover Animations. No content on this site may be reproduced or redistributed without permission from Clover Animations.',
  },
  {
    title: '3. User Contributions',
    body: 'Users may submit comments and articles through the Site. By submitting content, you confirm that it is your own original work and does not infringe on any third-party rights. You grant the Site a non-exclusive license to display your content.',
  },
  {
    title: '4. Prohibited Conduct',
    body: 'You agree not to post content that is hateful, threatening, harassing, obscene, or otherwise harmful. Spam, impersonation, and deliberately false information are not permitted. The site owner reserves the right to remove any content at any time.',
  },
  {
    title: '5. Account & Authentication',
    body: 'The Site uses third-party OAuth providers (Google, GitHub, Discord) for authentication. We do not store your passwords. Your profile information (name, email, avatar) is used solely to identify you on the Site.',
  },
  {
    title: '6. Privacy',
    body: 'We collect only the information necessary to operate the Site — your display name, email, and profile picture provided by your sign-in provider. We do not sell or share your data with third parties. Comments you post are publicly visible.',
  },
  {
    title: '7. Disclaimer',
    body: 'The Site is provided "as is" without warranties of any kind. We are not responsible for the accuracy of fan-generated articles or comments. All wiki content is fan speculation unless otherwise noted.',
  },
  {
    title: '8. Changes to Terms',
    body: 'These terms may be updated at any time. Continued use of the Site after changes are posted constitutes your acceptance of the new terms.',
  },
  {
    title: '9. Contact',
    body: 'For any questions regarding these terms, reach out via the official Clover Chaos YouTube channel or community pages.',
  },
];

export default function TermsPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>Legal</span>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '8px' }}>Terms of Service</h1>
          <p style={{ color: '#475569', fontSize: '13px', fontFamily: 'var(--font-mono)', marginBottom: '56px' }}>Last updated: March 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {sections.map((s) => (
              <div key={s.title}>
                <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#e2e8f0', marginBottom: '10px' }}>{s.title}</h2>
                <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.8' }}>{s.body}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid rgba(226,232,240,0.1)', textAlign: 'center' }}>
            <a href="/" style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '13px', textDecoration: 'none' }}>← Back to Clover Chaos</a>
          </div>
        </div>
      </section>
    </main>
  );
}
