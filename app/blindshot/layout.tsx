import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BlindShot | Clover Chaos',
  description:
    'BlindShot — a free browser mining game. Slingshot a ball into 10,000 blocks of darkness, break through eight levels of rock, spend upgrade tokens on a tech tree, and hunt the single golden block buried at the bottom.',
  keywords: [
    'BlindShot',
    'BlindShot game',
    'Clover Chaos game',
    'mining game browser',
    'slingshot mining game',
    'pixel mining game',
    'tech tree upgrade game',
    'golden block game',
    'Cloverr Animations game',
  ],
  openGraph: {
    title: 'BlindShot | Clover Chaos',
    description:
      'Sling a ball into the dark, break 10,000 blocks, and find the one golden block buried at the bottom. Free to play in your browser.',
    url: 'https://cloverchaos.com/blindshot',
    images: [{ url: 'https://cloverchaos.com/logo.png', width: 512, height: 512, alt: 'BlindShot' }],
  },
  alternates: { canonical: 'https://cloverchaos.com/blindshot' },
};

export default function BlindShotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
