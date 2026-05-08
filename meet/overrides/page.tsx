// IT4C Meet -- Landing Page
//
// Override fuer livekit-examples/meet/app/page.tsx.
// Statt Demo-Random-Room-Generator: Liste der erlaubten Raeume (aus
// /api/rooms, server-side aus ALLOWED_ROOMS_JSON gefiltert -- niemals
// Klartext-Password ans Frontend).
//
// Klick auf "Beitreten" -> Redirect zur Standard-Pre-Join-Page von
// livekit-examples/meet (`/rooms/<name>`). Dort wird Name + Mic/Cam
// abgefragt. Hier kein Name -- waere doppelt.
//
// "Hosted on LiveKit Cloud" und Upstream-GitHub-Link sind raus -- Verweis
// stattdessen auf das eigene IT4Change/livekit Repo.

'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';

type PublicRoom = {
  name: string;
  displayName?: string;
  hasPassword?: boolean;
};

function RoomCard({ room }: { room: PublicRoom }) {
  const router = useRouter();
  const onJoin = () => {
    // Standard-Pre-Join-Page von livekit-examples/meet uebernimmt
    // Name- und Mic/Cam-Setup.
    router.push(`/rooms/${encodeURIComponent(room.name)}`);
  };

  return (
    <div
      className={styles.tabContent}
      style={{ minWidth: '14rem', alignItems: 'center', textAlign: 'center' }}
    >
      <h3 style={{ margin: 0 }}>{room.displayName ?? room.name}</h3>
      {room.hasPassword && (
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
          🔒 Passwort-geschuetzt
        </p>
      )}
      <button className="lk-button" onClick={onJoin} style={{ paddingInline: '1.5rem' }}>
        Beitreten
      </button>
    </div>
  );
}

export default function Page() {
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    fetch('/api/rooms')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRooms(data))
      .catch(() => setRooms([]));
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
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '1.5rem',
              marginTop: '2rem',
            }}
          >
            {rooms.map((room) => (
              <RoomCard key={room.name} room={room} />
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
