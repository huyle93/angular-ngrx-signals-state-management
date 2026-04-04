export type TradeIntent = 'buy' | 'recurring-buy' | 'sell';

export interface TradeEntryAction {
  readonly id: TradeIntent;
  readonly label: string;
  readonly disabled?: boolean;
}
