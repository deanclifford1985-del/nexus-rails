// Clerk's sign-in traffic for the published app, proxied through this server at /api/__clerk.
// This mirrors Replit's managed-Clerk template (production only: Clerk test instances don't proxy).
// Mount it before any body parser: it streams raw bytes.
import { createProxyMiddleware } from 'http-proxy-middleware';

const CLERK_FAPI = 'https://frontend-api.clerk.dev';
export const CLERK_PROXY_PATH = '/api/__clerk';

// The public host the player used (first X-Forwarded-Host hop, else Host).
export function clerkProxyHost(req) {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware({ production, secretKey }) {
  if (!production || !secretKey) return (req, res, next) => next();
  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: (path) => path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ''),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = clerkProxyHost(req) || '';
        proxyReq.setHeader('Clerk-Proxy-Url', `${protocol}://${host}${CLERK_PROXY_PATH}`);
        proxyReq.setHeader('Clerk-Secret-Key', secretKey);
        const xff = req.headers['x-forwarded-for'];
        const clientIp = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
        if (clientIp) proxyReq.setHeader('X-Forwarded-For', clientIp);
      },
      // Pass responses through with a definite length (Replit's edge rejects some chunked replies).
      proxyRes: (proxyRes, req, res) => {
        const headers = { ...proxyRes.headers };
        delete headers['transfer-encoding'];
        delete headers.connection;
        delete headers['keep-alive'];
        const status = proxyRes.statusCode ?? 502;
        if (status < 200 || status === 204) delete headers['content-length'];
        const bodyless = req.method === 'HEAD' || status < 200 || status === 204 || status === 304;
        if (headers['content-length'] !== undefined || bodyless) {
          res.writeHead(status, headers);
          proxyRes.on('error', () => res.destroy());
          proxyRes.pipe(res);
          return;
        }
        const chunks = [];
        proxyRes.on('data', (chunk) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const body = Buffer.concat(chunks);
          headers['content-length'] = String(body.length);
          res.writeHead(status, headers);
          res.end(body);
        });
        proxyRes.on('error', () => {
          if (!res.headersSent) res.writeHead(502, { 'content-length': '0' });
          res.end();
        });
      },
    },
  });
}
