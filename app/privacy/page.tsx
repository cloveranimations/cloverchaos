import Navigation from '@/app/Navigation';
import AnimatedBackground from '@/app/AnimatedBackground';

export const metadata = {
  title: 'Privacy Policy | Clover Chaos',
};

const sections = [
  {
    title: '1. Who We Are',
    body: 'This is the Clover Chaos Official Page — an official and fan-made hybrid site for the indie animated web series Clover Chaos by Clover Animations. This Privacy Policy explains what information we collect, how we use it, and your rights.',
  },
  {
    title: '2. What Information We Collect',
    body: 'When you sign in using Google, GitHub, or Discord, we receive your public profile information from that provider — specifically your display name, email address, and profile picture. We do not collect passwords, payment information, or any sensitive personal data.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'Your name and profile picture are displayed publicly next to any comments you post. Your email is used only to identify your account and is never shown publicly. We do not use your information for marketing, advertising, or any purpose beyond operating the Site.',
  },
  {
    title: '4. What We Store',
    body: 'Comments and discussion posts you submit are stored in our database and are publicly visible to all visitors. You can request deletion of your comments at any time by contacting us or by deleting them yourself while signed in.',
  },
  {
    title: '5. Third-Party Services',
    body: 'We use the following third-party services to operate the Site: Google OAuth, GitHub OAuth, and Discord OAuth for authentication; Vercel for hosting; Redis for data storage; and the Anthropic API for AI-generated wiki articles. Each of these services has their own privacy policies.',
  },
  {
    title: '6. Cookies & Sessions',
    body: 'We use session cookies solely to keep you signed in. These cookies are essential for the Site to function and are not used for tracking or advertising purposes. Closing your browser or signing out will end your session.',
  },
  {
    title: '7. Data Sharing',
    body: 'We do not sell, trade, or share your personal information with any third parties. The only data visible to others is your display name, profile picture, and any content you choose to post publicly.',
  },
  {
    title: '8. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data at any time. To request account deletion or removal of your data from our systems, contact us through the official Clover Chaos YouTube channel or community pages.',
  },
  {
    title: '9. Children\'s Privacy',
    body: 'This Site is intended for general audiences. We do not knowingly collect personal information from children under the age of 13. If you believe a child has provided us with personal information, please contact us so we can remove it.',
  },
  {
    title: '10. Changes to This Policy',
    body: 'This Privacy Policy may be updated from time to time. Any changes will be posted on this page with an updated date. Continued use of the Site after changes are posted means you accept the updated policy.',
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <AnimatedBackground />
      <Navigation />

      <section style={{ padding: '140px 20px 100px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '2px', color: '#4ade80', marginBottom: '16px', textTransform: 'uppercase' }}>Legal</span>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#4ade80', marginBottom: '8px' }}>Privacy Policy</h1>
          <p style={{ color: '#475569', fontSize: '13px', fontFamily: 'var(--font-mono)', marginBottom: '56px' }}>Last updated: March 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
            {sections.map((s) => (
              <div key={s.title}>
                <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: '700', color: '#e2e8f0', marginBottom: '10px' }}>{s.title}</h2>
                <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: '1.8' }}>{s.body}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid rgba(226,232,240,0.1)', display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/terms" style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
            <a href="/" style={{ color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: '13px', textDecoration: 'none' }}>← Back to Clover Chaos</a>
          </div>
        </div>
      </section>
    </main>
  );
}
