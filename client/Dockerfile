FROM node:20-bookworm-slim

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm install

# Copy client source code
COPY . .

ENV PORT=5173
ENV VITE_PORT=5173

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
