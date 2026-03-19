# ══════════════════════════════════════════════════════════════════════════════
#  Stage 1 — Install ALL dependencies (prod + dev, needed for the build step)
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS deps

WORKDIR /digital-me

# Native compilation helpers (node-gyp, etc.)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ══════════════════════════════════════════════════════════════════════════════
#  Stage 2 — Build the Next.js standalone bundle
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /digital-me

COPY --from=deps /digital-me/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ══════════════════════════════════════════════════════════════════════════════
#  Stage 3 — Lean production image
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner

WORKDIR /digital-me

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7001
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser  --system --uid 1001 nextjs

# ── Next.js standalone output ────────────────────────────────────────────────
COPY --from=builder /digital-me/.next/standalone ./
COPY --from=builder /digital-me/.next/static     ./.next/static
COPY --from=builder /digital-me/public           ./public

# ── Source files needed by CLI, scheduler & memory layer ─────────────────────
COPY --from=builder /digital-me/cli              ./cli
COPY --from=builder /digital-me/jobs             ./jobs
COPY --from=builder /digital-me/memory           ./memory
COPY --from=builder /digital-me/model            ./model
COPY --from=builder /digital-me/integrations     ./integrations
COPY --from=builder /digital-me/utils            ./utils
COPY --from=builder /digital-me/scripts          ./scripts
COPY --from=builder /digital-me/tsconfig.json    ./tsconfig.json
COPY --from=builder /digital-me/tsconfig.cli.json ./tsconfig.cli.json
COPY --from=builder /digital-me/package.json     ./package.json

# ── Runtime deps for ts-node (CLI needs these) ──────────────────────────────
COPY --from=deps /digital-me/node_modules ./node_modules

# ── Ensure data & log directories exist ──────────────────────────────────────
RUN mkdir -p data/vector data/processed/static data/processed/dynamic \
  data/processed/episodic data/reports .logs && \
  chown -R nextjs:nodejs /digital-me

USER nextjs

EXPOSE 7001

# Health check — pings the Next.js server
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7001/ || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
