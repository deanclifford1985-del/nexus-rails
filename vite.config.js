import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

// Two games, one build: Nexus Rail at / and Iron Dawn (the military RPG) at /irondawn/.
// This sends /irondawn (no slash) to its page in dev and preview.
const ironDawnRoute = () => {
  const redirect = (req, res, next) => {
    if (req.url === '/irondawn') {
      res.statusCode = 302;
      res.setHeader('Location', '/irondawn/');
      res.end();
    } else next();
  };
  return {
    name: 'irondawn-route',
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  };
};

export default defineConfig({
  plugins: [react(), ironDawnRoute()],
  build: { rolldownOptions: { input: { main: page('./index.html'), irondawn: page('./irondawn/index.html') } } },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  test: { environment: 'node' },
});
