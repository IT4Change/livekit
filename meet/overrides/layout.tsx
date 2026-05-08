// IT4C Meet -- Root Layout
//
// Override fuer livekit-examples/meet/app/layout.tsx.
// Setzt IT4C-Branding fuer Page-Title, OG/Twitter-Preview, Favicon.
//
// SITE_URL ueber ENV-Variable konfigurierbar (gesetzt via Manifest aus
// .StateValues.deploy.MEET_DOMAIN). Default fuer lokalen Build:
// https://meet.stage.it4c.org. Kein NEXT_PUBLIC_-Prefix noetig, weil
// Metadata server-side gerendert wird.

import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

const SITE_URL = process.env.SITE_URL ?? 'https://meet.stage.it4c.org';
const SITE_NAME = 'IT4C Meet';
const SITE_DESCRIPTION = 'Konferenzdienst von IT Team 4 Change';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: '%s',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: '/it4c-logo.png',
        width: 1024,
        height: 1024,
        type: 'image/png',
        alt: 'IT4C',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/it4c-logo.png'],
  },
  icons: {
    icon: [{ url: '/it4c-logo.png', type: 'image/png' }],
    apple: [{ url: '/it4c-logo.png', type: 'image/png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
