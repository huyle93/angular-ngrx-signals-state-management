import { TestBed } from '@angular/core/testing';
import { InstrumentStatusComponent } from './instrument-status.component';
describe('Instrument status accessibility', () => {
  it('keeps the live node and focused region through loading and recovery', async () => {
    const fixture = TestBed.createComponent(InstrumentStatusComponent);
    fixture.componentRef.setInput('symbol', 'LUMA');
    fixture.componentRef.setInput('status', 'error');
    fixture.componentRef.setInput('error', 'Try again.');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const live = root.querySelector('[role=status]');
    const region = root.querySelector('section');
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    root.querySelector<HTMLButtonElement>('button')!.click();
    expect(document.activeElement).toBe(region);
    expect(retry).toHaveBeenCalledOnce();
    for (const state of ['loading', 'ready']) {
      fixture.componentRef.setInput('status', state);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelector('[role=status]')).toBe(live);
      expect(document.activeElement).toBe(region);
    }
    expect(live?.textContent).toContain('loaded for LUMA');
  });
});
