import { TestBed } from '@angular/core/testing';
import { DemoTradeComponent } from './demo-trade.component';

describe('Desktop trading session host', () => {
  it('survives a missing quote and resets only when the symbol changes', async () => {
    const fixture = TestBed.createComponent(DemoTradeComponent);
    fixture.componentRef.setInput('symbol', 'LUMA');
    fixture.componentRef.setInput('price', 85);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = '42.';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.componentRef.setInput('price', null);
    fixture.detectChanges();
    expect(root.querySelector('input')).toBeNull();
    fixture.componentRef.setInput('price', 85);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('42.');
    fixture.componentRef.setInput('symbol', 'TIDE');
    fixture.detectChanges();
    await fixture.whenStable();
    expect((root.querySelector('input') as HTMLInputElement).value).toBe('');
  });
});
