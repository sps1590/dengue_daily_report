import type { Metadata } from 'next';
import './globals.css';

/**
 * Fonts are linked rather than pulled through `next/font/google`.
 *
 * `next/font` downloads and self-hosts at build time, which is faster when the
 * build machine can reach fonts.googleapis.com — but it turns a font CDN
 * outage into a failed deployment. For a tool that has to be redeployable on
 * short notice from a government network, a linked stylesheet with a system
 * fallback is the safer trade. To switch back, swap in `next/font/google` and
 * keep the same CSS variable names.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Serif+Bengali:wght@400;600&display=swap';

export const metadata: Metadata = {
  title: 'Dengue Daily — DGHS press release to NMEP workbook',
  description:
    'Pulls the DGHS daily dengue press release for a chosen date, rebuilds the NMEP reporting workbook, and drafts a management brief.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}
