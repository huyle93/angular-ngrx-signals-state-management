import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { OrderEntryView } from '@fi/trading-util/order-entry';

@Component({
  selector: 'app-order-entry',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-entry.component.html',
  styleUrl: './order-entry.component.scss',
})
export class OrderEntryComponent {
  readonly view = input.required<OrderEntryView>();
  readonly amountChange = output<string>();
  readonly reviewRequested = output<void>();
  private readonly amount =
    viewChild.required<ElementRef<HTMLInputElement>>('amount');
  focusAmount() {
    this.amount().nativeElement.focus();
  }
  protected inputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
}
