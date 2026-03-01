import { Request } from 'express';
import { DEFAULT_SYMBOLS } from './config.js';

// ---------------------------------------------------------------------------
// General utilities
// ---------------------------------------------------------------------------

/** Returns a random integer in [min, max). */
export function randomInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

// ---------------------------------------------------------------------------
// SSE query-param helpers
// ---------------------------------------------------------------------------

/**
 * Parses ?symbols=AAPL,TSLA,DJI from the request query string.
 *
 * Rules:
 * - Missing/empty param → DEFAULT_SYMBOLS.
 * - Normalised to uppercase.
 * - Duplicates removed.
 * - Unknown tickers (DJI, BTC, SPX) are accepted and lazily seeded by the
 *   quote generator when it produces the first tick for that symbol.
 */
export function resolveSymbols(req: Request): string[] {
  const raw = req.query['symbols'];
  if (!raw || typeof raw !== 'string') {
    return [...DEFAULT_SYMBOLS];
  }
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
}

/**
 * Parses ?mode=delta|full from the request query string.
 *
 * - 'delta': server emits QuoteDelta (only changed fields, client must merge).
 * - 'full' (default): server emits complete QuoteTick (client can overwrite).
 */
export function resolveMode(req: Request): 'full' | 'delta' {
  return req.query['mode'] === 'delta' ? 'delta' : 'full';
}
