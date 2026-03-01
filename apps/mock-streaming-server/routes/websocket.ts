import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { generateQuoteTick } from '../generators/quote.js';
import { generatePortfolioSnapshot } from '../generators/portfolio.js';
import { randomInterval } from '../utils.js';

// ---------------------------------------------------------------------------
// WebSocket server setup
// ---------------------------------------------------------------------------

/**
 * Attaches a WebSocketServer to the existing HTTP server at path `/ws`.
 *
 * Client protocol (JSON messages):
 *
 *   → { type: 'subscribe',           symbols: string[] }
 *   ← { type: 'quote',               data: QuoteTick }  (one per symbol per tick)
 *   ← { type: 'subscribed',          symbols: string[] }
 *
 *   → { type: 'unsubscribe',          symbols: string[] }
 *   ← { type: 'unsubscribed',         symbols: string[] }
 *
 *   → { type: 'subscribe-portfolio' }
 *   ← { type: 'portfolio',            data: PortfolioSnapshot }
 *   ← { type: 'subscribed-portfolio' }
 */
export function attachWebSocketServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WS] Client connected');

    // Per-client subscription timers, keyed by symbol (or '__portfolio__')
    const timers = new Map<string, ReturnType<typeof setInterval>>();

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, timers, msg);
      } catch {
        console.error('[WS] Invalid message (not valid JSON):', raw.toString());
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected — clearing subscriptions');
      timers.forEach(clearInterval);
      timers.clear();
    });
  });

  console.log('[WS] WebSocket server attached at /ws');
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

type Timers = Map<string, ReturnType<typeof setInterval>>;

function handleMessage(ws: WebSocket, timers: Timers, msg: unknown): void {
  if (!isRecord(msg)) return;

  switch (msg['type']) {
    case 'subscribe':
      return handleSubscribe(ws, timers, msg);
    case 'unsubscribe':
      return handleUnsubscribe(ws, timers, msg);
    case 'subscribe-portfolio':
      return handleSubscribePortfolio(ws, timers);
  }
}

function handleSubscribe(ws: WebSocket, timers: Timers, msg: Record<string, unknown>): void {
  const symbols = asStringArray(msg['symbols']);
  if (!symbols.length) return;

  for (const symbol of symbols) {
    if (timers.has(symbol)) continue; // already subscribed

    console.log(`[WS] Subscribing to ${symbol}`);
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'quote', data: generateQuoteTick(symbol) }));
      }
    }, randomInterval(1000, 2000));

    timers.set(symbol, timer);
  }

  ws.send(JSON.stringify({ type: 'subscribed', symbols }));
}

function handleUnsubscribe(ws: WebSocket, timers: Timers, msg: Record<string, unknown>): void {
  const symbols = asStringArray(msg['symbols']);
  if (!symbols.length) return;

  for (const symbol of symbols) {
    const timer = timers.get(symbol);
    if (timer) {
      clearInterval(timer);
      timers.delete(symbol);
      console.log(`[WS] Unsubscribed from ${symbol}`);
    }
  }

  ws.send(JSON.stringify({ type: 'unsubscribed', symbols }));
}

function handleSubscribePortfolio(ws: WebSocket, timers: Timers): void {
  if (timers.has('__portfolio__')) return; // already subscribed

  console.log('[WS] Subscribing to portfolio');
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'portfolio', data: generatePortfolioSnapshot() }));
    }
  }, randomInterval(2000, 4000));

  timers.set('__portfolio__', timer);
  ws.send(JSON.stringify({ type: 'subscribed-portfolio' }));
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
