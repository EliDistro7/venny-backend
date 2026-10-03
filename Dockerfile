# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# Install only production dependencies in a clean layer so the final image
# never includes devDependencies or the npm cache.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only the manifest files first so Docker caches this layer until they change
COPY package.json package-lock.json* ./

RUN npm ci --omit=dev


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — final image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install system binaries needed at runtime (yt-dlp + ffmpeg for clip tool)
RUN apk add --no-cache ffmpeg python3 py3-pip \
 && pip3 install yt-dlp --break-system-packages

# Basic hardening: run as a non-root user
RUN addgroup --system --gid 1001 bss \
 && adduser  --system --uid 1001 --ingroup bss bss

WORKDIR /app

# Copy installed modules from the deps stage (no devDeps, no cache)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/

# Own everything as the non-root user
RUN chown -R bss:bss /app

USER bss

# ── runtime config ────────────────────────────────────────────────────────────
# All secrets come from environment variables — never baked into the image.
#
# Required:
#   MONGO_URI                  — MongoDB connection string
#   JWT_SECRET                 — Secret used to sign admin JWTs
#   ADMIN_PASSWORD             — Default admin password (seeded on first boot)
#
# Required for file uploads (Cloudflare R2):
#   CLOUDFLARE_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#   R2_BUCKET_NAME
#   R2_PUBLIC_URL              — Public base URL of the R2 bucket/domain
#
# Optional:
#   PORT                       — Defaults to 5000
#   CLIENT_URL                 — Allowed CORS origin #1
#   CLIENT_URL_2               — Allowed CORS origin #2
#   NODE_ENV                   — Set to "production" to silence Morgan dev logs
#   CLIPS_DIR                  — Directory for temporary clip storage (default: /tmp/bss-clips)

EXPOSE 5000

CMD ["node", "src/server.js"]