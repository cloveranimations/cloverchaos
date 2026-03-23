import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clover Chaos | Indie Animated Series',
  description: 'A tiny clover with enormous problems. Born on the internet. Watch free.',
  icons: { icon: '/logo.png' },
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
        {children}
      </body>
    </html>
  );
}
