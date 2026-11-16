import { validAmount } from './order-entry';
describe('Order amount contract', () => {
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
});
