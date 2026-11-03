import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EatWave Partner',
  description: 'Restaurant operations dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
