import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CloudVault — Secure Cloud Storage',
  description: 'Secure file storage with versioning, replication, and automated backups.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-animated min-h-screen">{children}</body>
    </html>
  );
}
