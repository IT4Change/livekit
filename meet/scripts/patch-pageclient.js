// IT4C Meet -- Patch livekit-examples/meet PageClientImpl.tsx
//
// Reicht den `password` URL-Query-Param an den /api/connection-details Call
// weiter. Ohne den Patch sendet der Pre-Join-Screen das Password nicht mit,
// und Password-geschuetzte Raeume waeren beitritts-broken (API gibt 403).
//
// Idempotent -- erkennt eigenes Marker-Kommentar und beendet sich ohne
// nochmaligen Inject. Wird vom Dockerfile waehrend dem Build aufgerufen.

const fs = require('fs');

const FILE = 'app/rooms/[roomName]/PageClientImpl.tsx';
const MARKER = "url.searchParams.append('participantName', values.username);";
const SENTINEL = 'IT4C: forward password URL param';
const INJECTION = `${MARKER}
        // ${SENTINEL} (auto-injected by meet/scripts/patch-pageclient.js)
        const _it4cPwd = new URL(window.location.href).searchParams.get('password');
        if (_it4cPwd) url.searchParams.append('password', _it4cPwd);`;

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes(SENTINEL)) {
  console.log(`[IT4C patch] ${FILE} already patched, skipping`);
  process.exit(0);
}
if (!src.includes(MARKER)) {
  console.error(`[IT4C patch] marker not found in ${FILE} -- upstream changed?`);
  console.error(`[IT4C patch] expected: ${MARKER}`);
  process.exit(1);
}

const out = src.replace(MARKER, INJECTION);
fs.writeFileSync(FILE, out);
console.log(`[IT4C patch] injected password forwarding into ${FILE}`);
