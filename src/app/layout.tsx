import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { TopNav } from '@/components/nav/TopNav';
import { BottomNav } from '@/components/nav/BottomNav';

// Self-hosted (OFL) — no Google Fonts fetch at build time, so builds never
// fail on a flaky connection. One display family; body + mono are system stacks.
const bricolage = localFont({
  src: [
    { path: './fonts/BricolageGrotesque-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/BricolageGrotesque-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/BricolageGrotesque-ExtraBold.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-bricolage',
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Print Runs — Printing Without Stress',
    template: '%s · Print Runs',
  },
  description:
    'Lagos print marketplace. Configure your job, compare nearby printers, pay with Paystack, and track it to your door — Island and Mainland.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Print Runs',
    title: 'Print Runs — Printing Without Stress',
    description: 'Configure a print job, compare nearby Lagos printers, pay and track delivery or pickup.',
    url: APP_URL,
  },
  twitter: { card: 'summary' },
};

export const viewport: Viewport = {
  themeColor: '#0000FF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={bricolage.variable}>
      <body className="flex min-h-dvh flex-col">
        <TopNav />
        {/* pb keeps content clear of the mobile tab bar */}
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
