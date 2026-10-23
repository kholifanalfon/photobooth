FROM node:20-bookworm-slim

# Install OpenSSL and ca-certificates required by Prisma engine
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications first for layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy application source code
COPY . .

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=development
ENV PORT=5025

EXPOSE 5025

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
