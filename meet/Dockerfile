# syntax=docker/dockerfile:1.7
# Multi-stage Build fuer livekit-examples/meet (Next.js 15, pnpm).
# Quellcode liegt unter ./upstream/ -- lokal via sync-upstream.sh erzeugt,
# im CI via zweitem actions/checkout (siehe build-meet.yml).
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

USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
