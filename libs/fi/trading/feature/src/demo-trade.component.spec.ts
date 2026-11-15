import { TestBed } from '@angular/core/testing';
import { DemoTradeComponent } from './demo-trade.component';

describe('Mobile demo draft interaction', () => {
  it('keeps the panel open while typing, retains draft after closing, and resets on symbol change', async () => {
    const fixture = TestBed.createComponent(DemoTradeComponent);
    fixture.componentRef.setInput('symbol', 'LUMA');
    fixture.componentRef.setInput('price', 85);
    fixture.componentRef.setInput('disclosure', true);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const panel = root.querySelector<HTMLElement>('#trade-panel')!;
    const invest = root.querySelector<HTMLButtonElement>('.invest')!;
    const amount = root.querySelector<HTMLInputElement>('#trade-amount')!;
    invest.click();
    fixture.detectChanges();
    await fixture.whenStable();
    amount.value = '42.';
    amount.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panel.hidden).toBe(false);
    root.querySelector<HTMLButtonElement>('.close')!.click();
    fixture.detectChanges();
    expect(panel.hidden).toBe(true);
    invest.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(amount.value).toBe('42.');
    fixture.componentRef.setInput('symbol', 'TIDE');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panel.hidden).toBe(true);
    expect(amount.value).toBe('');
  });
});
