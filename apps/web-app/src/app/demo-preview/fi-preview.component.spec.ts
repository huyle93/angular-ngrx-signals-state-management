import { TestBed } from '@angular/core/testing';
import { FiPreviewComponent } from './fi-preview.component';

describe('FI preview harness', () => {
  it('keeps one iframe and its URL when changing web viewport sizes', () => {
    const fixture = TestBed.createComponent(FiPreviewComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const frame = root.querySelector('iframe');
    if (!frame) throw new Error('Missing preview iframe');
    const originalUrl = frame.src;
    // Assigning the SAME URL reloads a real iframe. URL equality alone cannot
    // prove continuity; observe assignments after the initial render too.
    const srcWrites = vi.spyOn(frame, 'src', 'set');
    const button = (label: string) => {
      const match = [...root.querySelectorAll('button')].find(
        (el) => el.textContent?.trim() === label,
      );
      if (!match) throw new Error(`Missing ${label}`);
      match.click();
      fixture.detectChanges();
    };
    button('Mobile web');
    const select = root.querySelector('select');
    if (!select) throw new Error('Missing width selector');
    select.value = '320';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(root.querySelector('.viewport')?.getAttribute('style')).toContain(
      '320px',
    );
    button('Desktop web');
    expect(root.querySelector('iframe')).toBe(frame);
    expect(frame.src).toBe(originalUrl);
    expect(srcWrites).not.toHaveBeenCalled();
    expect(root.querySelectorAll('iframe')).toHaveLength(1);
    button('Ionic mobile');
    expect(new URL(frame.src).port).toBe('4300');
    expect(new URL(frame.src).pathname).toBe('/fi/LUMA');
    expect(frame.title).toBe('Ionic mobile FI preview');
    expect(root.textContent).toContain('npx nx serve mobile-reference');
    const ionicUrl = frame.src;
    button('Reload preview');
    expect(frame.src).not.toBe(ionicUrl);
    expect(new URL(frame.src).origin).toBe(new URL(ionicUrl).origin);
  });
});
