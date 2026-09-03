import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const deploymentUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrl),
  title: 'IntentLatch — Agent payment firewall on GenLayer',
  description:
    'A decentralized payment firewall that lets AI agents move test GEN only through exact, single-use permits approved by GenLayer consensus.',
  openGraph: {
    title: 'IntentLatch — Agent payment firewall on GenLayer',
    description: 'No AI-agent payment moves without an approved mandate.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'IntentLatch — Agent payment firewall on GenLayer',
    description: 'No AI-agent payment moves without an approved mandate.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
