import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite dev plugin to execute Netlify Functions locally during `npm run dev`.
 */
function netlifyFunctionsDevPlugin(): Plugin {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/.netlify/functions/game')) {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const mod = await server.ssrLoadModule('./netlify/functions/game.ts');
              const handler = mod.handler;
              const event = {
                httpMethod: req.method || 'GET',
                headers: req.headers as Record<string, string>,
                body,
                path: req.url || '',
                queryStringParameters: {},
              };
              const result = await handler(event, {});
              res.statusCode = result.statusCode || 200;
              if (result.headers) {
                Object.entries(result.headers).forEach(([k, v]) => {
                  res.setHeader(k, String(v));
                });
              }
              res.end(result.body);
            } catch (err) {
              console.error('Error invoking local Netlify Function:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Dev server function error' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
