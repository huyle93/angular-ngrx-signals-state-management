import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type DemoBrand = 'a' | 'b';
export function parseBrand(value: string | null): DemoBrand {
  return value === 'b' ? 'b' : 'a';
}

@Injectable({ providedIn: 'root' })
export class DemoTheme {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<DemoBrand>(
    parseBrand(
      new URLSearchParams(this.document.location?.search).get('brand'),
    ),
  );
  readonly brand = this.selected.asReadonly();
  constructor() {
    this.apply(this.selected());
  }
  select(value: string) {
    this.selected.set(parseBrand(value));
    this.apply(this.selected());
  }
  private apply(brand: DemoBrand) {
    this.document.documentElement.dataset['demoBrand'] = brand;
  }
}
