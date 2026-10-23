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

# Copy root, client, and server package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install root, client, and server dependencies
RUN npm ci --include=dev && \
    npm --prefix client ci --include=dev && \
    npm --prefix server ci --include=dev

# Generate Prisma Client
RUN npm --prefix server run prisma:generate

# Copy source code
COPY . .

# Build client SPA assets (outputs to /app/client/dist)
RUN npm run build

# Prune development dependencies to keep image size small
RUN npm prune --omit=dev && \
    npm --prefix client prune --omit=dev && \
    npm --prefix server prune --omit=dev


# Final Stage
FROM base

WORKDIR /app

# Copy application and built artifacts
COPY --from=build /app /app

# Ensure uploads and data directories exist
RUN mkdir -p /app/server/uploads /app/server/data

EXPOSE 3000

# Start Express server via root script
CMD [ "npm", "run", "start" ]
