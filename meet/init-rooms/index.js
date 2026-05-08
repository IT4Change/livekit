// IT4C Meet -- Init-Container fuer Pre-Create der erlaubten Raeume.
//
// Laeuft als Init-Container vor dem Meet-UI-Pod. Liest ALLOWED_ROOMS_JSON,
// listet bestehende Raeume vom LiveKit-Server, erstellt fehlende. Idempotent.
// Bei jedem Pod-Restart laeuft das mit -- so ist der Cluster-State immer
// synchron mit der Config.
//
// Logs niemals das Password-Feld -- nur Raum-Namen.

const { RoomServiceClient } = require('livekit-server-sdk');

const ALLOWED_ROOMS_JSON = process.env.ALLOWED_ROOMS_JSON ?? '[]';
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

if (!LIVEKIT_URL || !API_KEY || !API_SECRET) {
  console.error('LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET required');
  process.exit(1);
}

async function withRetry(label, fn, attempts = 12, delayMs = 5000) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e?.message ?? String(e);
      const last = i === attempts - 1;
      console.log(`[${label}] attempt ${i + 1}/${attempts} failed: ${msg}`);
      if (last) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  let rooms;
  try {
    rooms = JSON.parse(ALLOWED_ROOMS_JSON);
  } catch (e) {
    console.error('Cannot parse ALLOWED_ROOMS_JSON:', e.message);
    process.exit(1);
  }
  if (!Array.isArray(rooms)) {
    console.error('ALLOWED_ROOMS_JSON must be a JSON array');
    process.exit(1);
  }

  // RoomServiceClient nutzt REST/twirp -- braucht HTTPS, nicht WSS.
  const httpsUrl = LIVEKIT_URL.replace(/^wss?:/, 'https:');
  const svc = new RoomServiceClient(httpsUrl, API_KEY, API_SECRET);

  console.log(`Connecting to ${httpsUrl}`);
  const existingRooms = await withRetry('listRooms', () => svc.listRooms());
  const existing = new Set(existingRooms.map((r) => r.name));
  console.log(`Existing rooms on server: ${[...existing].join(', ') || '(none)'}`);

  for (const r of rooms) {
    if (!r?.name || typeof r.name !== 'string') continue;
    if (existing.has(r.name)) {
      console.log(`Room exists, skipping: ${r.name}`);
      continue;
    }
    await withRetry(`create ${r.name}`, () => svc.createRoom({ name: r.name }));
    console.log(`Created room: ${r.name}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('Init-rooms failed:', e?.message ?? e);
  process.exit(1);
});
