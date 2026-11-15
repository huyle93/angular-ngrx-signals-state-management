import { Injectable } from '@angular/core';
import { DemoScenario, Instrument } from '@fi/instrument-util/instrument';

function history(seed: number) {
  return Array.from({ length: 365 }, (_, day) => ({
    date: new Date(Date.UTC(2025, 10, 1 + day)).toISOString().slice(0, 10),
    price:
      Math.round(
        (seed +
          day * 0.032 +
          Math.sin(day / 11) * 2.8 +
          Math.cos(day / 4) * 0.8) *
          100,
      ) / 100,
  }));
}

// Original fictional issuers. Fixed dates and values; no live market connection.
const instruments: readonly Instrument[] = [
  {
    symbol: 'LUMA',
    name: 'Luma Orchard Labs',
    category: 'Imaginary technology',
    description:
      'A fictional team exploring light-powered greenhouses and quieter ways to grow.',
    research:
      'This synthetic company is exploring modular greenhouse lighting. Its imaginary opportunity is efficient growing; its hypothetical risk is the cost of scaling new hardware. This is a learning example, not investment research.',
    history: history(72),
  },
  {
    symbol: 'TIDE',
    name: 'Tidepaper Works',
    category: 'Imaginary materials',
    description:
      'A fictional studio turning sea-inspired materials into everyday packaging.',
    research:
      'This synthetic company experiments with reusable packaging. Its imaginary opportunity is repeat use; its hypothetical risk is inconsistent material supply. No analyst coverage or recommendation is represented.',
    history: history(38),
  },
];

@Injectable({ providedIn: 'root' })
export class InstrumentRepository {
  load(
    symbol: string,
    scenario: DemoScenario,
    signal: AbortSignal,
  ): Promise<Instrument | null> {
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Cancelled', 'AbortError'));
      };
      const timer = setTimeout(
        () => {
          signal.removeEventListener('abort', abort);
          if (scenario === 'error')
            reject(new Error('Demo data could not be loaded.'));
          else
            resolve(
              scenario === 'empty'
                ? null
                : (instruments.find((item) => item.symbol === symbol) ?? null),
            );
        },
        scenario === 'slow' ? 2200 : 180,
      );
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  }
}
