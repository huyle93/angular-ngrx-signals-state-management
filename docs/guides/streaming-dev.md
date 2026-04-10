# Streaming Development Guide

> Local mock server and Angular client patterns for Server-Sent Events (SSE) and WebSocket streaming.
>
> AI coding reference and learning material for testing real-time market data and portfolio updates with NgRx SignalStore.

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Mental Model: SSE vs WebSocket](#2-mental-model-sse-vs-websocket)
3. [Technology Choice](#3-technology-choice)
4. [Server Architecture](#4-server-architecture)
5. [Server Implementation](#5-server-implementation)
6. [Mock Data Contracts](#6-mock-data-contracts)
7. [Angular Client: SSE Service](#7-angular-client-sse-service)
8. [Angular Client: WebSocket Service](#8-angular-client-websocket-service)
9. [SignalStore Integration](#9-signalstore-integration)
10. [Connection Lifecycle](#10-connection-lifecycle)
11. [Testing and Debugging Streaming APIs](#11-testing-and-debugging-streaming-apis)
12. [Streaming Payload Design](#12-streaming-payload-design)
13. [Partial Update Pattern in SignalStore](#13-partial-update-pattern-in-signalstore)
14. [Local Dev Network and Proxy Setup](#14-local-dev-network-and-proxy-setup)
15. [Choosing SSE vs WebSocket](#15-choosing-sse-vs-websocket)
16. [Guardrails](#16-guardrails)

---

## 1. Purpose

This guide exists for three reasons:

1. **Local testing.** Provide a throwaway Node.js server that emits fake market data so the Angular app can exercise streaming state management without a real backend.
2. **Learning.** Explain the mental model behind SSE and WebSocket so the developer understands when each applies and how data flows.
3. **AI agent instructions.** Give an AI coding assistant enough detail to scaffold the server and client code correctly on first pass.

The mock server is never production code. It runs on localhost, has no auth, no persistence, and no error handling beyond what is needed to keep the connection alive.

---

## 2. Mental Model: SSE vs WebSocket

### Server-Sent Events (SSE)

SSE is a one-way channel. The server pushes data to the client over a long-lived HTTP response. The client cannot send messages back on the same connection.

```
Client ----GET /stream----> Server
Client <---data: {...}----- Server
Client <---data: {...}----- Server
Client <---data: {...}----- Server
       (connection stays open)
```

How it works under the hood:

1. Client opens a GET request using the `EventSource` browser API.
2. Server responds with `Content-Type: text/event-stream` and keeps the response open.
3. Server writes lines in the format `data: <payload>\n\n` whenever it has new data.
4. The browser parses each `data:` block and fires a `message` event on the `EventSource` object.
5. If the connection drops, `EventSource` reconnects automatically (built-in retry with configurable `retry:` field).

Key properties:

- HTTP-based. Works through proxies, load balancers, CDNs without special configuration.
- Text only (JSON stringified). No binary frames.
- Automatic reconnection is built into the browser API.
- Supports named event types (`event: quote\ndata: {...}\n\n`).
- Unidirectional: server to client only.

### WebSocket

WebSocket is a full-duplex channel. Both client and server can send messages at any time after the initial HTTP upgrade handshake.

```
Client ----HTTP Upgrade----> Server
Client <---101 Switching---- Server
Client <===> bidirectional <===> Server
       (persistent TCP connection)
```

How it works under the hood:

1. Client sends an HTTP request with `Upgrade: websocket` header.
2. Server responds with `101 Switching Protocols`.
3. The connection upgrades from HTTP to the WebSocket protocol (a framed binary protocol over TCP).
4. Either side can send text or binary frames at any time.
5. Either side can close the connection. There is no automatic reconnection; the client must implement retry logic.

Key properties:

- Full-duplex. Client can send messages (subscribe/unsubscribe to symbols, request specific data).
- Supports binary data (useful for high-frequency data, but not needed for our use case).
- Lower per-message overhead than HTTP (no headers per message after handshake).
- No automatic reconnection. Client must handle reconnect logic manually.
- Requires WebSocket-aware proxies and load balancers in production.

### When Each Applies

| Criterion | SSE | WebSocket |
|---|---|---|
| Direction | Server to client only | Bidirectional |
| Client sends messages | No (use separate HTTP requests) | Yes (on the same connection) |
| Reconnection | Automatic (browser built-in) | Manual (you write it) |
| Protocol | HTTP | WebSocket (ws:// or wss://) |
| Proxy compatibility | High (standard HTTP) | Requires WebSocket support |
| Binary data | No | Yes |
| Browser API | `EventSource` | `WebSocket` |
| Best for | Price feeds, notifications, read-only streams | Chat, interactive subscriptions, bidirectional control |

For a market data feed where the server pushes quotes and the client just listens, SSE is simpler and sufficient. For scenarios where the client needs to subscribe/unsubscribe to specific symbols dynamically on the same connection, WebSocket is the better fit.

This guide implements both so you can evaluate each pattern with real SignalStore integration.

---

## 3. Technology Choice

**Express.js** with the **ws** library.

Rationale:

| Considered | Verdict | Why |
|---|---|---|
| Express + ws | Selected | Minimal setup. SSE is just HTTP headers + response streaming. ws is the standard WebSocket library. Single file server. Zero framework overhead. |
| NestJS | Rejected | Enterprise framework. Massive dependency tree. Overkill for a local mock server. |
| Fastify | Rejected | Good server, but Express is more widely known and the performance difference is irrelevant for a local mock. |
| Plain Node http | Rejected | Too bare. No routing, no middleware. Express adds trivial overhead but meaningful convenience. |
| Socket.IO | Rejected | Adds abstraction layer over WebSocket. We want to learn the raw protocol, not a wrapper. |

Dependencies (two packages total):

- `express` -- HTTP server and routing
- `ws` -- WebSocket server that attaches to the Express HTTP server

Dev dependencies:

- `tsx` -- Run TypeScript directly without compilation step

---

## 4. Server Architecture

The server is a single TypeScript file that runs on `http://localhost:3333`.

```
tools/mock-streaming-server/
  package.json          # Dependencies: express, ws, tsx
  server.ts             # Single file: SSE + WebSocket + mock data
```

### Endpoints

| Endpoint | Protocol | Purpose |
|---|---|---|
| `GET /api/sse/quotes` | SSE | Streams ticks for all default symbols (AAPL, GOOGL, MSFT, TSLA, AMZN) every 1-3 seconds |
| `GET /api/sse/quotes?symbols=AAPL,TSLA,DJI` | SSE | **Primary endpoint.** Streams ticks for the requested symbols only. Unknown symbols (e.g. `DJI`, `SPX`, `BTC`) are seeded with a random base price automatically. |
| `GET /api/sse/portfolio` | SSE | Pushes a portfolio snapshot every 2-5 seconds |
| `ws://localhost:3333/ws` | WebSocket | Secondary option. Bidirectional. Client sends `{ type: "subscribe", symbols: ["AAPL"] }`, server streams matching quotes. |
| `GET /api/health` | HTTP | Returns `{ status: "ok" }` for connectivity check |

### Data Flow

```
server.ts
  |
  +-- generateQuoteTick(symbol)    --> returns a QuoteTick object with randomized price movement
  |
  +-- generatePortfolioSnapshot()  --> returns a PortfolioSnapshot with randomized position values
  |
  +-- SSE /api/sse/quotes          --> resolveRequestedSymbols(?symbols=) -> setInterval -> write quote tick as SSE event
  |
  +-- SSE /api/sse/portfolio       --> setInterval -> write portfolio snapshot as SSE event
  |
  +-- WebSocket /ws                --> on "subscribe" message, start interval per symbol
                                       on "unsubscribe", clear interval
                                       on close, clear all intervals
```

---

## 5. Server Implementation

### 5.1 File: `tools/mock-streaming-server/package.json`

```json
{
  "name": "mock-streaming-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx server.ts"
  },
  "dependencies": {
    "express": "^5.1.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/ws": "^8.18.0",
    "tsx": "^4.19.0"
  }
}
```

### 5.2 File: `tools/mock-streaming-server/server.ts`

Full implementation below. This is the single source of truth for the mock server.

```typescript
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
  console.log(`[SSE] Client connected to /api/sse/quotes, symbols: [${symbols.join(', ')}]`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a comment line as keep-alive immediately
  res.write(':ok\n\n');

  const intervalId = setInterval(() => {
    // Rotate through requested symbols, one tick per interval
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const tick = generateQuoteTick(symbol);

    // SSE format: named event + JSON data
    res.write(`event: quote\n`);
    res.write(`data: ${JSON.stringify(tick)}\n\n`);
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
  console.log(`  SSE portfolio: http://localhost:${PORT}/api/sse/portfolio`);
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws`);
  console.log('===========================================');
  console.log('');
});
```

### 5.3 Key Implementation Notes

**SSE mechanics:**

- `res.setHeader('Content-Type', 'text/event-stream')` tells the browser this is an SSE stream.
- `res.flushHeaders()` sends headers immediately so the client establishes the connection.
- Each event is two lines: `event: <name>\n` followed by `data: <json>\n\n`. The double newline terminates the event.
- The `:ok\n\n` comment line is a keep-alive. Some proxies drop connections that do not send data quickly.
- `req.on('close')` fires when the client disconnects. Always clear intervals here to prevent memory leaks.

**WebSocket mechanics:**

- `WebSocketServer` attaches to the same HTTP server on path `/ws`.
- The `message` event receives raw `Buffer` data. Parse it as JSON.
- Each client has its own `subscriptions` Map tracking active symbol intervals.
- The `readyState` check before `ws.send()` prevents writing to a closing socket.
- The `close` event clears all intervals for that client.

**randomInterval:**

- Varies tick frequency to simulate realistic market data jitter.
- SSE quotes: 1-3 seconds. Portfolio: 2-5 seconds. WebSocket quotes: 1-2 seconds.

---

## 6. Mock Data Contracts

> **Placeholder shapes.** The interfaces below are invented for local POC and testing only. Before wiring up a real feature, replace them with the actual response contracts from the Java Spring Boot gateway (generated via Orval codegen). When the real shapes are available, update `server.ts`, the repository interfaces, and the store state shape in one pass. The field names, nesting, and types will likely differ.

These are the TypeScript interfaces for the data emitted by the mock server. Mirror these in the Angular app.

### QuoteTick

```typescript
interface QuoteTick {
  symbol: string;       // "AAPL", "GOOGL", etc.
  price: number;        // Current price (random walk from base)
  change: number;       // Dollar change from session open
  changePercent: number; // Percent change from session open
  volume: number;       // Randomized volume
  bid: number;          // price - random spread
  ask: number;          // price + random spread
  timestamp: number;    // Date.now() epoch ms
}
```

### PortfolioSnapshot

```typescript
interface PortfolioSnapshot {
  totalValue: number;       // Sum of all position market values
  dayChange: number;        // Dollar change from cost basis
  dayChangePercent: number; // Percent change from cost basis
  positions: Position[];    // Individual holdings
  timestamp: number;        // Date.now() epoch ms
}

interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;      // currentPrice * shares
  gainLoss: number;         // marketValue - (avgCost * shares)
  gainLossPercent: number;
}
```

### WebSocket Message Protocol

Client to server:

```typescript
// Subscribe to quote updates for specific symbols
{ type: 'subscribe', symbols: ['AAPL', 'GOOGL'] }

// Unsubscribe from specific symbols
{ type: 'unsubscribe', symbols: ['AAPL'] }

// Subscribe to portfolio updates
{ type: 'subscribe-portfolio' }
```

Server to client:

```typescript
// Acknowledgments
{ type: 'subscribed', symbols: ['AAPL', 'GOOGL'] }
{ type: 'unsubscribed', symbols: ['AAPL'] }
{ type: 'subscribed-portfolio' }

// Data messages
{ type: 'quote', data: QuoteTick }
{ type: 'portfolio', data: PortfolioSnapshot }
```

---

## 7. Angular Client: SSE Service

The browser `EventSource` API handles SSE connections. Wrap it in an Observable for RxJS/SignalStore integration.

### SSE Observable Factory

Place in `data-access` layer (e.g., `libs/invest-app/<domain>/data-access/sse.util.ts` or a shared utility).

```typescript
import { Observable } from 'rxjs';

/**
 * Creates an Observable that connects to an SSE endpoint and emits parsed
 * JSON messages for the specified event name.
 *
 * The Observable:
 * - Opens the EventSource connection on subscribe.
 * - Emits each parsed event as a value.
 * - Completes never (stream is indefinite until unsubscribed).
 * - Closes the EventSource on unsubscribe (teardown).
 */
export function fromSSE<T>(url: string, eventName: string): Observable<T> {
  return new Observable<T>((subscriber) => {
    const eventSource = new EventSource(url);

    eventSource.addEventListener(eventName, (event: MessageEvent) => {
      try {
        const data: T = JSON.parse(event.data);
        subscriber.next(data);
      } catch (err) {
        subscriber.error(new Error(`Failed to parse SSE data: ${event.data}`));
      }
    });

    eventSource.onerror = (err) => {
      // EventSource reconnects automatically on transient errors.
      // Only propagate if the connection is permanently closed.
      if (eventSource.readyState === EventSource.CLOSED) {
        subscriber.error(new Error('SSE connection closed'));
      }
      // Otherwise, let EventSource handle reconnection silently.
      console.warn('SSE connection error, browser will retry automatically');
    };

    // Teardown: close connection when Observable is unsubscribed
    return () => {
      eventSource.close();
    };
  });
}
```

### Usage in a Repository

```typescript
import { Injectable } from '@angular/core';
import { fromSSE } from './sse.util';
import { QuoteTick, PortfolioSnapshot } from './models';

@Injectable({ providedIn: 'root' })
export class MarketStreamRepository {
  private readonly baseUrl = 'http://localhost:3333';

  /**
   * Returns an Observable that emits QuoteTick objects via SSE.
   * @param symbols - tickers/indices to subscribe to, e.g. ['AAPL', 'TSLA', 'DJI'].
   *                  If empty, the server streams all default symbols.
   */
  quoteStream$(symbols: string[] = []) {
    const query = symbols.length > 0 ? `?symbols=${symbols.join(',')}` : '';
    return fromSSE<QuoteTick>(`${this.baseUrl}/api/sse/quotes${query}`, 'quote');
  }

  /** Returns an Observable that emits PortfolioSnapshot objects via SSE. */
  portfolioStream$() {
    return fromSSE<PortfolioSnapshot>(`${this.baseUrl}/api/sse/portfolio`, 'portfolio');
  }
}
```

### How EventSource Reconnection Works

EventSource has built-in reconnection. If the connection drops:

1. Browser waits for a retry interval (default: ~3 seconds, configurable via `retry:` field from server).
2. Browser sends a new GET request to the same URL.
3. If the server sends a `Last-Event-ID` header or `id:` field, the browser includes it in the reconnect request as `Last-Event-Id` header.
4. The Observable consumer sees nothing -- data simply resumes flowing after reconnection.

This is the primary advantage of SSE over WebSocket for read-only streams: the reconnection logic is handled by the browser for free.

---

## 8. Angular Client: WebSocket Service

The browser `WebSocket` API is lower-level. Wrap it in an Observable with manual reconnection logic.

### WebSocket Observable Factory

```typescript
import { Observable, Subject, timer, retry, share, takeUntil } from 'rxjs';

/**
 * Creates a managed WebSocket connection that:
 * - Opens on first subscribe.
 * - Emits parsed JSON messages.
 * - Exposes a send() method for client-to-server messages.
 * - Reconnects on unexpected close with exponential backoff.
 * - Closes on unsubscribe.
 */
export class WebSocketConnection<TReceive, TSend = unknown> {
  private socket: WebSocket | null = null;
  private readonly messages$ = new Subject<TReceive>();
  private readonly destroy$ = new Subject<void>();

  readonly data$: Observable<TReceive> = this.messages$.asObservable();

  constructor(private readonly url: string) {}

  connect(): void {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log('[WS Client] Connected to', this.url);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const msg: TReceive = JSON.parse(event.data);
        this.messages$.next(msg);
      } catch {
        console.error('[WS Client] Failed to parse:', event.data);
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WS Client] Error:', err);
    };

    this.socket.onclose = (event) => {
      console.log('[WS Client] Closed:', event.code, event.reason);
      // Reconnect after 3 seconds if not intentionally destroyed
      if (!this.destroy$.closed) {
        setTimeout(() => this.connect(), 3000);
      }
    };
  }

  send(message: TSend): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('[WS Client] Cannot send, socket not open');
    }
  }

  disconnect(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socket?.close();
    this.socket = null;
    this.messages$.complete();
  }
}
```

### Alternative: Functional Observable Wrapper

For cases where a class feels too heavy, a pure function approach:

```typescript
import { Observable } from 'rxjs';

export function fromWebSocket<T>(url: string): Observable<T> {
  return new Observable<T>((subscriber) => {
    const ws = new WebSocket(url);

    ws.onmessage = (event: MessageEvent) => {
      try {
        subscriber.next(JSON.parse(event.data));
      } catch {
        subscriber.error(new Error(`Failed to parse WS message: ${event.data}`));
      }
    };

    ws.onerror = () => {
      subscriber.error(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      subscriber.complete();
    };

    return () => {
      ws.close();
    };
  });
}
```

Use with RxJS `retry` for reconnection:

```typescript
fromWebSocket<WsMessage>('ws://localhost:3333/ws').pipe(
  retry({ delay: 3000 })
);
```

### Usage in a Repository

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { WebSocketConnection } from './ws.util';
import { QuoteTick, PortfolioSnapshot } from './models';

interface WsIncoming {
  type: string;
  data?: QuoteTick | PortfolioSnapshot;
  symbols?: string[];
}

interface WsOutgoing {
  type: string;
  symbols?: string[];
}

@Injectable({ providedIn: 'root' })
export class MarketWebSocketRepository implements OnDestroy {
  private readonly ws = new WebSocketConnection<WsIncoming, WsOutgoing>(
    'ws://localhost:3333/ws'
  );

  constructor() {
    this.ws.connect();
  }

  subscribeToQuotes(symbols: string[]): void {
    this.ws.send({ type: 'subscribe', symbols });
  }

  unsubscribeFromQuotes(symbols: string[]): void {
    this.ws.send({ type: 'unsubscribe', symbols });
  }

  subscribeToPortfolio(): void {
    this.ws.send({ type: 'subscribe-portfolio' });
  }

  /** Observable of quote ticks only */
  quotes$(): Observable<QuoteTick> {
    return this.ws.data$.pipe(
      filter((msg) => msg.type === 'quote'),
      map((msg) => msg.data as QuoteTick)
    );
  }

  /** Observable of portfolio snapshots only */
  portfolio$(): Observable<PortfolioSnapshot> {
    return this.ws.data$.pipe(
      filter((msg) => msg.type === 'portfolio'),
      map((msg) => msg.data as PortfolioSnapshot)
    );
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }
}
```

---

## 9. SignalStore Integration

### Mental Model

Streaming data flows through this chain:

```
SSE/WebSocket  -->  Observable  -->  rxMethod  -->  patchState  -->  Signal  -->  UI
```

The store owns the connection lifecycle. The `rxMethod` handles the Observable subscription, maps incoming data to state updates via `patchState`, and ensures cleanup on store destroy.

### 9.1 State Shape for Streaming Data

```typescript
import { QuoteTick, PortfolioSnapshot } from './models';

interface MarketState {
  quotes: Record<string, QuoteTick>;  // keyed by symbol for O(1) lookup
  portfolio: PortfolioSnapshot | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastError: string | null;
}

const initialState: MarketState = {
  quotes: {},
  portfolio: null,
  connectionStatus: 'disconnected',
  lastError: null,
};
```

Key design decisions:

- `quotes` is a `Record<string, QuoteTick>` (dictionary), not an array. Each incoming tick overwrites the entry for that symbol. No scanning, no duplicates.
- `connectionStatus` tracks the stream health for the UI to show connection indicators.
- `lastError` captures the most recent error message for debugging.

### 9.2 SSE-Based SignalStore

```typescript
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { computed, inject } from '@angular/core';
import { pipe, tap, switchMap } from 'rxjs';
import { patchState } from '@ngrx/signals';
import { MarketStreamRepository } from './market-stream.repository';

export const MarketSseStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    /** Get a specific quote by symbol */
    quoteList: computed(() => Object.values(store.quotes())),
    isConnected: computed(() => store.connectionStatus() === 'connected'),
    portfolioValue: computed(() => store.portfolio()?.totalValue ?? 0),
  })),

  withMethods((store, repo = inject(MarketStreamRepository)) => ({

    /**
     * Start streaming quotes via SSE for the given symbols.
     * Pass an array of tickers/indices: ['AAPL', 'TSLA', 'DJI'].
     * rxMethod manages teardown automatically on store destroy.
     */
    connectQuoteStream: rxMethod<string[]>(
      pipe(
        tap(() => patchState(store, { connectionStatus: 'connecting' })),
        switchMap((symbols) =>
          repo.quoteStream$(symbols).pipe(
            tapResponse({
              next: (tick) => {
                patchState(store, {
                  connectionStatus: 'connected',
                  quotes: { ...store.quotes(), [tick.symbol]: tick },
                });
              },
              error: (err) => {
                patchState(store, {
                  connectionStatus: 'error',
                  lastError: err instanceof Error ? err.message : 'Unknown error',
                });
              },
            })
          )
        )
      )
    ),

    /** Start streaming portfolio via SSE. */
    connectPortfolioStream: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { connectionStatus: 'connecting' })),
        switchMap(() =>
          repo.portfolioStream$().pipe(
            tapResponse({
              next: (snapshot) => {
                patchState(store, {
                  connectionStatus: 'connected',
                  portfolio: snapshot,
                });
              },
              error: (err) => {
                patchState(store, {
                  connectionStatus: 'error',
                  lastError: err instanceof Error ? err.message : 'Unknown error',
                });
              },
            })
          )
        )
      )
    ),
  })),

  // Auto-connect on store init. Pass symbols driven by route params, user watchlist, or static config.
  withHooks({
    onInit(store) {
      store.connectQuoteStream(['AAPL', 'GOOGL', 'MSFT']);
      store.connectPortfolioStream();
    },
  })
);
```

### 9.3 WebSocket-Based SignalStore

```typescript
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { computed, inject } from '@angular/core';
import { pipe, tap, switchMap, EMPTY } from 'rxjs';
import { patchState } from '@ngrx/signals';
import { MarketWebSocketRepository } from './market-ws.repository';

export const MarketWsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    quoteList: computed(() => Object.values(store.quotes())),
    isConnected: computed(() => store.connectionStatus() === 'connected'),
  })),

  withMethods((store, wsRepo = inject(MarketWebSocketRepository)) => ({

    /** Start listening to WebSocket quote stream */
    connectQuoteStream: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { connectionStatus: 'connecting' })),
        switchMap(() =>
          wsRepo.quotes$().pipe(
            tapResponse({
              next: (tick) => {
                patchState(store, {
                  connectionStatus: 'connected',
                  quotes: { ...store.quotes(), [tick.symbol]: tick },
                });
              },
              error: (err) => {
                patchState(store, {
                  connectionStatus: 'error',
                  lastError: err instanceof Error ? err.message : 'WS error',
                });
              },
            })
          )
        )
      )
    ),

    /** Subscribe to specific symbols -- sends message to server */
    subscribeToSymbols(symbols: string[]): void {
      wsRepo.subscribeToQuotes(symbols);
    },

    /** Unsubscribe from specific symbols */
    unsubscribeFromSymbols(symbols: string[]): void {
      wsRepo.unsubscribeFromQuotes(symbols);
    },

    /** Subscribe to portfolio stream */
    subscribeToPortfolio(): void {
      wsRepo.subscribeToPortfolio();
    },
  })),

  withHooks({
    onInit(store) {
      store.connectQuoteStream();
      // Subscribe to default symbols after connection
      store.subscribeToSymbols(['AAPL', 'GOOGL', 'MSFT']);
    },
  })
);
```

### 9.4 How `rxMethod` + `switchMap` Manages the Stream

This is the core pattern to understand:

1. `rxMethod<void>` creates a method that internally manages an RxJS pipeline.
2. When called, it emits a `void` trigger into the pipeline.
3. `switchMap` maps that trigger to the streaming Observable (SSE or WebSocket).
4. Because `switchMap` cancels the previous inner Observable when a new trigger arrives, calling the method again automatically disconnects the old stream and connects a new one.
5. `tapResponse` routes each emitted value to `patchState` (success) or error handling.
6. When the SignalStore is destroyed, `rxMethod` unsubscribes automatically, which triggers the Observable teardown (closing EventSource or WebSocket).

This means: **the store controls the connection lifecycle with zero manual subscription management.**

### 9.5 Reading Streaming State in Components

```typescript
@Component({
  selector: 'app-market-quotes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!store.isConnected()) {
      <p>Connecting to market data...</p>
    }

    @for (quote of store.quoteList(); track quote.symbol) {
      <div class="quote-row">
        <span>{{ quote.symbol }}</span>
        <span>{{ quote.price | number:'1.2-2' }}</span>
        <span [class.positive]="quote.change >= 0"
              [class.negative]="quote.change < 0">
          {{ quote.change | number:'1.2-2' }}
          ({{ quote.changePercent | number:'1.2-2' }}%)
        </span>
      </div>
    }
  `,
})
export class MarketQuotesComponent {
  protected readonly store = inject(MarketSseStore);
}
```

The component has zero subscription logic. It reads signals. The SignalStore owns the stream.

---

## 10. Connection Lifecycle

### SSE Lifecycle

```
Page enters (ionViewDidEnter / onInit)
  --> store.connectQuoteStream()
    --> rxMethod emits trigger
      --> switchMap subscribes to fromSSE Observable
        --> EventSource opens GET /api/sse/quotes
          --> data flows into patchState

Page leaves (ionViewDidLeave / onDestroy)
  --> store destroyed (or component destroyed)
    --> rxMethod unsubscribes
      --> fromSSE teardown runs
        --> eventSource.close()
```

### WebSocket Lifecycle

```
Page enters
  --> store.connectQuoteStream()
    --> rxMethod subscribes to ws.quotes$()
  --> store.subscribeToSymbols(['AAPL'])
    --> ws.send({ type: 'subscribe', symbols: ['AAPL'] })
      --> server starts intervals for AAPL
        --> data flows into patchState

User navigates to new symbol
  --> store.unsubscribeFromSymbols(['AAPL'])
  --> store.subscribeToSymbols(['GOOGL'])
    --> server clears AAPL interval, starts GOOGL interval

Page leaves
  --> store destroyed
    --> rxMethod unsubscribes from ws.quotes$()
    --> ws.disconnect() in ngOnDestroy
      --> server onclose clears all intervals
```

### Reconnection Strategy

| Technology | Reconnection | Implementation |
|---|---|---|
| SSE | Automatic | Built into browser EventSource API. Nothing to implement. |
| WebSocket | Manual | `onclose` handler calls `setTimeout(() => this.connect(), 3000)`. The `destroy$` subject prevents reconnection after intentional disconnect. |

---

## 11. Testing and Debugging Streaming APIs

Streaming connections behave differently from REST requests. Standard REST tooling may not work the way you expect. This section covers the right tool for each scenario.

### 11.1 Tool Comparison

| Tool | SSE Support | WebSocket Support | Verdict |
|---|---|---|---|
| Browser DevTools (Network tab) | Full. Filter by "EventStream" type. Each event appears as a row in real time. | Full. Filter by "WS" type. Messages tab shows sent/received frames. | **Best for UI developers.** Use this first. |
| curl | Full. `curl -N <url>` streams events to stdout. | No. curl does not speak WebSocket. | Good for quick server verification without a browser. |
| Postman | Partial. Postman 10+ added SSE support (Server-Sent Events tab). Response streams in real time. | WebSocket supported via dedicated WebSocket Request tab. | **Workable but not ideal for SSE.** Postman's SSE view is less transparent than browser DevTools. Use it if you want to save requests in a collection. |
| websocat / wscat | No SSE support. | Full. Interactive terminal prompt for sending and receiving frames. | Best for isolated WebSocket testing without a browser. |
| HTTPie | No streaming support (waits for response to complete). | No. | Do not use for streaming. |

### 11.2 Browser DevTools: Step-by-Step (Recommended)

This is the primary tool for a UI developer testing streaming APIs.

**SSE inspection:**

1. Open Chrome/Edge DevTools, go to the Network tab.
2. Start the mock server and load the page that connects to SSE.
3. In the Network tab filter, select "EventStream" (or type `is:running` in the filter bar).
4. Click the SSE connection row. The **EventStream** sub-tab appears.
5. Each event appears as a new row with: `Event Name`, `Data`, `Time`. Events appear in real time as they arrive.
6. You can read the parsed JSON in each row without console logging.

**WebSocket inspection:**

1. Same Network tab. Filter by "WS".
2. Click the WebSocket connection row. The **Messages** sub-tab shows all frames.
3. Green arrow = sent by client. Red arrow = received from server.
4. You can see the raw JSON payloads in each direction.

**Tip:** Keep the DevTools open before the connection starts. If you open DevTools after the connection is already established, you miss the initial handshake and early events.

### 11.3 curl for SSE

Useful for testing the server independently of the Angular app.

```bash
# Full payload mode (default)
curl -N "http://localhost:3333/api/sse/quotes?symbols=AAPL,TSLA"

# Delta payload mode -- only changed fields
curl -N "http://localhost:3333/api/sse/quotes?symbols=AAPL,TSLA&mode=delta"

# Portfolio stream
curl -N http://localhost:3333/api/sse/portfolio

# Pipe through jq for pretty-printed JSON (install: brew install jq)
# Note: jq needs --unbuffered for streaming
curl -N "http://localhost:3333/api/sse/quotes?symbols=AAPL" | grep --line-buffered '^data:' | sed -u 's/^data: //' | jq --unbuffered .
```

Press Ctrl+C to disconnect.

### 11.4 Postman

Postman can test SSE and WebSocket, but with caveats.

**SSE in Postman:**

1. Create a new request. Method: GET. URL: `http://localhost:3333/api/sse/quotes?symbols=AAPL`.
2. Click Send. Postman will stream the response body as events arrive.
3. Limitation: Postman does not parse SSE event names or structure. It shows raw text. For structured inspection, browser DevTools is better.

**WebSocket in Postman:**

1. Create a new WebSocket Request (separate from HTTP). URL: `ws://localhost:3333/ws`.
2. Click Connect. Use the message input to send: `{"type":"subscribe","symbols":["AAPL"]}`.
3. Received messages appear in the Messages pane.
4. This works well. Postman's WebSocket tab is a good alternative to wscat.

### 11.5 Browser Console (Quick One-Liner)

Open any page served from the same origin (or any page if CORS is `*`), then paste:

```javascript
// SSE -- full mode
const es = new EventSource('http://localhost:3333/api/sse/quotes?symbols=AAPL,DJI');
es.addEventListener('quote', (e) => console.log(JSON.parse(e.data)));
// To stop: es.close();

// SSE -- delta mode
const esDelta = new EventSource('http://localhost:3333/api/sse/quotes?symbols=AAPL&mode=delta');
esDelta.addEventListener('quote', (e) => console.log('DELTA:', JSON.parse(e.data)));

// WebSocket
const ws = new WebSocket('ws://localhost:3333/ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', symbols: ['AAPL'] }));
```

### 11.6 websocat / wscat for WebSocket

```bash
# websocat (Rust, install via brew)
brew install websocat
websocat ws://localhost:3333/ws
# Type: {"type":"subscribe","symbols":["AAPL","GOOGL"]}

# wscat (Node.js, no install needed)
npx wscat -c ws://localhost:3333/ws
# Type: {"type":"subscribe","symbols":["AAPL"]}
```

### 11.7 Angular Integration Test

1. Start the mock server: `cd tools/mock-streaming-server && npm start`
2. Start the Angular app: `npx nx serve web-app`
3. Inject the store in a component and verify signals update in real time.
4. Open browser DevTools Network tab. Filter by "EventStream" to see SSE events flowing.
5. In Console, inspect the store: the `quotes` signal should show a `Record<string, QuoteTick>` that updates every 1-3 seconds.

---

## 12. Streaming Payload Design

This section is architectural guidance for UI developers, backend developers, and tech leads. It answers: what should the streaming API actually send per event?

### 12.1 The Core Question

When a stock price changes, should the server stream:

**(A) Full object** -- the entire ticker entity every time:

```json
{
  "symbol": "AAPL",
  "price": 198.73,
  "change": 0.23,
  "changePercent": 0.12,
  "volume": 543210,
  "bid": 198.70,
  "ask": 198.76,
  "companyName": "Apple Inc.",
  "sector": "Technology",
  "marketCap": 3040000000000,
  "timestamp": 1709078400000
}
```

**(B) Delta (partial update)** -- only the fields that changed:

```json
{
  "symbol": "AAPL",
  "price": 198.73,
  "change": 0.23,
  "changePercent": 0.12,
  "timestamp": 1709078400000
}
```

### 12.2 Recommendation: Separate Static and Streaming Data

The answer is neither pure A nor pure B in isolation. The correct architecture separates data by update frequency:

| Data Category | Source | Update Frequency | Example Fields |
|---|---|---|---|
| **Static / slow-changing** | REST endpoint (one-time fetch) | On page load, maybe refresh hourly | companyName, sector, marketCap, exchange, description, logo |
| **Streaming / fast-changing** | SSE stream | Every 1-5 seconds | price, change, changePercent, volume, bid, ask |

**Rule: The streaming API should only carry fields that change at streaming frequency.** Static details like company name, sector, or market cap do not belong in a real-time quote stream. They are fetched once via REST when the user opens a ticker detail page and stored separately in the SignalStore.

### 12.3 Full vs Delta Within the Streaming Payload

Even within the streaming-only fields, there are two sub-strategies:

**Full tick (all streaming fields every time):**

```json
{ "symbol": "AAPL", "price": 198.73, "change": 0.23, "changePercent": 0.12, "volume": 543210, "bid": 198.70, "ask": 198.76, "timestamp": 1709078400000 }
```

- Simpler on the client. Each tick is self-contained. Client just overwrites the record.
- The current mock server default (`?mode=full` or no mode param) uses this.
- Higher bandwidth per message, but for 5-20 symbols at 1-3 second intervals, this is negligible.

**Delta tick (only changed fields):**

```json
{ "symbol": "AAPL", "price": 198.73, "timestamp": 1709078400000 }
```

- Lower bandwidth per message. Critical for hundreds of symbols or sub-second tick rates.
- Requires the client to **merge** the delta into the existing entity (not overwrite).
- The mock server supports this with `?mode=delta`.

### 12.4 Decision for This App

For the investing app:

- **Watchlist / Portfolio pages**: 5-50 symbols, 1-3 second ticks. Full tick payload is fine. Simpler client code.
- **Market data firehose** (if ever needed): hundreds of symbols, sub-second. Delta payload. But that scenario is not in scope today.

**Default to full tick.** Switch to delta only when bandwidth becomes a measured problem.

The mock server supports both modes (`?mode=full` and `?mode=delta`) so you can prototype and test both patterns.

### 12.5 Backend Developer Guidance

When working with the Java Spring Boot gateway team, communicate these rules:

1. **Streaming endpoints carry only fast-changing market fields.** No company metadata, no user profile data, no static reference data. Those are separate REST endpoints.
2. **Every streaming message must include `symbol` (identifier) and `timestamp`.** These are the minimum fields for the client to know which entity to update and whether the data is fresh.
3. **Full tick is the default contract.** All streaming fields are present in every message. Client does a simple overwrite.
4. **If the team moves to delta payloads**, the contract changes: all fields except `symbol` and `timestamp` become optional. The client merges rather than overwrites. This must be an explicit, coordinated decision -- not a silent change.
5. **Do not mix static and streaming data in the same event.** If the UI needs company name alongside price, it fetches company details via REST once and joins them on the client using `symbol` as the key.

### 12.6 Mock Server Mode Parameter

The local mock server supports both payload modes via query parameter:

```bash
# Full tick (default) -- all fields present
curl -N "http://localhost:3333/api/sse/quotes?symbols=AAPL,TSLA"

# Delta tick -- symbol + timestamp always present, other fields randomly included/omitted
curl -N "http://localhost:3333/api/sse/quotes?symbols=AAPL,TSLA&mode=delta"
```

Delta mode always includes `price` (the most-watched field) plus random subsets of other fields, simulating a real sparse delta feed.

---

## 13. Partial Update Pattern in SignalStore

When the server sends delta payloads (only changed fields), the store cannot blindly overwrite the existing record -- that would erase fields not present in the delta. Instead, the store must **merge** the incoming delta into the existing entity.

### 13.1 The Problem

With full tick payloads, the store update is simple:

```typescript
// Full tick: safe to overwrite entirely
patchState(store, {
  quotes: { ...store.quotes(), [tick.symbol]: tick },
});
```

With delta payloads, this would lose data:

```typescript
// Delta = { symbol: 'AAPL', price: 199.00, timestamp: ... }
// Overwriting loses bid, ask, volume, change, changePercent from the previous tick.
patchState(store, {
  quotes: { ...store.quotes(), [delta.symbol]: delta }, // WRONG for deltas
});
```

### 13.2 The Merge Pattern

A utility function that shallow-merges the delta into the existing entity:

```typescript
/**
 * Merges a partial update (delta) into the current quote record.
 * - If the entity exists, spreads existing fields first, then overwrites with delta fields.
 * - If the entity does not exist (first tick), the delta becomes the initial state.
 * - undefined/null fields in the delta are ignored (only defined fields overwrite).
 */
function mergeQuoteDelta(
  current: Record<string, QuoteTick>,
  delta: Partial<QuoteTick> & { symbol: string }
): Record<string, QuoteTick> {
  const existing = current[delta.symbol];
  const merged = { ...existing, ...stripUndefined(delta) } as QuoteTick;
  return { ...current, [delta.symbol]: merged };
}

/** Removes keys with undefined values so they do not overwrite existing data. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}
```

### 13.3 Store Integration with Merge

```typescript
withMethods((store, repo = inject(MarketStreamRepository)) => ({

  /** Full tick mode: overwrite the entire entity */
  connectQuoteStream: rxMethod<string[]>(
    pipe(
      tap(() => patchState(store, { connectionStatus: 'connecting' })),
      switchMap((symbols) =>
        repo.quoteStream$(symbols).pipe(
          tapResponse({
            next: (tick) => {
              patchState(store, {
                connectionStatus: 'connected',
                quotes: { ...store.quotes(), [tick.symbol]: tick },
              });
            },
            error: (err) => {
              patchState(store, {
                connectionStatus: 'error',
                lastError: err instanceof Error ? err.message : 'Unknown error',
              });
            },
          })
        )
      )
    )
  ),

  /** Delta mode: merge partial update into existing entity */
  connectQuoteDeltaStream: rxMethod<string[]>(
    pipe(
      tap(() => patchState(store, { connectionStatus: 'connecting' })),
      switchMap((symbols) =>
        repo.quoteDeltaStream$(symbols).pipe(
          tapResponse({
            next: (delta) => {
              patchState(store, {
                connectionStatus: 'connected',
                quotes: mergeQuoteDelta(store.quotes(), delta),
              });
            },
            error: (err) => {
              patchState(store, {
                connectionStatus: 'error',
                lastError: err instanceof Error ? err.message : 'Unknown error',
              });
            },
          })
        )
      )
    )
  ),
}))
```

### 13.4 Repository Method for Delta Stream

```typescript
@Injectable({ providedIn: 'root' })
export class MarketStreamRepository {
  private readonly baseUrl = 'http://localhost:3333';

  /** Full tick stream -- all fields present */
  quoteStream$(symbols: string[] = []) {
    const query = symbols.length > 0 ? `?symbols=${symbols.join(',')}` : '';
    return fromSSE<QuoteTick>(`${this.baseUrl}/api/sse/quotes${query}`, 'quote');
  }

  /** Delta stream -- only changed fields */
  quoteDeltaStream$(symbols: string[] = []) {
    const symbolsParam = symbols.length > 0 ? `symbols=${symbols.join(',')}` : '';
    const query = symbolsParam ? `?${symbolsParam}&mode=delta` : '?mode=delta';
    return fromSSE<Partial<QuoteTick> & { symbol: string }>(
      `${this.baseUrl}/api/sse/quotes${query}`,
      'quote'
    );
  }

  portfolioStream$() {
    return fromSSE<PortfolioSnapshot>(`${this.baseUrl}/api/sse/portfolio`, 'portfolio');
  }
}
```

### 13.5 Computed Signals Still Work

The `computed` layer does not change regardless of full vs delta payloads. The store state shape is identical -- `Record<string, QuoteTick>`. The only difference is how the record gets updated (overwrite vs merge). Computed signals derived from the record work the same way:

```typescript
withComputed((store) => ({
  quoteList: computed(() => Object.values(store.quotes())),
  quoteBySymbol: (symbol: string) => computed(() => store.quotes()[symbol]),
  isConnected: computed(() => store.connectionStatus() === 'connected'),
}))
```

The UI component does not know or care whether the data arrived as full ticks or deltas. It reads `store.quoteList()` and Angular's signal change detection handles the rest.

### 13.6 When to Use Each Mode

| Scenario | Mode | Store Method |
|---|---|---|
| POC / local testing / simple UI | Full tick | `connectQuoteStream` |
| Bandwidth-sensitive / many symbols | Delta | `connectQuoteDeltaStream` |
| Production (initial recommendation) | Full tick | Start simple, measure, optimize later |

**Start with full tick mode.** It is simpler, debuggable, and sufficient for the current scale. Switch to delta mode only when profiling shows that payload size is a bottleneck.

---

## 14. Local Dev Network and Proxy Setup

This section covers the connectivity question: when the Angular app is served at a custom local domain (e.g. `local.mycompany.com`) using Vite's dev server and opened in an iOS Simulator, can it still reach the mock server at `localhost:3333`? What config is required?

### 14.1 How the Mock Server Gets Reached

There are two approaches. Pick one and stick with it. Do not mix them.

| Approach | Service uses | CORS required | Proxy required | Works in Simulator | Works on real device |
|---|---|---|---|---|---|
| Direct absolute URL | `http://localhost:3333/api/sse/...` | Yes (server has `*`, so yes) | No | Yes | No (localhost resolves to device) |
| Vite proxy (recommended) | `/api/sse/...` (relative) | No | Yes (vite.config.ts) | Yes | Yes (if device can reach dev server) |

### 14.2 iOS Simulator Network Behavior

The iOS Simulator runs on the Mac and shares the Mac's network stack. Inside the Simulator webview:

- `localhost` resolves to the Mac's localhost, not the simulated device.
- `http://localhost:3333` reaches the mock server running on the Mac.
- Both the direct URL approach and the proxy approach work in the Simulator.

A real physical device is different: `localhost` inside the device's network stack refers to the device itself, not the Mac. If you ever test on a real device, the direct absolute URL approach breaks. The proxy approach still works because the request goes to the Vite dev server (`local.mycompany.com`), which runs on the Mac and can reach `localhost:3333` itself.

### 14.3 Approach A: Direct Absolute URL (simpler, no proxy)

Use this when you want zero configuration and are only testing in the Simulator or browser.

In your repository services, use the mock server URL directly:

```typescript
// data-access/market-stream.repository.ts
private readonly baseUrl = 'http://localhost:3333';

// SSE
quoteStream$() {
  return fromSSE<QuoteTick>(`${this.baseUrl}/api/sse/quotes`, 'quote');
}

// WebSocket
private readonly ws = new WebSocketConnection('ws://localhost:3333/ws');
```

The mock server already sets `Access-Control-Allow-Origin: *` so cross-origin requests from `local.mycompany.com` are allowed.

No changes needed to `vite.config.ts`.

### 14.4 Approach B: Vite Proxy (recommended for realistic architecture)

Use this when you want the local setup to mirror production routing, where all API traffic flows through the same origin as the Angular app. It also avoids hardcoding `localhost:3333` in service code.

This project uses Vite (not webpack). Proxy config goes in `vite.config.ts` under the `server` key. There is no `proxy.conf.json` for Vite-based Angular projects -- that file is webpack/Angular CLI-specific.

**Update `apps/web-app/vite.config.ts`:**

```typescript
export default defineConfig({
  // ... existing plugins config ...

  server: {
    proxy: {
      // Proxy REST and SSE requests: /api -> http://localhost:3333
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        // SSE requires disabling response buffering.
        // Vite does not buffer by default, but add this if events are delayed.
        // configure: (proxy) => { proxy.on('proxyRes', ...) }
      },

      // Proxy WebSocket connections: /ws -> ws://localhost:3333
      '/ws': {
        target: 'ws://localhost:3333',
        ws: true,          // Required: enables WebSocket proxying
        changeOrigin: true,
      },
    },
  },
});
```

Then update service base URLs to use relative paths:

```typescript
// SSE service -- relative path, no host
quoteStream$() {
  return fromSSE<QuoteTick>('/api/sse/quotes', 'quote');
}

// WebSocket -- relative path resolves to same host as app
private readonly ws = new WebSocketConnection(
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
);
```

Using `location.host` for WebSocket means it always connects to the same host the Angular app is served from, whether that is `localhost:4200` or `local.mycompany.com`.

### 14.5 Custom Domain Setup (/etc/hosts)

If you map `local.mycompany.com` to `127.0.0.1` via `/etc/hosts`, the Vite dev server needs to be told to bind to that hostname or accept all interfaces.

In `vite.config.ts`:

```typescript
server: {
  host: true,     // binds to 0.0.0.0 (all interfaces), accepts requests to any local hostname
  port: 4200,
  proxy: { ... }, // as above
},
```

Or bind to a specific host:

```typescript
server: {
  host: 'local.mycompany.com',
  port: 4200,
  proxy: { ... },
},
```

The iOS Simulator resolves `local.mycompany.com` using the Mac's `/etc/hosts` file (shared network stack), so the custom domain works in the Simulator with no additional configuration.

### 14.6 SSE Through a Proxy: Buffering Caveat

SSE requires the HTTP response to stream data incrementally without buffering. Most reverse proxies (Nginx, Apache) buffer responses by default and will hold SSE events until the buffer fills, causing large delays.

Vite's dev server does not buffer by default. SSE through Vite proxy works correctly out of the box.

If you add any other proxy layer between the Simulator and the mock server (e.g., Charles Proxy for inspection), add the appropriate no-buffering configuration for that proxy. For Charles Proxy, SSE inspection works but you may need to disable streaming compression.

### 14.7 Summary Decision

For this local POC:

- **Browser only or Simulator + quickest path**: Use Approach A (direct absolute URL). Zero config. Done.
- **Want production-like routing or plan to test on real device eventually**: Use Approach B (Vite proxy). One-time config in `vite.config.ts`. Services use relative paths.

---

## 15. Choosing SSE vs WebSocket

For this app's use case -- the server pushes market data and portfolio updates; the client listens -- SSE is the primary approach. Subscribing to specific symbols is handled via the `?symbols=AAPL,TSLA,DJI` query parameter on the SSE URL, so there is no need for a bidirectional channel. `EventSource` reconnects automatically. Keep WebSocket available in the mock server for scenarios that genuinely require bidirectional messaging (e.g. an order entry flow that sends and receives).

Decision matrix for the investing app context:

| Use Case | Recommended | Reason |
|---|---|---|
| Quote feed on a detail page (PDP) | SSE | Read-only. Auto-reconnect. Simpler. |
| Portfolio value ticker | SSE | Read-only. Server pushes updates. |
| Watchlist with dynamic symbol list | WebSocket | Client needs to subscribe/unsubscribe as user adds/removes symbols. |
| Order status updates | SSE | Server pushes status changes. Client does not send data. |
| Trading/order placement | REST (not streaming) | Discrete actions, not a stream. Use `exhaustMap` in `rxMethod`. |
| Real-time chat or support | WebSocket | Bidirectional messaging. |

General rule: **if the client only listens, use SSE. If the client needs to send messages on the same connection, use WebSocket.**

---

## 16. Guardrails

- This mock server is for local development only. It has no authentication, no rate limiting, no persistence.
- Never deploy this server to any environment. It generates fake data with random walks.
- The CORS header is `*` -- acceptable only for localhost.
- `randomInterval` means tick frequency varies. This is intentional to simulate realistic market data jitter. Do not use fixed intervals.
- The `quotes` state uses `Record<string, QuoteTick>` (object spread on each tick). For high-frequency production data (hundreds of symbols, sub-second ticks), consider a more efficient immutable update strategy. For this local mock with 5 symbols and 1-3 second ticks, object spread is fine.
- Always clear intervals on disconnect. The server code does this in both SSE `req.on('close')` and WebSocket `ws.on('close')` handlers. Leaking intervals will grow memory and CPU unbounded.
- The Angular `fromSSE` utility does not complete on its own. The Observable stays open until unsubscribed. This is correct for a streaming use case -- `rxMethod` handles teardown on store destroy.
