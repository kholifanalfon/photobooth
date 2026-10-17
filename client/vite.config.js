import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables from client directory and project root
  const env = loadEnv(mode, process.cwd(), '');
  const rootEnv = loadEnv(mode, path.resolve(process.cwd(), '..'), '');

  const port = Number(
    env.VITE_PORT ||
    env.PORT ||
    rootEnv.VITE_PORT ||
    rootEnv.CLIENT_PORT ||
    5173
  );

  return {
    plugins: [react()],
    server: {
      port,
      host: true
    }
  };
});
