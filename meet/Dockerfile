# syntax=docker/dockerfile:1.7
# Multi-stage Build fuer livekit-examples/meet (Next.js 15, pnpm) + IT4C-Branding.
# Quellcode liegt unter ./upstream/ -- lokal via sync-upstream.sh erzeugt,
# im CI via zweitem actions/checkout (siehe build-meet.yml).
#
# Overrides unter ./overrides/ ersetzen UI-Routen vor dem build:
#   - app/api/connection-details/route.ts -> Allow-List + Password-Check
#   - app/api/rooms/route.ts              -> public-meta Liste fuer Landing
#   - app/page.tsx                        -> Raum-Liste statt Random-Room-Demo
# Logo aus ./assets/ wird ins public/ gelegt; Init-Container-Script aus
# ./init-rooms/ wird ins Runtime-Image gelegt.
#
# WICHTIG: Keine Build-Args fuer LIVEKIT_API_KEY/SECRET. Das Image ist public,
# Secrets kommen ausschliesslich als Runtime-ENV aus dem K8s-Secret in den Pod.

FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY upstream/package.json upstream/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY upstream/ ./
# IT4C-Overrides anwenden BEVOR gebaut wird.
COPY overrides/route.ts ./app/api/connection-details/route.ts
RUN mkdir -p ./app/api/rooms
COPY overrides/api-rooms-route.ts ./app/api/rooms/route.ts
COPY overrides/page.tsx ./app/page.tsx
COPY overrides/layout.tsx ./app/layout.tsx
COPY overrides/CookieGate.tsx ./app/CookieGate.tsx
COPY overrides/PermissionsCheck.tsx ./lib/PermissionsCheck.tsx
COPY overrides/rooms-page.tsx ./app/rooms/[roomName]/page.tsx
# Logo ins Next.js public/.
COPY assets/it4c-logo.png ./public/it4c-logo.png
# Default LiveKit-Assets entfernen (favicon, OG-Image, apple-touch).
RUN rm -f ./public/favicon.ico ./public/images/livekit-meet-open-graph.png \
          ./public/images/livekit-meet-home.svg ./public/images/livekit-apple-touch.png \
          ./public/images/livekit-safari-pinned-tab.svg
# Surgischer Patch: Password-URL-Param an /api/connection-details forwarden.
COPY scripts/patch-pageclient.js /tmp/it4c-patch-pageclient.js
RUN node /tmp/it4c-patch-pageclient.js
RUN pnpm build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Upstream's next.config setzt KEIN output: 'standalone' -- wir muessen
# .next + public + node_modules komplett mitnehmen. Falls upstream das
# spaeter umstellt: auf den standalone-Output kuerzen.
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules

# Init-Container-Script (gleicher Image-Tag wird als Init nochmal genutzt,
# Command dann: `node /app/init-rooms/index.js`).
COPY --chown=nextjs:nodejs init-rooms/ ./init-rooms/

USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
