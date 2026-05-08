// IT4C Meet -- Landing Page
//
// Override fuer livekit-examples/meet/app/page.tsx.
// Statt Demo-Random-Room-Generator: Liste der erlaubten Raeume (aus ALLOWED_ROOMS_JSON,
// vom Server-Side gerendered, public-meta-only). Bei Raum mit Password: Eingabefeld.
//
// "Hosted on LiveKit Cloud" und Upstream-GitHub-Link sind raus -- dafuer Verweis
// auf das eigene IT4Change/livekit Repo.

'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import styles from '../styles/Home.module.css';

type PublicRoom = {
  name: string;
  displayName?: string;
  hasPassword?: boolean;
};

function JoinRoomCard({ room }: { room: PublicRoom }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Bitte einen Namen eingeben');
      return;
    }

    // Pre-flight gegen die API, um Password sofort zu validieren -- erspart
    // dem Nutzer die Reise durch das Pre-Join-Screen falls falsch.
    try {
      const params = new URLSearchParams({
        roomName: room.name,
        participantName: trimmed,
      });
      if (room.hasPassword) params.set('password', password);
      const res = await fetch(`/api/connection-details?${params.toString()}`);
      if (res.status === 403) {
        setError(room.hasPassword ? 'Falsches Passwort' : 'Raum nicht freigegeben');
        return;
      }
      if (!res.ok) {
        setError(`Fehler: ${res.status}`);
        return;
      }
    } catch {
      setError('Verbindungsfehler');
      return;
    }

    // Connection-Details-API hat OK gesagt -- Browser zur Raum-Page leiten.
    // Die Room-Page wird die API selbst nochmal rufen (mit denselben Params)
    // und dann den WSS-Connect machen.
    const target = new URLSearchParams();
    target.set('participantName', trimmed);
    if (room.hasPassword) target.set('password', password);
    router.push(`/rooms/${encodeURIComponent(room.name)}?${target.toString()}`);
  };

  return (
    <form className={styles.tabContent} onSubmit={onSubmit} style={{ minWidth: '20rem' }}>
      <h3 style={{ margin: 0 }}>{room.displayName ?? room.name}</h3>
      <input
        type="text"
        placeholder="Dein Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {room.hasPassword && (
        <input
          type="password"
          placeholder="Raum-Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      )}
      {error && <p style={{ color: '#f55', margin: 0 }}>{error}</p>}
      <button className="lk-button" type="submit">
        Beitreten
      </button>
    </form>
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
              <JoinRoomCard key={room.name} room={room} />
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
