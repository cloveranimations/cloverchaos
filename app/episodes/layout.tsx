import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Episodes | Clover Chaos',
  description: 'Watch all episodes of Clover Chaos free on YouTube. From The Bucket List to Taradiddle — follow Pat, Kasey, Mark and the crew through every chapter of the Cloverr Animations indie series.',
  keywords: ['Clover Chaos episodes', 'Clover Chaos watch', 'Taradiddle', 'A Fading Shamrock', 'The Bucket List', 'Cloverr Animations episodes', 'free animated episodes YouTube'],
  openGraph: {
    title: 'Episodes | Clover Chaos',
    description: 'Watch all episodes of Clover Chaos free on YouTube. Phase 1 and Phase 2 available now.',
    url: 'https://cloverchaos.com/episodes',
    images: [{ url: 'https://img.youtube.com/vi/R8kc1_Nusrs/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos Episodes' }],
  },
  alternates: { canonical: 'https://cloverchaos.com/episodes' },
};

export default function EpisodesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
