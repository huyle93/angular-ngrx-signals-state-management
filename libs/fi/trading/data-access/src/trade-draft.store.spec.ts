import { TradeDraftStore } from './trade-draft.store';

describe('TradeDraftStore session', () => {
  it('retains a partial amount across unavailable/recovered quotes and resets on another instrument', () => {
    const draft = new TradeDraftStore();
    draft.setContext('LUMA', 85);
    draft.updateAmount('42.');
    draft.setContext('LUMA', null);
    expect(draft.view()).toBeNull();
    draft.review();
    expect(draft.reviewed()).toBe(false);
    draft.setContext('LUMA', 90);
    expect(draft.view()?.amount).toBe('42.');
    expect(draft.value()).toBeNull();
    draft.setContext('TIDE', 12);
    expect(draft.amount()).toBe('');
  });
  it('invalidates a preview on editing or price refresh, preserving the amount', () => {
    const draft = new TradeDraftStore();
    draft.setContext('LUMA', 85);
    draft.updateAmount('170');
    draft.review();
    expect(draft.view()).toMatchObject({
      value: 170,
      shares: 2,
      reviewed: true,
    });
    draft.setContext('LUMA', null);
    draft.setContext('LUMA', 85);
    expect(draft.view()).toMatchObject({ amount: '170', reviewed: false });
    draft.review();
    draft.updateAmount('17');
    expect(draft.reviewed()).toBe(false);
    draft.review();
    draft.setContext('LUMA', 170);
    expect(draft.view()).toMatchObject({
      amount: '17',
      shares: 0.1,
      reviewed: false,
    });
  });
  it.each([null, 0, -1, NaN, Infinity])(
    'rejects unavailable or invalid price %s',
    (price) => {
      const draft = new TradeDraftStore();
      draft.setContext('LUMA', price);
      draft.updateAmount('100');
      draft.review();
      expect(draft.view()).toBeNull();
      expect(draft.reviewed()).toBe(false);
    },
  );
});
