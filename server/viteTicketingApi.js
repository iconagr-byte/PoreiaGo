import { handleAdminScan } from './scanHandler.js';
import { loadBookings } from './bookingDb.js';
import { buildManifestHandler } from './manifestHandler.js';

export function ticketingApiMiddleware() {
  return {
    name: 'ticketing-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        if (req.method === 'POST' && url === '/api/admin/scan') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { status, body: responseBody } = handleAdminScan(
                parsed,
                req.headers.authorization,
              );
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(responseBody));
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ result: 'FAILURE', message: 'Server error' }));
            }
          });
          return;
        }

        if (req.method === 'GET' && url === '/api/admin/bookings') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(loadBookings()));
          return;
        }

        if (req.method === 'GET' && url?.startsWith('/api/admin/offline-manifest')) {
          const params = new URL(req.url, 'http://localhost').searchParams;
          const tripId = Number(params.get('tripId'));
          const date = params.get('date');
          buildManifestHandler(tripId, date)
            .then((entries) => {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ savedAt: new Date().toISOString(), entries }));
            })
            .catch(() => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'manifest_failed' }));
            });
          return;
        }

        next();
      });
    },
  };
}
