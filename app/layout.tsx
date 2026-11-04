import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://yerevan-business-school.vahagnvideo.chatgpt.site'),
  title: 'Yerevan Business School — Think sharper, lead further.',
  description:
    'European-standard finance education, EFPA qualifications and CFA Level I preparation in Yerevan.',
  openGraph: {
    title: 'Yerevan Business School — Think sharper, lead further.',
    description:
      'European-standard finance education for the people shaping markets and institutions.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Yerevan Business School' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yerevan Business School — Think sharper, lead further.',
    description:
      'European-standard finance education for the people shaping markets and institutions.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
