// IT4C Meet -- /api/rooms
//
// Liefert die public-Meta der freigegebenen Raeume (Name, Anzeigename,
// "hat Passwort?") + aktuelle Teilnehmerzahl vom LiveKit-Server.
// NIEMALS das Plaintext-Password ans Frontend ausliefern.
// Wird von der Landing-Page periodisch (Polling) gerufen.
//
// Robust gegen YAML-Schreibweisen-Varianten:
//   - displayName ODER displayname (lowercase)
//   - password kann string oder number sein (YAML parst "1234" als int)

import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const ALLOWED_ROOMS_JSON = process.env.ALLOWED_ROOMS_JSON ?? '[]';
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

function readDisplayName(r: any): string | undefined {
  return r?.displayName ?? r?.displayname;
}

function readPasswordRaw(r: any): string {
  const v = r?.password;
  if (v === undefined || v === null) return '';
  return String(v);
}

async function fetchParticipantCounts(): Promise<Record<string, number>> {
  if (!LIVEKIT_URL || !API_KEY || !API_SECRET) return {};
  try {
    const httpsUrl = LIVEKIT_URL.replace(/^wss?:/, 'https:');
    const svc = new RoomServiceClient(httpsUrl, API_KEY, API_SECRET);
    const list = await svc.listRooms();
    const out: Record<string, number> = {};
    for (const r of list) {
      const n = (r as any).numParticipants ?? (r as any).num_participants ?? 0;
      out[r.name] = Number(n);
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET() {
  let rooms: any[] = [];
  try {
    const parsed = JSON.parse(ALLOWED_ROOMS_JSON);
    if (Array.isArray(parsed)) {
      rooms = parsed.filter((r) => typeof r?.name === 'string');
    }
  } catch {
    rooms = [];
  }

  const counts = await fetchParticipantCounts();

  const publicRooms = rooms.map((r) => ({
    name: r.name,
    displayName: readDisplayName(r),
    hasPassword: readPasswordRaw(r).length > 0,
    numParticipants: counts[r.name] ?? 0,
  }));

  return NextResponse.json(publicRooms, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
