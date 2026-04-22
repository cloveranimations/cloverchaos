import type { Metadata } from 'next';
import './globals.css';
import Providers from './Providers';
import GravityMode from './GravityMode';

export const metadata: Metadata = {
  title: {
    default: 'Clover Chaos | Free Indie Animated Series',
    template: '%s | Clover Chaos',
  },
  description: 'Clover Chaos is a free indie animated web series by Cloverr Animations set in 2018 Montreal. Follow Pat and his friends through interdimensional chaos, dark secrets, and high-stakes adventure across multiple phases. Watch all episodes free on YouTube.',
  keywords: [
    'Clover Chaos',
    'Cloverr Animations',
    'CloverrAnimations',
    'indie animated series',
    'free animated web series',
    'Clover Chaos episodes',
    'Clover Chaos YouTube',
    'Clover Chaos animation',
    'indie animation YouTube',
    'Montreal animated series',
    'Clover Chaos wiki',
    'Clover Chaos characters',
    'Pat Clover Chaos',
    'Kasey Heffley',
    'Mark Heffley animation',
    'Theaneb',
    'Eclipse Project',
    'Delta One spinoff',
    'Taradiddle episode',
    'Phase 2 Clover Chaos',
  ],
  authors: [{ name: 'Cloverr Animations', url: 'https://cloverchaos.com' }],
  creator: 'Cloverr Animations',
  publisher: 'Cloverr Animations',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: { icon: '/icon.png', apple: '/logo.png' },
  openGraph: {
    title: 'Clover Chaos | Free Indie Animated Series',
    description: 'A free indie animated web series set in 2018 Montreal by Cloverr Animations. Follow Pat and his friends through interdimensional chaos and dark secrets. Watch all episodes free on YouTube.',
    url: 'https://cloverchaos.com',
    siteName: 'Clover Chaos',
    locale: 'en_CA',
    images: [
      { url: 'https://img.youtube.com/vi/R8kc1_Nusrs/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos Episode 5 - Taradiddle' },
      { url: 'https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos - Indie Animated Series' },
      { url: 'https://img.youtube.com/vi/K3Da51RfROM/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos Episode 4 - A Fading Shamrock' },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clover Chaos | Free Indie Animated Series',
    description: 'A free indie animated web series set in 2018 Montreal by Cloverr Animations. Watch all episodes free on YouTube.',
    images: ['https://img.youtube.com/vi/R8kc1_Nusrs/maxresdefault.jpg'],
    creator: '@cloverranimations',
  },
  alternates: { canonical: 'https://cloverchaos.com' },
  metadataBase: new URL('https://cloverchaos.com'),
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://cloverchaos.com/#website',
      url: 'https://cloverchaos.com',
      name: 'Clover Chaos',
      description: 'Official website for Clover Chaos, a free indie animated web series by Cloverr Animations.',
      publisher: { '@id': 'https://cloverchaos.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://cloverchaos.com/articles?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': 'https://cloverchaos.com/#organization',
      name: 'Cloverr Animations',
      url: 'https://cloverchaos.com',
      logo: { '@type': 'ImageObject', url: 'https://cloverchaos.com/logo.png' },
      sameAs: [
        'https://www.youtube.com/@cloverranimations',
        'https://www.patreon.com/cw/CloverrAnimations',
      ],
    },
    {
      '@type': 'TVSeries',
      '@id': 'https://cloverchaos.com/#series',
      name: 'Clover Chaos',
      alternateName: 'Clover Chaos Series',
      description: 'Clover Chaos is a free indie animated web series set in 2018 Montreal, following Pat and his friends through interdimensional chaos, dark secrets, and high-stakes adventure.',
      url: 'https://cloverchaos.com',
      image: 'https://cloverchaos.com/logo.png',
      creator: { '@id': 'https://cloverchaos.com/#organization' },
      genre: ['Animation', 'Adventure', 'Science Fiction'],
      inLanguage: 'en',
      numberOfSeasons: 1,
      numberOfEpisodes: 5,
      episode: [
        { '@type': 'TVEpisode', episodeNumber: 1, name: 'The Bucket List', url: 'https://youtu.be/KRkx658fbEk' },
        { '@type': 'TVEpisode', episodeNumber: 2, name: 'A Tale Of Incidents', url: 'https://youtu.be/pMPAmgGDcKA' },
        { '@type': 'TVEpisode', episodeNumber: 3, name: 'Back To Reality', url: 'https://youtu.be/YjWVfalse3s' },
        { '@type': 'TVEpisode', episodeNumber: 4, name: 'A Fading Shamrock', url: 'https://youtu.be/K3Da51RfROM' },
        { '@type': 'TVEpisode', episodeNumber: 5, name: 'Taradiddle', url: 'https://youtu.be/R8kc1_Nusrs' },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#0f172a" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2555350650558070" crossOrigin="anonymous"></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <GravityMode />
      </body>
    </html>
  );
}
