import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Food Delivery Platform',
  description: 'Global food delivery platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
