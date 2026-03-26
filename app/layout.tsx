import type { Metadata } from 'next';
import './globals.css';
import Providers from './Providers';

export const metadata: Metadata = {
  title: 'Clover Chaos | Indie Animated Series',
  description: 'Clover Chaos is a free indie animated web series set in 2018 Montreal. Follow Pat and his friends through interdimensional chaos, dark secrets, and high-stakes adventure. Watch all episodes free on YouTube.',
  keywords: ['Clover Chaos', 'indie animation', 'animated series', 'Clover Animations', 'YouTube animation', 'free animated series'],
  icons: { icon: '/logo.png' },
  openGraph: {
    title: 'Clover Chaos | Indie Animated Series',
    description: 'A free indie animated web series set in 2018 Montreal. Watch all episodes on YouTube.',
    url: 'https://cloverchaos.com',
    siteName: 'Clover Chaos',
    images: [{ url: 'https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg', width: 1280, height: 720, alt: 'Clover Chaos' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clover Chaos | Indie Animated Series',
    description: 'A free indie animated web series set in 2018 Montreal.',
    images: ['https://img.youtube.com/vi/KRkx658fbEk/maxresdefault.jpg'],
  },
  metadataBase: new URL('https://cloverchaos.com'),
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
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
