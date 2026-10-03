# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — node deps
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build bgutil server
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS bgutil-build

RUN apk add --no-cache \
      git python3 make g++ \
      pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev

WORKDIR /opt/bgutil
RUN git clone --depth=1 --branch 1.3.1 \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git .

WORKDIR /opt/bgutil/server
RUN npm ci \
 && npx tsc --project tsconfig.json

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — final image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache \
      ffmpeg python3 py3-pip supervisor \
      pixman cairo pango jpeg giflib \
 && pip3 install yt-dlp bgutil-ytdlp-pot-provider --break-system-packages

RUN addgroup --system --gid 1001 bss \
 && adduser  --system --uid 1001 --ingroup bss bss

WORKDIR /opt/bgutil/server
COPY --from=bgutil-build /opt/bgutil/server/build        ./build
COPY --from=bgutil-build /opt/bgutil/server/node_modules ./node_modules
COPY --from=bgutil-build /opt/bgutil/server/package.json ./

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/        ./src/
RUN chown -R bss:bss /app

COPY supervisord.conf /etc/supervisord.conf

ENV BGUTIL_BASE_URL=http://127.0.0.1:4416

EXPOSE 5000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]