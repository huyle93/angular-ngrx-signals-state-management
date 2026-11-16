import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { InstrumentRepository } from '@fi/instrument-data-access/instrument.repository';
import { InstrumentStore } from '@fi/instrument-data-access/instrument.store';
import { FiMobilePage } from './fi-mobile.page';
import { provideIonicAngular } from '@ionic/angular/standalone';

describe('FiMobilePage route contract', () => {
  it('loads each changed symbol once, ignores query-only changes, and retries the current symbol', async () => {
    const load = vi.fn<InstrumentRepository['load']>().mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'fi/:symbol', component: FiMobilePage }]),
        { provide: InstrumentRepository, useValue: { load } },
        provideIonicAngular({ animated: false }),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/fi/LUMA', FiMobilePage);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(load).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/fi/LUMA?brand=b', FiMobilePage);
    await harness.fixture.whenStable();
    expect(load).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/fi/TIDE', FiMobilePage);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.lastCall?.[0]).toBe('TIDE');
    const button = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      'app-instrument-status button',
    )!;
    expect(button.textContent).toContain('Try again');
    button.focus();
    button.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(load).toHaveBeenCalledTimes(3);
    expect(load.mock.lastCall?.[0]).toBe('TIDE');
    expect(load.mock.lastCall?.[1]).toBe('ready');
    expect(
      harness.routeDebugElement!.injector.get(InstrumentStore).status(),
    ).toBe('empty');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Instrument status',
    );
  });
});
