import { describe, it, expect } from 'vitest';
import {
  calculateSplitwiseSettlement,
  encodeExpenseSplitMeta,
  decodeExpenseSplitMeta,
} from '../../services/splitwiseService';
import { Currency, Expense } from '../../types';

const makeExp = (overrides: Partial<Expense>): Expense => ({
  id: 'exp-1',
  user_id: 'alice',
  user_name: 'Alice',
  amount: 300,
  currency: Currency.TWD,
  category: 'Food',
  date: '2026-10-01',
  note: 'Dinner',
  exchangeRate: 1,
  ...overrides,
});

describe('splitwiseService', () => {
  it('calculates minimum-transfer settlement across 3 members with unequal payments and subset splits', () => {
    const members = [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'charlie', name: 'Charlie' },
    ];
    const expenses: Expense[] = [
      // Alice pays 900 TWD split equally among all 3 (300 each)
      makeExp({ id: 'e1', amount: 900, paidBy: 'alice', paidByName: 'Alice', splitWith: ['alice', 'bob', 'charlie'] }),
      // Bob pays 600 TWD split between Bob and Charlie (300 each)
      makeExp({ id: 'e2', amount: 600, user_id: 'alice', paidBy: 'bob', paidByName: 'Bob', splitWith: ['bob', 'charlie'] }),
    ];

    // Expected:
    // Alice: paid 900, share 300 -> net +600
    // Bob: paid 600, share 600 -> net 0
    // Charlie: paid 0, share 600 -> net -600
    // Single transfer: Charlie -> Alice: 600
    const { balances, transfers } = calculateSplitwiseSettlement(expenses, members);

    expect(balances.find((b) => b.id === 'alice')?.net).toBe(600);
    expect(balances.find((b) => b.id === 'bob')?.net).toBe(0);
    expect(balances.find((b) => b.id === 'charlie')?.net).toBe(-600);
    expect(transfers).toEqual([
      { fromId: 'charlie', fromName: 'Charlie', toId: 'alice', toName: 'Alice', amount: 600 },
    ]);
  });

  it('converts foreign currency amounts using exchangeRate before settling', () => {
    const members = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ];
    const expenses: Expense[] = [
      makeExp({
        id: 'e1',
        amount: 2000,
        currency: Currency.JPY,
        exchangeRate: 0.21, // 420 TWD total -> 210 each
        paidBy: 'u1',
        splitWith: ['u1', 'u2'],
      }),
    ];

    const { transfers } = calculateSplitwiseSettlement(expenses, members);
    expect(transfers).toEqual([
      { fromId: 'u2', fromName: 'Bob', toId: 'u1', toName: 'Alice', amount: 210 },
    ]);
  });

  it('encodes and decodes custom split metadata cleanly and leaves default expenses untouched', () => {
    const plain = makeExp({ note: 'Metro Pass', user_id: 'alice' });
    expect(encodeExpenseSplitMeta(plain)).toBe('Metro Pass');
    expect(decodeExpenseSplitMeta('Metro Pass')).toEqual({ note: 'Metro Pass' });

    const custom = makeExp({
      note: 'Hotel Deposit',
      user_id: 'alice',
      paidBy: 'bob',
      paidByName: 'Bob',
      splitWith: ['alice', 'bob'],
    });
    const encoded = encodeExpenseSplitMeta(custom);
    expect(encoded).toContain('Hotel Deposit [split:');
    expect(decodeExpenseSplitMeta(encoded)).toEqual({
      note: 'Hotel Deposit',
      paidBy: 'bob',
      paidByName: 'Bob',
      splitWith: ['alice', 'bob'],
    });
  });
});
