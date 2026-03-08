import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocketServer } from 'ws';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTTP_PORT = Number(process.env.PORT ?? 5173);
const BAUD_RATE = Number(process.env.BAUD_RATE ?? 115200);
const SERIAL_PATH = process.env.SERIAL_PATH; // optional override, e.g. /dev/ttyACM0
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

function chooseSerialPath(ports) {
  if (SERIAL_PATH) return SERIAL_PATH;
  const candidates = ports
    .map((p) => p.path)
    .filter(Boolean)
    .filter((p) => /\/dev\/tty(ACM|USB)\d+/.test(p) || /^COM\d+$/i.test(p));
  return candidates[0] ?? null;
}

async function startSerialBroadcaster({ onLine, onStatus }) {
  while (true) {
    try {
      const ports = await SerialPort.list();
      const chosen = chooseSerialPath(ports);
      if (!chosen) {
        onStatus({ connected: false, reason: 'No serial ports found yet.' });
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      onStatus({ connected: false, reason: `Opening ${chosen} @ ${BAUD_RATE}...` });
      const port = new SerialPort({ path: chosen, baudRate: BAUD_RATE, autoOpen: true });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      onStatus({ connected: true, path: chosen, baudRate: BAUD_RATE });

      parser.on('data', (chunk) => {
        const line = String(chunk).trim();
        if (!line) return;
        onLine(line);
      });

      await new Promise((resolve, reject) => {
        port.on('close', resolve);
        port.on('error', reject);
      });

      onStatus({ connected: false, reason: 'Serial port closed, reconnecting...' });
    } catch (err) {
      onStatus({ connected: false, reason: `Serial error, retrying...`, error: String(err) });
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Serve static files from dist/. If dist doesn't exist, return a helpful message.
    if (!(await fileExists(DIST_DIR))) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('dist/ not found. Run: npm run build');
      return;
    }

    let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname));
    if (url.pathname === '/' || url.pathname === '') filePath = path.join(DIST_DIR, 'index.html');

    // SPA fallback
    if (!(await fileExists(filePath))) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'content-type': contentTypeFor(filePath) });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(err));
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

let lastStatus = { connected: false };

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', ...lastStatus }));
});

startSerialBroadcaster({
  onLine: (line) => {
    // forward raw line + best-effort parsed JSON (same format your Arduino already prints)
    let parsed = null;
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        parsed = JSON.parse(line);
      } catch {
        parsed = null;
      }
    }
    broadcast({ type: 'data', raw: line, parsed });
  },
  onStatus: (status) => {
    lastStatus = { ...status, at: new Date().toISOString() };
    broadcast({ type: 'status', ...lastStatus });
  },
});

server.listen(HTTP_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`bike_dashboard server on http://localhost:${HTTP_PORT}`);
});

