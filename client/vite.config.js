import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables from client directory, server directory, and project root
  const clientEnv = loadEnv(mode, process.cwd(), '');
  const serverEnv = loadEnv(mode, path.resolve(process.cwd(), '../server'), '');
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '');

  // Look for port in client, server, or root env
  const rawPort =
    process.env.VITE_PORT ||
    process.env.CLIENT_PORT ||
    clientEnv.VITE_PORT ||
    clientEnv.CLIENT_PORT ||
    serverEnv.VITE_PORT ||
    serverEnv.CLIENT_PORT ||
    rootEnv.VITE_PORT ||
    rootEnv.CLIENT_PORT ||
    clientEnv.PORT;

  let port = Number(rawPort);

  // If still not determined, try parsing port from CLIENT_URL (e.g. "http://localhost:5125")
  if (!port && serverEnv.CLIENT_URL) {
    try {
      const parsedUrl = new URL(serverEnv.CLIENT_URL);
      if (parsedUrl.port) {
        port = Number(parsedUrl.port);
      }
    } catch {
      // ignore
    }
  }

  if (!port) {
    port = 5173;
  }

  return {
    plugins: [react()],
    server: {
      port,
      host: true
    }
  };
});
