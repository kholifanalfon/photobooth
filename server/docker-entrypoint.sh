#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[photobooth-server] Synchronizing Prisma schema..."
  npx prisma generate
  npx prisma db push --skip-generate || echo "[photobooth-server] Warning: prisma db push failed, continuing with file-based fallback if available..."
fi

exec "$@"
