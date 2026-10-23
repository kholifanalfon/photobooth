# syntax = docker/dockerfile:1

ARG NODE_VERSION=20-bookworm-slim
FROM node:${NODE_VERSION} AS base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

# Install runtime dependencies required by Prisma engine & OpenSSL
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV="production"
ENV PORT=3000


# Build Stage
FROM base AS build

# Install build dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends build-essential python-is-python3 pkg-config && \
    rm -rf /var/lib/apt/lists/*

# Copy only server package files and Prisma schema
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Install server dependencies
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy server application source code
COPY server/ ./

# Prune development dependencies to keep final image small
RUN npm prune --omit=dev


# Final Stage
FROM base

WORKDIR /app

# Copy application and node_modules from build stage
COPY --from=build /app /app

# Copy docker-entrypoint script if needed and set execution rights
RUN chmod +x ./docker-entrypoint.sh 2>/dev/null || true

# Ensure required runtime folders exist
RUN mkdir -p /app/uploads /app/data

EXPOSE 3000

# Start server using docker-entrypoint (for automatic Prisma schema sync if DATABASE_URL is set)
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD [ "npm", "run", "start" ]
