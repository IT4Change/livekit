// IT4C Meet -- CookieGate
//
// Prueft beim Mount ob Cookies UND localStorage funktionieren. Wenn nicht
// (Privacy-Modus, "Block all cookies", strikte Browser-Erweiterungen),
// zeigt einen freundlichen Hinweis statt die App weiterzuladen.
//
// Hintergrund: livekit-client und Next.js setzen waehrend des Connect-Flows
// Cookies + localStorage-Eintraege (Device-Auswahl, Token-Postfix, etc.).
// Bei blockiertem Storage werfen Browser DOMException -- die App crasht
// dann mit White-Screen.

'use client';

import React from 'react';

type Status = 'checking' | 'ok' | 'blocked';

function probeStorage(): boolean {
  try {
    if (typeof navigator === 'undefined' || !navigator.cookieEnabled) return false;

    // Cookie-Probe: setzen, lesen, loeschen.
    document.cookie = '__it4c_probe=1; SameSite=Strict; Path=/';
    const cookieOk = document.cookie.includes('__it4c_probe=1');
    document.cookie = '__it4c_probe=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/';
    if (!cookieOk) return false;

    // localStorage-Probe.
    const k = '__it4c_probe';
    window.localStorage.setItem(k, '1');
    const lsOk = window.localStorage.getItem(k) === '1';
    window.localStorage.removeItem(k);
    if (!lsOk) return false;

    return true;
  } catch {
    return false;
  }
}

function BlockedScreen() {
  return (
    <main
      data-lk-theme="default"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <img
          src="/it4c-logo.png"
          alt="IT4C"
          width="96"
          height="96"
          style={{ display: 'block', margin: '0 auto 1.5rem' }}
        />
        <h1 style={{ marginTop: 0 }}>Cookies werden benoetigt</h1>
        <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
          IT4C Meet braucht <strong>Cookies und Browser-Speicher</strong>, um
          die Verbindung zum Konferenzserver herzustellen und deine Geraete-
          Auswahl zu merken. Aktuell scheinen sie blockiert zu sein.
        </p>
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '1rem 1.25rem',
            marginTop: '1.5rem',
            textAlign: 'left',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>So aktivieren:</p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
            <li>
              Klicke auf das <strong>Schloss-Symbol</strong> links neben der
              URL.
            </li>
            <li>
              Erlaube <em>Cookies</em> und <em>Site Data</em> fuer diese Seite.
            </li>
            <li>Lade die Seite neu.</li>
          </ol>
        </div>
        <button
          className="lk-button"
          onClick={() => window.location.reload()}
          style={{ marginTop: '1.5rem' }}
        >
          Neu laden
        </button>
        <p style={{ marginTop: '2rem', opacity: 0.6, fontSize: '0.85rem' }}>
          Hinweis: Wir verwenden die Cookies ausschliesslich fuer die Funktion
          des Konferenzdienstes. Kein Tracking, keine externen Dienste.
        </p>
      </div>
    </main>
  );
}

export function CookieGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>('checking');

  React.useEffect(() => {
    setStatus(probeStorage() ? 'ok' : 'blocked');
  }, []);

  if (status === 'checking') {
    // Kurzer flicker -- bei normalen Browsern <50ms.
    return null;
  }
  if (status === 'blocked') {
    return <BlockedScreen />;
  }
  return <>{children}</>;
}
