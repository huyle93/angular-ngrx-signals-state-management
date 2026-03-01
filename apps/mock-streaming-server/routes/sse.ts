import { Router, Request, Response } from 'express';
import { generateQuoteDelta, generateQuoteTick } from '../generators/quote.js';
import { generatePortfolioSnapshot } from '../generators/portfolio.js';
import { resolveMode, resolveSymbols, randomInterval } from '../utils.js';

const router = Router();

// ---------------------------------------------------------------------------
// Quote stream
// ---------------------------------------------------------------------------

/**
 * GET /api/sse/quotes
 *
 * Query params:
 *   ?symbols=AAPL,TSLA,DJI  — comma-separated list of tickers (default: all 5)
 *   ?mode=full|delta         — payload shape (default: full)
 *
 * Event name: 'quote'
 * Data:       QuoteTick (full) | QuoteDelta (delta)
 */
router.get('/quotes', (req: Request, res: Response) => {
  const symbols = resolveSymbols(req);
  const mode = resolveMode(req);

  console.log(`[SSE] /quotes connected  symbols=[${symbols}]  mode=${mode}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Immediate keep-alive comment so the client knows the connection is live
  res.write(':ok\n\n');

  const timer = setInterval(() => {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const payload = mode === 'delta' ? generateQuoteDelta(symbol) : generateQuoteTick(symbol);

    res.write('event: quote\n');
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, randomInterval(1000, 3000));

  req.on('close', () => {
    console.log('[SSE] /quotes disconnected');
    clearInterval(timer);
  });
});

// ---------------------------------------------------------------------------
// Portfolio stream
// ---------------------------------------------------------------------------

/**
 * GET /api/sse/portfolio
 *
 * Sends a full PortfolioSnapshot every 2-5 seconds.
 * The first snapshot is sent immediately on connection so the UI can render
 * without waiting for the first interval to fire.
 *
 * Event name: 'portfolio'
 * Data:       PortfolioSnapshot
 */
router.get('/portfolio', (req: Request, res: Response) => {
  console.log('[SSE] /portfolio connected');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(':ok\n\n');

  // Send initial snapshot immediately
  const sendSnapshot = () => {
    res.write('event: portfolio\n');
    res.write(`data: ${JSON.stringify(generatePortfolioSnapshot())}\n\n`);
  };

  sendSnapshot();
  const timer = setInterval(sendSnapshot, randomInterval(2000, 5000));

  req.on('close', () => {
    console.log('[SSE] /portfolio disconnected');
    clearInterval(timer);
  });
});

export default router;
