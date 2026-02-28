import express, { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 3333;
const DEFAULT_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

const BASE_PRICES: Record<string, number> = {
  AAPL: 198.50,
  GOOGL: 178.25,
  MSFT: 425.80,
  TSLA: 248.90,
  AMZN: 192.40,
};

// ---------------------------------------------------------------------------
// Types (shared contract with Angular client)
// ---------------------------------------------------------------------------

interface QuoteTick {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
}

/** Delta payload: only symbol + timestamp are guaranteed. All other fields are optional. */
interface QuoteDelta {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
}

interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

interface PortfolioSnapshot {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const currentPrices: Record<string, number> = { ...BASE_PRICES };

function generateQuoteTick(symbol: string): QuoteTick {
  // Lazily seed any unknown symbol (e.g. DJI, SPX, BTC) with a random base price
  if (!(symbol in BASE_PRICES)) {
    BASE_PRICES[symbol] = +(Math.random() * 450 + 50).toFixed(2);
    console.log(`[Server] Seeding unknown symbol "${symbol}" at $${BASE_PRICES[symbol]}`);
  }
  const base = currentPrices[symbol] ?? BASE_PRICES[symbol];

  // Random walk: -0.5% to +0.5% per tick
  const changePct = (Math.random() - 0.5) * 0.01;
  const newPrice = +(base * (1 + changePct)).toFixed(2);
  const sessionOpen = BASE_PRICES[symbol];
  const change = +(newPrice - sessionOpen).toFixed(2);
  const changePercent = +((change / sessionOpen) * 100).toFixed(2);

  currentPrices[symbol] = newPrice;

  const spread = +(Math.random() * 0.10).toFixed(2);

  return {
    symbol,
    price: newPrice,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 1_000_000) + 100_000,
    bid: +(newPrice - spread).toFixed(2),
    ask: +(newPrice + spread).toFixed(2),
    timestamp: Date.now(),
  };
}

/**
 * Generates a partial update (delta) for a symbol.
 * Randomly includes 1-3 fields that "changed" to simulate a real delta feed
 * where the server only sends fields that differ from the previous tick.
 */
function generateQuoteDelta(symbol: string): QuoteDelta {
  const full = generateQuoteTick(symbol);
  const delta: QuoteDelta = { symbol: full.symbol, timestamp: full.timestamp };

  // Always include price (the most-watched field)
  delta.price = full.price;

  // Randomly include other fields to simulate sparse deltas
  if (Math.random() > 0.5) delta.change = full.change;
  if (Math.random() > 0.5) delta.changePercent = full.changePercent;
  if (Math.random() > 0.6) delta.volume = full.volume;
  if (Math.random() > 0.7) delta.bid = full.bid;
  if (Math.random() > 0.7) delta.ask = full.ask;

  return delta;
}

function generatePortfolioSnapshot(): PortfolioSnapshot {
  const positions: Position[] = [
    { symbol: 'AAPL', shares: 50, avgCost: 185.00 },
    { symbol: 'GOOGL', shares: 30, avgCost: 165.00 },
    { symbol: 'MSFT', shares: 20, avgCost: 400.00 },
    { symbol: 'TSLA', shares: 15, avgCost: 230.00 },
  ].map((pos) => {
    const tick = generateQuoteTick(pos.symbol);
    const marketValue = +(tick.price * pos.shares).toFixed(2);
    const costBasis = +(pos.avgCost * pos.shares).toFixed(2);
    const gainLoss = +(marketValue - costBasis).toFixed(2);
    const gainLossPercent = +((gainLoss / costBasis) * 100).toFixed(2);

    return {
      symbol: pos.symbol,
      shares: pos.shares,
      avgCost: pos.avgCost,
      currentPrice: tick.price,
      marketValue,
      gainLoss,
      gainLossPercent,
    };
  });

  const totalValue = +positions.reduce((sum, p) => sum + p.marketValue, 0).toFixed(2);
  const totalCost = positions.reduce(
    (sum, p) => sum + p.avgCost * p.shares,
    0
  );
  const dayChange = +(totalValue - totalCost).toFixed(2);
  const dayChangePercent = +((dayChange / totalCost) * 100).toFixed(2);

  return {
    totalValue,
    dayChange,
    dayChangePercent,
    positions,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Symbol resolution
// ---------------------------------------------------------------------------

/**
 * Parses ?symbols=AAPL,TSLA,DJI from the SSE request query string.
 * - If no symbols param: falls back to DEFAULT_SYMBOLS.
 * - Normalizes to uppercase. Deduplicates.
 * - Unknown symbols (e.g. DJI, SPX, BTC) are seeded lazily in generateQuoteTick.
 */
function resolveRequestedSymbols(req: Request): string[] {
  const raw = req.query['symbols'];
  if (!raw || typeof raw !== 'string') {
    return [...DEFAULT_SYMBOLS];
  }
  return [...new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

/**
 * Parses ?mode=delta|full from the query string.
 * - 'delta': server sends QuoteDelta (only changed fields).
 * - 'full' (default): server sends complete QuoteTick.
 */
function resolveMode(req: Request): 'full' | 'delta' {
  const raw = req.query['mode'];
  return raw === 'delta' ? 'delta' : 'full';
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// CORS for local Angular dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ---------------------------------------------------------------------------
// SSE: Quote stream
// ---------------------------------------------------------------------------

app.get('/api/sse/quotes', (req: Request, res: Response) => {
  const symbols = resolveRequestedSymbols(req);
  const mode = resolveMode(req);
  console.log(`[SSE] Client connected to /api/sse/quotes, symbols: [${symbols.join(', ')}], mode: ${mode}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a comment line as keep-alive immediately
  res.write(':ok\n\n');

  const intervalId = setInterval(() => {
    // Rotate through requested symbols, one tick per interval
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const payload = mode === 'delta' ? generateQuoteDelta(symbol) : generateQuoteTick(symbol);

    // SSE format: named event + JSON data
    res.write(`event: quote\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, randomInterval(1000, 3000));

  req.on('close', () => {
    console.log(`[SSE] Client disconnected from /api/sse/quotes`);
    clearInterval(intervalId);
  });
});

// ---------------------------------------------------------------------------
// SSE: Portfolio stream
// ---------------------------------------------------------------------------

app.get('/api/sse/portfolio', (req: Request, res: Response) => {
  console.log('[SSE] Client connected to /api/sse/portfolio');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(':ok\n\n');

  // Send initial snapshot immediately
  const initial = generatePortfolioSnapshot();
  res.write(`event: portfolio\n`);
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  const intervalId = setInterval(() => {
    const snapshot = generatePortfolioSnapshot();
    res.write(`event: portfolio\n`);
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  }, randomInterval(2000, 5000));

  req.on('close', () => {
    console.log('[SSE] Client disconnected from /api/sse/portfolio');
    clearInterval(intervalId);
  });
});

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');

  // Track subscriptions per client
  const subscriptions = new Map<string, ReturnType<typeof setInterval>>();

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('[WS] Received:', msg);

      if (msg.type === 'subscribe' && Array.isArray(msg.symbols)) {
        for (const symbol of msg.symbols) {
          if (subscriptions.has(symbol)) continue; // already subscribed

          console.log(`[WS] Subscribing to ${symbol}`);
          const intervalId = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const tick = generateQuoteTick(symbol);
              ws.send(JSON.stringify({ type: 'quote', data: tick }));
            }
          }, randomInterval(1000, 2000));

          subscriptions.set(symbol, intervalId);
        }

        // Acknowledge
        ws.send(JSON.stringify({
          type: 'subscribed',
          symbols: msg.symbols,
        }));
      }

      if (msg.type === 'unsubscribe' && Array.isArray(msg.symbols)) {
        for (const symbol of msg.symbols) {
          const intervalId = subscriptions.get(symbol);
          if (intervalId) {
            clearInterval(intervalId);
            subscriptions.delete(symbol);
            console.log(`[WS] Unsubscribed from ${symbol}`);
          }
        }

        ws.send(JSON.stringify({
          type: 'unsubscribed',
          symbols: msg.symbols,
        }));
      }

      if (msg.type === 'subscribe-portfolio') {
        if (subscriptions.has('__portfolio__')) return;

        console.log('[WS] Subscribing to portfolio');
        const intervalId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const snapshot = generatePortfolioSnapshot();
            ws.send(JSON.stringify({ type: 'portfolio', data: snapshot }));
          }
        }, randomInterval(2000, 4000));

        subscriptions.set('__portfolio__', intervalId);
        ws.send(JSON.stringify({ type: 'subscribed-portfolio' }));
      }
    } catch (err) {
      console.error('[WS] Invalid message:', raw.toString());
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected, clearing all subscriptions');
    for (const intervalId of subscriptions.values()) {
      clearInterval(intervalId);
    }
    subscriptions.clear();
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function randomInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

server.listen(PORT, () => {
  console.log('');
  console.log('===========================================');
  console.log(' Mock Streaming Server');
  console.log('===========================================');
  console.log(`  Health:        http://localhost:${PORT}/api/health`);
  console.log(`  SSE quotes:    http://localhost:${PORT}/api/sse/quotes`);
  console.log(`  SSE quotes:    http://localhost:${PORT}/api/sse/quotes?symbols=AAPL,TSLA,DJI`);
  console.log(`  SSE delta:     http://localhost:${PORT}/api/sse/quotes?symbols=AAPL,TSLA&mode=delta`);
  console.log(`  SSE portfolio: http://localhost:${PORT}/api/sse/portfolio`);
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws`);
  console.log('===========================================');
  console.log('');
});
