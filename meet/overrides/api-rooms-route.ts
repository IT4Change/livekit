// IT4C Meet -- /api/rooms
//
// Liefert die public-Meta der freigegebenen Raeume (Name, Anzeigename,
// "hat Passwort?"). NIEMALS das Plaintext-Password ans Frontend ausliefern.
// Wird von der Landing-Page gerufen um die Raum-Liste zu rendern.

import { NextResponse } from 'next/server';

const ALLOWED_ROOMS_JSON = process.env.ALLOWED_ROOMS_JSON ?? '[]';

type RoomConfig = {
  name: string;
  displayName?: string;
  password?: string;
};

export async function GET() {
  let rooms: RoomConfig[] = [];
  try {
    const parsed = JSON.parse(ALLOWED_ROOMS_JSON);
    if (Array.isArray(parsed)) {
      rooms = parsed.filter((r): r is RoomConfig => typeof r?.name === 'string');
    }
  } catch {
    rooms = [];
  }

  // Nur public-meta zurueckgeben -- KEIN password-Klartext nach aussen.
  const publicRooms = rooms.map((r) => ({
    name: r.name,
    displayName: r.displayName,
    hasPassword: typeof r.password === 'string' && r.password.length > 0,
  }));

  return NextResponse.json(publicRooms, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
