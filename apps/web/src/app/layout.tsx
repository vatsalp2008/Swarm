import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SWARM',
  description: 'Async parallel agents for delegated authenticated tasks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}