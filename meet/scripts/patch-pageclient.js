// IT4C Meet -- Patches livekit-examples/meet PageClientImpl.tsx
//
// Drei Patches, alle idempotent (Sentinel-Kommentar erkennt eigene Edits):
//
//   1. PASSWORD-FORWARD: leitet `password` URL-Query-Param an die
//      /api/connection-details-API weiter, sonst koennen Password-
//      geschuetzte Raeume nicht beigetreten werden.
//   2. TOAST-ERROR: ersetzt `alert(...)` durch `toast.error(...)`. Plus
//      User-friendly Texte fuer haeufige Faelle (NotAllowedError =
//      Permission, "room does not exist", generic).
//   3. ENC-TOAST: gleiches fuer Encryption-Errors.
//
// Sentinel-Kommentare:
//   - "IT4C: forward password URL param"
//   - "IT4C: friendly error toast"
//   - "IT4C: friendly encryption error toast"
//
// Wird vom Dockerfile waehrend dem Build aufgerufen. Bei Marker-Mismatch
// (upstream hat sich geaendert) bricht der Build mit klarer Fehlermeldung
// ab -- Marker dann manuell anpassen.

const fs = require('fs');
const FILE = 'app/rooms/[roomName]/PageClientImpl.tsx';

let src = fs.readFileSync(FILE, 'utf8');

function applyPatch(label, sentinel, marker, replacement) {
  if (src.includes(sentinel)) {
    console.log(`[IT4C patch] ${label}: already applied, skipping`);
    return;
  }
  if (!src.includes(marker)) {
    console.error(`[IT4C patch] ${label}: marker not found -- upstream changed?`);
    console.error(`[IT4C patch] expected:\n${marker}`);
    process.exit(1);
  }
  src = src.replace(marker, replacement);
  console.log(`[IT4C patch] ${label}: applied`);
}

// ----- Patch 1: Password URL forwarding -----
applyPatch(
  'password-forward',
  'IT4C: forward password URL param',
  "url.searchParams.append('participantName', values.username);",
  `url.searchParams.append('participantName', values.username);
        // IT4C: forward password URL param (auto-injected)
        const _it4cPwd = new URL(window.location.href).searchParams.get('password');
        if (_it4cPwd) url.searchParams.append('password', _it4cPwd);`
);

// ----- Patch 2: toast import -----
// Wird gleichzeitig fuer Patch 2 und 3 gebraucht.
if (!src.includes("from 'react-hot-toast'")) {
  const importMarker = "import { useRouter } from 'next/navigation';";
  if (!src.includes(importMarker)) {
    console.error('[IT4C patch] toast-import: useRouter import not found');
    process.exit(1);
  }
  src = src.replace(
    importMarker,
    `${importMarker}\nimport toast from 'react-hot-toast';`
  );
  console.log('[IT4C patch] toast-import: applied');
}

// ----- Patch 3: Friendly handleError -----
applyPatch(
  'friendly-error-toast',
  'IT4C: friendly error toast',
  `const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(\`Encountered an unexpected error, check the console logs for details: \${error.message}\`);
  }, []);`,
  `const handleError = React.useCallback((error: Error) => {
    // IT4C: friendly error toast (auto-injected)
    console.error(error);
    const name = (error as any)?.name ?? '';
    const msg = error?.message ?? '';
    if (name === 'NotAllowedError' || /permission denied/i.test(msg)) {
      toast.error(
        'Bitte erlaube Kamera und Mikrofon im Browser. Klicke auf das Schloss-Symbol links neben der URL und stelle die Berechtigungen auf "Erlauben".',
        { duration: 10000 }
      );
    } else if (/room does not exist/i.test(msg)) {
      toast.error(
        'Der Raum ist aktuell nicht verfuegbar. Bitte versuche es erneut oder kontaktiere die IT4C-Administration.',
        { duration: 8000 }
      );
    } else if (name === 'NotFoundError' || /could not start/i.test(msg)) {
      toast.error(
        'Kein Mikrofon/Kamera gefunden. Bitte ein Geraet anschliessen oder im Browser ausgewaehlt.',
        { duration: 8000 }
      );
    } else {
      toast.error('Verbindungsfehler: ' + msg, { duration: 6000 });
    }
  }, []);`
);

// ----- Patch 4a: Import PermissionsCheck -----
if (!src.includes("from '@/lib/PermissionsCheck'")) {
  const importAnchor = "import { useRouter } from 'next/navigation';";
  if (!src.includes(importAnchor)) {
    console.error('[IT4C patch] permissions-check-import: anchor not found');
    process.exit(1);
  }
  src = src.replace(
    importAnchor,
    `${importAnchor}\nimport { PermissionsCheck } from '@/lib/PermissionsCheck';`
  );
  console.log('[IT4C patch] permissions-check-import: applied');
}

// ----- Patch 4b: Render PermissionsCheck above PreJoin -----
applyPatch(
  'permissions-check-render',
  'IT4C: permissions-check above prejoin',
  `        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>`,
  `        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          {/* IT4C: permissions-check above prejoin (auto-injected) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <PermissionsCheck />
            <PreJoin
              defaults={preJoinDefaults}
              onSubmit={handlePreJoinSubmit}
              onError={handlePreJoinError}
            />
          </div>
        </div>`
);

// ----- Patch 5: Friendly handleEncryptionError -----
applyPatch(
  'friendly-encryption-toast',
  'IT4C: friendly encryption error toast',
  `const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      \`Encountered an unexpected encryption error, check the console logs for details: \${error.message}\`,
    );
  }, []);`,
  `const handleEncryptionError = React.useCallback((error: Error) => {
    // IT4C: friendly encryption error toast (auto-injected)
    console.error(error);
    toast.error('Verschluesselungsfehler: ' + (error?.message ?? 'unbekannt'), {
      duration: 6000,
    });
  }, []);`
);

fs.writeFileSync(FILE, src);
console.log(`[IT4C patch] all patches written to ${FILE}`);
