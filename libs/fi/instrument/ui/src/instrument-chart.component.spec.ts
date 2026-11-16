import { TestBed } from '@angular/core/testing';
import { InstrumentChartComponent } from './instrument-chart.component';
describe('Portable chart', () => {
  it('renders a flat series without invalid SVG coordinates and exposes the same values to readers', async () => {
    const fixture = TestBed.createComponent(InstrumentChartComponent);
    fixture.componentRef.setInput('range', '1M');
    fixture.componentRef.setInput('series', [
      { date: '2026-10-30', price: 12 },
      { date: '2026-10-31', price: 12 },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('polyline')?.getAttribute('points')).not.toMatch(
      /NaN|Infinity/,
    );
    expect(root.querySelector('svg')?.getAttribute('aria-label')).toContain(
      '12.00 USD',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    const emit = vi.fn();
    fixture.componentInstance.rangeChange.subscribe(emit);
    (root.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledWith('3M');
  });
});
