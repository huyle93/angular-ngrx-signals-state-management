import { TestBed } from '@angular/core/testing';
import { InstrumentStore } from './instrument.store';
import { InstrumentRepository } from './instrument.repository';

describe('Instrument state ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [InstrumentStore] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('loads deterministic data and derives the selected range', async () => {
    const store = TestBed.inject(InstrumentStore);
    const load = store.load('luma');
    expect(store.status()).toBe('loading');
    await vi.runAllTimersAsync();
    await load;
    expect(store.status()).toBe('ready');
    expect(store.instrument()?.name).toBe('Luma Orchard Labs');
    expect(store.series()).toHaveLength(30);
    store.setRange('1Y');
    expect(store.series()).toHaveLength(365);
    expect(store.stats()?.high).toBeGreaterThan(store.stats()?.low ?? 0);
  });
  it('cancels a slow previous symbol and never shows it as the new selection', async () => {
    const store = TestBed.inject(InstrumentStore);
    const old = store.load('LUMA', 'slow');
    const next = store.load('TIDE');
    expect(store.instrument()).toBeNull();
    await vi.runAllTimersAsync();
    await Promise.all([old, next]);
    expect(store.instrument()?.symbol).toBe('TIDE');
    expect(store.status()).toBe('ready');
  });
  it('rejects late results even if a future repository ignores cancellation', async () => {
    const repository = TestBed.inject(InstrumentRepository);
    const store = TestBed.inject(InstrumentStore);
    let finishOld!: (value: null) => void;
    vi.spyOn(repository, 'load').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    const old = store.load('LUMA');
    const next = store.load('TIDE');
    await vi.runAllTimersAsync();
    await next;
    finishOld(null);
    await old;
    expect(store.instrument()?.symbol).toBe('TIDE');
  });
  it('exposes empty and error explicitly, then recovers without losing the same-symbol range', async () => {
    const store = TestBed.inject(InstrumentStore);
    for (const scenario of ['ready', 'empty', 'error', 'ready'] as const) {
      const load = store.load('LUMA', scenario);
      await vi.runAllTimersAsync();
      await load;
      expect(store.status()).toBe(scenario);
      if (scenario === 'ready') store.setRange('3M');
      else expect(store.instrument()).toBeNull();
    }
    expect(store.range()).toBe('3M');
    const load = store.load('UNKNOWN');
    await vi.runAllTimersAsync();
    await load;
    expect(store.status()).toBe('empty');
    expect(store.range()).toBe('1M');
  });
  it('cancels pending work when the route-scoped owner is destroyed', async () => {
    const store = TestBed.inject(InstrumentStore);
    const load = store.load('LUMA', 'slow');
    TestBed.resetTestingModule();
    await vi.runAllTimersAsync();
    await load;
    expect(store.instrument()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
