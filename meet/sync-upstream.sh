#!/usr/bin/env bash
# Synchronisiert ./upstream/ auf die in upstream.ref gepinnte Version
# von livekit-examples/meet. Wird lokal vor `docker build .` aufgerufen.
# Im CI macht der Workflow dasselbe via actions/checkout, dieses Skript
# wird dort nicht benutzt.
set -euo pipefail

cd "$(dirname "$0")"

REF=$(grep -v '^#' upstream.ref | grep -v '^$' | head -1 | tr -d '[:space:]')
if [ -z "$REF" ]; then
  echo "ERROR: meet/upstream.ref enthaelt keinen ref" >&2
  exit 1
fi

REPO_URL=https://github.com/livekit-examples/meet.git
DIR=upstream

if ! command -v git-lfs >/dev/null 2>&1; then
  echo "ERROR: git-lfs fehlt -- upstream nutzt LFS fuer public/background-images." >&2
  echo "       Installiere git-lfs (z.B. 'pacman -S git-lfs' / 'apt install git-lfs')" >&2
  echo "       und fuehre einmalig 'git lfs install' aus." >&2
  exit 1
fi

if [ ! -d "$DIR/.git" ]; then
  git clone "$REPO_URL" "$DIR"
fi

cd "$DIR"
git fetch --tags origin
git checkout --detach "$REF"
git lfs pull
echo "livekit-examples/meet ausgecheckt auf $REF ($(git rev-parse --short HEAD))"
