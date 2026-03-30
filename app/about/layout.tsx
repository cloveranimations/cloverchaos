import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | Clover Chaos',
  description: 'Learn about Clover Chaos — the free indie animated series by Cloverr Animations. Explore the full story, characters, and chapter summaries from Phase 1 through Phase 2 including Taradiddle.',
  keywords: ['Clover Chaos story', 'Clover Chaos characters', 'Clover Chaos plot', 'Cloverr Animations about', 'Pat', 'Kasey Heffley', 'Mark Heffley', 'Valentina', 'Theaneb', 'StarGazer', 'Eclipse Project'],
  openGraph: {
    title: 'About Clover Chaos | Indie Animated Series',
    description: 'The full story of Clover Chaos — five chapters of interdimensional chaos, dark secrets, and adventure set in Montreal.',
    url: 'https://cloverchaos.com/about',
    images: [{ url: 'https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos Story' }],
  },
  alternates: { canonical: 'https://cloverchaos.com/about' },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
