import { TestBed } from '@angular/core/testing';
import { OrderEntryComponent } from './order-entry.component';

describe('OrderEntryComponent controlled UI', () => {
  it('emits raw input and review intent while rendering only its supplied view', async () => {
    const fixture = TestBed.createComponent(OrderEntryComponent);
    const view = {
      symbol: 'LUMA',
      price: 85,
      amount: '',
      value: null,
      shares: 0,
      reviewed: false,
    };
    fixture.componentRef.setInput('view', view);
    fixture.detectChanges();
    const amountChange = vi.fn();
    const review = vi.fn();
    fixture.componentInstance.amountChange.subscribe(amountChange);
    fixture.componentInstance.reviewRequested.subscribe(review);
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector('input') as HTMLInputElement;
    input.value = '42.';
    input.dispatchEvent(new Event('input'));
    expect(amountChange).toHaveBeenCalledWith('42.');
    expect((root.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    fixture.componentRef.setInput('view', {
      ...view,
      amount: '170',
      value: 170,
      shares: 2,
    });
    fixture.detectChanges();
    expect(input.value).toBe('170');
    (root.querySelector('button') as HTMLButtonElement).click();
    expect(review).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('view', {
      ...view,
      amount: '170',
      value: 170,
      shares: 2,
      reviewed: true,
    });
    fixture.detectChanges();
    expect(root.querySelector('[role=status]')?.textContent).toContain(
      'No order was placed',
    );
  });
});
