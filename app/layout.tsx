import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Sridevi Traders',
  description: 'Sridevi Traders web application built with Next.js',
  openGraph: {
    title: 'Sridevi Traders',
    description: 'Sridevi Traders web application built with Next.js',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sridevi Traders',
    description: 'Sridevi Traders web application built with Next.js',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
