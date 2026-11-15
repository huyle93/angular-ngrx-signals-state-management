import { TestBed } from '@angular/core/testing';
import { DemoTheme, parseBrand } from './demo-theme';
describe('Public appearance selector', () => {
  it('accepts only registered visual configurations', () => {
    expect(parseBrand('b')).toBe('b');
    expect(parseBrand('<style>')).toBe('a');
    expect(parseBrand(null)).toBe('a');
  });
  it('projects the same semantic selector without holding instrument or trading state', () => {
    const theme = TestBed.inject(DemoTheme);
    theme.select('b');
    expect(document.documentElement.dataset['demoBrand']).toBe('b');
    theme.select('a');
    expect(document.documentElement.dataset['demoBrand']).toBe('a');
  });
});
