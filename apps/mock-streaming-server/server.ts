/**
 * server.ts — Entry point
 *
 * Wires up Express, mounts API routes, attaches the WebSocket server,
 * and starts listening. All logic lives in the modules below:
 *
 *   config.ts            — port, base prices, default symbols
 *   types.ts             — QuoteTick, QuoteDelta, PortfolioSnapshot, ...
 *   utils.ts             — randomInterval, resolveSymbols, resolveMode
 *   generators/quote.ts  — generateQuoteTick, generateQuoteDelta
 *   generators/portfolio.ts — generatePortfolioSnapshot
 *   routes/health.ts     — GET /api/health
 *   routes/sse.ts        — GET /api/sse/quotes, GET /api/sse/portfolio
 *   routes/websocket.ts  — WebSocket server at /ws
 */
import express from 'express';
import { createServer } from 'http';
import { PORT } from './config.js';
import healthRouter from './routes/health.js';
import sseRouter from './routes/sse.js';
import { attachWebSocketServer } from './routes/websocket.js';


// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();

// Allow requests from the local Angular dev server (any origin in dev)
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use('/api', healthRouter);
app.use('/api/sse', sseRouter);

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const httpServer = createServer(app);
attachWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
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
