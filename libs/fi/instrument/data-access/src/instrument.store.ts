import { computed, DestroyRef, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  ChartRange,
  DemoScenario,
  Instrument,
  InstrumentStatus,
  seriesFor,
  statistics,
} from '@fi/instrument-util/instrument';
import { InstrumentRepository } from './instrument.repository';

interface InstrumentState {
  symbol: string;
  instrument: Instrument | null;
  status: InstrumentStatus;
  range: ChartRange;
  error: string;
}
export const InstrumentStore = signalStore(
  withState<InstrumentState>({
    symbol: '',
    instrument: null,
    status: 'idle',
    range: '1M',
    error: '',
  }),
  withComputed((store) => ({
    series: computed(() => {
      const item = store.instrument();
      return item ? seriesFor(item, store.range()) : [];
    }),
    stats: computed(() => {
      const item = store.instrument();
      return item ? statistics(item) : null;
    }),
  })),
  withMethods(
    (
      store,
      repository = inject(InstrumentRepository),
      destroy = inject(DestroyRef),
    ) => {
      let active: AbortController | undefined;
      destroy.onDestroy(() => active?.abort());
      return {
        setRange(range: ChartRange) {
          patchState(store, { range });
        },
        async load(symbol: string, scenario: DemoScenario = 'ready') {
          active?.abort();
          const request = new AbortController();
          active = request;
          const normalized = symbol.toUpperCase();
          patchState(store, {
            symbol: normalized,
            instrument: null,
            status: 'loading',
            error: '',
            range: normalized === store.symbol() ? store.range() : '1M',
          });
          try {
            const instrument = await repository.load(
              normalized,
              scenario,
              request.signal,
            );
            if (active !== request || request.signal.aborted) return;
            const usable =
              instrument && statistics(instrument) ? instrument : null;
            patchState(store, {
              instrument: usable,
              status: usable ? 'ready' : 'empty',
            });
          } catch {
            if (active !== request || request.signal.aborted) return;
            patchState(store, {
              status: 'error',
              error: 'The synthetic data request failed. Try again.',
            });
          }
        },
      };
    },
  ),
);
