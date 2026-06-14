# syntax=docker/dockerfile:1
# Next.js 16 standalone → Cloud Run (auracle-prod-311). Reads Firestore at
# runtime via the Cloud Run service account (ADC); no creds baked in.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080
# Non-root runtime
RUN groupadd -r app && useradd -r -g app app
# Next standalone bundle (server.js + traced node_modules) + static + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER app
EXPOSE 8080
CMD ["node", "server.js"]
