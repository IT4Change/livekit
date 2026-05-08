// IT4C Meet -- Landing Page
//
// Override fuer livekit-examples/meet/app/page.tsx.
// Liste der erlaubten Raeume aus /api/rooms (server-side aus
// ALLOWED_ROOMS_JSON gefiltert; niemals Klartext-Password ans Frontend).
// Klick "Beitreten":
//   - Raum ohne Passwort -> direkter Push zu /rooms/<name>
//   - Raum mit Passwort  -> inline Form, Pre-Flight gegen
//     /api/connection-details validiert, dann Push zu /rooms/<name>?password=...
//     PageClientImpl.tsx liest das Password aus dem URL-Param und reicht es
//     beim Token-Holen mit (Patch via meet/scripts/patch-pageclient.js).

'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';

type PublicRoom = {
  name: string;
  displayName?: string;
  hasPassword?: boolean;
  numParticipants?: number;
};

const POLL_INTERVAL_MS = 5_000;

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  color: 'inherit',
  padding: '0.5rem 0.75rem',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function PasswordForm({
  room,
  onCancel,
}: {
  room: PublicRoom;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const params = new URLSearchParams({
        roomName: room.name,
        participantName: '__pre_check__',
        password: pwd,
      });
      const res = await fetch(`/api/connection-details?${params.toString()}`);
      if (res.status === 403) {
        setError('Falsches Passwort');
        return;
      }
      if (!res.ok) {
        setError(`Fehler: ${res.status}`);
        return;
      }
      const target = new URLSearchParams({ password: pwd });
      router.push(`/rooms/${encodeURIComponent(room.name)}?${target.toString()}`);
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <input
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="Raum-Passwort"
        autoFocus
        required
        disabled={busy}
        autoComplete="new-password"
        style={inputStyle}
      />
      {error && (
        <p style={{ color: '#f55', margin: 0, fontSize: '0.85rem' }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="lk-button"
          type="submit"
          disabled={busy}
          style={{ flex: '1 1 auto' }}
        >
          {busy ? 'Pruefe ...' : 'Beitreten'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'inherit',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function RoomRow({ room }: { room: PublicRoom }) {
  const router = useRouter();
  const [showPwdForm, setShowPwdForm] = useState(false);
  const count = room.numParticipants ?? 0;

  const onJoin = () => {
    if (room.hasPassword) {
      setShowPwdForm(true);
      return;
    }
    router.push(`/rooms/${encodeURIComponent(room.name)}`);
  };

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1rem',
        }}
      >
        <span style={{ fontWeight: 600, flex: '1 1 auto' }}>
          {room.displayName ?? room.name}
          {room.hasPassword && (
            <span
              style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.85em' }}
              title="Passwort-geschuetzt"
            >
              🔒
            </span>
          )}
        </span>
        <span
          style={{
            opacity: 0.8,
            minWidth: '4.5rem',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
          title="Aktive Teilnehmer"
        >
          👥 {count}
        </span>
        <button
          className="lk-button"
          onClick={onJoin}
          disabled={showPwdForm}
          style={{ paddingInline: '1.25rem' }}
        >
          Beitreten
        </button>
      </div>
      {showPwdForm && (
        <PasswordForm room={room} onCancel={() => setShowPwdForm(false)} />
      )}
    </div>
  );
}

export default function Page() {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/rooms', { cache: 'no-store' });
        const data = r.ok ? await r.json() : [];
        if (!cancelled) setRooms(data);
      } catch {
        if (!cancelled) setRooms([]);
      }
    };
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      {/* Browser-Autofill-Verlauf wegblenden -- Chrome/Firefox setzen sonst
          eigenen Hintergrund (gelb/gruen) auf Password-Inputs. */}
      <style jsx global>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px rgba(36, 36, 36, 1) inset !important;
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff;
          transition: background-color 5000s ease-in-out 0s;
        }
        input:-moz-autofill {
          background-color: rgba(36, 36, 36, 1) !important;
          color: #fff !important;
        }
      `}</style>

      <main className={styles.main} data-lk-theme="default">
        <div className="header" style={{ textAlign: 'center' }}>
          <img
            src="/it4c-logo.png"
            alt="IT4C"
            width="120"
            height="120"
            style={{ display: 'block', margin: '0 auto 1rem' }}
          />
          <h1 style={{ margin: 0 }}>IT4C Meet</h1>
          <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>
            Konferenzdienst von <strong>IT Team 4 Change</strong>
          </p>
        </div>

        {rooms === null && <p>Lade Raeume ...</p>}

        {rooms !== null && rooms.length === 0 && (
          <p style={{ opacity: 0.8 }}>
            Aktuell sind keine Raeume freigegeben. Wende dich an die IT4C-Administration.
          </p>
        )}

        {rooms !== null && rooms.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '2rem',
              width: '100%',
              maxWidth: '36rem',
            }}
          >
            {rooms.map((room) => (
              <RoomRow key={room.name} room={room} />
            ))}
          </div>
        )}
      </main>
      <footer data-lk-theme="default">
        IT4C Meet &middot; Source auf{' '}
        <a href="https://github.com/IT4Change/livekit" rel="noopener">
          GitHub
        </a>
      </footer>
    </>
  );
}
