// IT4C Meet -- Landing Page
//
// Override fuer livekit-examples/meet/app/page.tsx.
// Statt Demo-Random-Room-Generator: Liste der erlaubten Raeume (aus
// /api/rooms, server-side aus ALLOWED_ROOMS_JSON gefiltert -- niemals
// Klartext-Password ans Frontend; Teilnehmerzahl vom LiveKit-Server).
//
// Klick auf "Beitreten" -> Standard-Pre-Join-Page von livekit-examples/meet
// (`/rooms/<name>`). Dort wird Name + Mic/Cam abgefragt.
//
// Polling alle 5s damit Teilnehmerzahl annaehernd live aussieht.

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

function RoomRow({ room }: { room: PublicRoom }) {
  const router = useRouter();
  const onJoin = () => router.push(`/rooms/${encodeURIComponent(room.name)}`);
  const count = room.numParticipants ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '0.75rem 1rem',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <span style={{ fontWeight: 600, flex: '1 1 auto' }}>
        {room.displayName ?? room.name}
        {room.hasPassword && (
          <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.85em' }}>🔒</span>
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
      <button className="lk-button" onClick={onJoin} style={{ paddingInline: '1.25rem' }}>
        Beitreten
      </button>
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
