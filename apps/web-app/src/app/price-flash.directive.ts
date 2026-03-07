import { DestroyRef, Directive, effect, inject, input, signal } from '@angular/core';

@Directive({
  selector: '[appPriceFlash]',
  host: {
    '[class.price-flash-up]': 'isUp()',
    '[class.price-flash-down]': 'isDown()',
  },
})
export class PriceFlashDirective {
  readonly appPriceFlash = input.required<number>();

  protected readonly isUp = signal(false);
  protected readonly isDown = signal(false);

  private lastValue: number | null = null;
  private flashTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const current = this.appPriceFlash();

      if (this.lastValue === null) {
        this.lastValue = current;
        return;
      }

      if (current !== this.lastValue) {
        this.isUp.set(current > this.lastValue);
        this.isDown.set(current < this.lastValue);

        if (this.flashTimeout) {
          clearTimeout(this.flashTimeout);
        }

        this.flashTimeout = setTimeout(() => {
          this.isUp.set(false);
          this.isDown.set(false);
        }, 400);
      }

      this.lastValue = current;
    });

    this.destroyRef.onDestroy(() => {
      if (this.flashTimeout) {
        clearTimeout(this.flashTimeout);
      }
    });
  }
}
