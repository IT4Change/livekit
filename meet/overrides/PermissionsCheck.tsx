// IT4C Meet -- PermissionsCheck
//
// Wird auf der Pre-Join-Seite ueber dem livekit-PreJoin-Component
// gerendert. Zeigt:
//   - Kamera-Permission-Status (live, mit onchange-Listener)
//   - Mikrofon-Permission-Status
//   - Speaker-Test-Button (kurzer Beep via Web-Audio-API)
//
// Bei denied permissions: zusaetzlich roter Hinweis-Banner mit Anleitung.
//
// Eingebunden via Patch in PageClientImpl.tsx (siehe scripts/patch-pageclient.js).

'use client';

import React from 'react';

type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

function statusIcon(state: PermState) {
  if (state === 'granted') return '✅';
  if (state === 'denied') return '⛔';
  return '❔';
}

function statusLabel(state: PermState) {
  if (state === 'granted') return 'erlaubt';
  if (state === 'denied') return 'blockiert';
  if (state === 'prompt') return 'wird gefragt';
  return 'unbekannt';
}

function statusColor(state: PermState) {
  if (state === 'granted') return '#5cb85c';
  if (state === 'denied') return '#f55';
  return 'rgba(255,255,255,0.6)';
}

function StatusBadge({ label, state }: { label: string; state: PermState }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.7rem',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '0.9rem',
      }}
      title={`${label}: ${statusLabel(state)}`}
    >
      <span aria-hidden="true">{statusIcon(state)}</span>
      <span>{label}</span>
      <span style={{ opacity: 0.7, color: statusColor(state) }}>
        {statusLabel(state)}
      </span>
    </div>
  );
}

function SpeakerTest() {
  const [playing, setPlaying] = React.useState(false);
  const [didPlay, setDidPlay] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onTest = async () => {
    setError(null);
    setPlaying(true);
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) {
        setError('Audio-API nicht verfuegbar');
        return;
      }
      const ctx = new Ctx();
      // Manche Browser starten den Context als 'suspended' bis user-gesture.
      if (ctx.state === 'suspended') await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 440;
      // Soft-fade-in/-out, sonst klick-artige Artefakte.
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      await new Promise((r) => setTimeout(r, 700));
      ctx.close();
      setDidPlay(true);
    } catch (e: any) {
      setError(e?.message ?? 'Sound konnte nicht abgespielt werden');
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <button
        type="button"
        onClick={onTest}
        disabled={playing}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.7rem',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'inherit',
          cursor: playing ? 'wait' : 'pointer',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
        }}
        title="Spielt einen kurzen Test-Ton ab"
      >
        🔊 {playing ? 'Spielt ...' : 'Sound testen'}
      </button>
      {didPlay && !error && (
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
          Hast du den Ton gehoert?
        </span>
      )}
      {error && (
        <span style={{ fontSize: '0.75rem', color: '#f55' }}>{error}</span>
      )}
    </div>
  );
}

function BlockedBanner({ cam, mic }: { cam: PermState; mic: PermState }) {
  const camDenied = cam === 'denied';
  const micDenied = mic === 'denied';
  if (!camDenied && !micDenied) return null;
  const what =
    camDenied && micDenied
      ? 'Kamera- und Mikrofon-Zugriff'
      : camDenied
        ? 'Kamera-Zugriff'
        : 'Mikrofon-Zugriff';
  return (
    <div
      role="alert"
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: 'rgba(255, 100, 100, 0.08)',
        border: '1px solid rgba(255, 100, 100, 0.4)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
      }}
    >
      <strong>⚠️ {what} ist blockiert.</strong> Klicke auf das Schloss-Symbol
      links neben der URL, erlaube Kamera und Mikrofon und lade die Seite neu.
    </div>
  );
}

export function PermissionsCheck() {
  const [cam, setCam] = React.useState<PermState>('unknown');
  const [mic, setMic] = React.useState<PermState>('unknown');

  React.useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (typeof navigator === 'undefined' || !navigator.permissions) return;
      try {
        const c = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        const m = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        if (!mounted) return;
        setCam(c.state as PermState);
        setMic(m.state as PermState);
        c.onchange = () => mounted && setCam(c.state as PermState);
        m.onchange = () => mounted && setMic(m.state as PermState);
      } catch {
        // Permission-Query nicht unterstuetzt -- still bleiben.
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        width: '100%',
        maxWidth: '32rem',
      }}
    >
      <BlockedBanner cam={cam} mic={mic} />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBadge label="Kamera" state={cam} />
        <StatusBadge label="Mikrofon" state={mic} />
        <SpeakerTest />
      </div>
    </div>
  );
}
