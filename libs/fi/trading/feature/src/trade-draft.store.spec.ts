import { TestBed } from '@angular/core/testing';
import { TradeDraftStore, validAmount } from './trade-draft.store';
describe('Local trade draft', () => {
  it.each([
    '',
    '0',
    '-2',
    '1.',
    '1.001',
    '1e3',
    'Infinity',
    '1000001',
    '1,000',
  ])('rejects incomplete or unsupported amount %s', (value) => {
    expect(validAmount(value)).toBeNull();
  });
  it.each(['1', '25.50', '1000000'])('accepts bounded decimal %s', (value) => {
    expect(validAmount(value)).toBe(Number(value));
  });
  it('keeps a partial draft for the same symbol and resets it for another', () => {
    TestBed.configureTestingModule({ providers: [TradeDraftStore] });
    const draft = TestBed.inject(TradeDraftStore);
    draft.selectSymbol('LUMA');
    draft.updateAmount('24.');
    draft.selectSymbol('LUMA');
    expect(draft.amount()).toBe('24.');
    draft.review();
    expect(draft.reviewed()).toBe(false);
    draft.updateAmount('24.50');
    draft.review();
    expect(draft.reviewed()).toBe(true);
    draft.selectSymbol('TIDE');
    expect(draft.amount()).toBe('');
    expect(draft.reviewed()).toBe(false);
  });
});
