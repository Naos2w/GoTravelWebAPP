import { Expense } from '../../../types';

export interface SplitMember {
  id: string;
  name: string;
}

export interface MemberBalance {
  id: string;
  name: string;
  paid: number;
  share: number;
  net: number;
}

export interface SplitTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

const SPLIT_META_REGEX = /\s*\[split:(\{.*\})\]\s*$/;

/**
 * Encodes optional custom payer and split participant metadata into an expense note
 * so AA split info round-trips cleanly without requiring a DB schema migration.
 */
export const encodeExpenseSplitMeta = (
  expense: Pick<Expense, 'note' | 'user_id' | 'paidBy' | 'paidByName' | 'splitWith'>
): string => {
  const cleanNote = (expense.note || '').replace(SPLIT_META_REGEX, '').trimEnd();
  const hasCustomPayer = Boolean(expense.paidBy && expense.paidBy !== expense.user_id);
  const hasCustomSplit = Boolean(expense.splitWith && expense.splitWith.length > 0);

  if (!hasCustomPayer && !hasCustomSplit) {
    return cleanNote;
  }

  const meta: { p?: string; pn?: string; s?: string[] } = {};
  if (expense.paidBy) {
    meta.p = expense.paidBy;
    if (expense.paidByName) meta.pn = expense.paidByName;
  }
  if (expense.splitWith && expense.splitWith.length > 0) {
    meta.s = Array.from(new Set(expense.splitWith));
  }

  return `${cleanNote} [split:${JSON.stringify(meta)}]`.trim();
};

/**
 * Decodes custom split metadata from a stored expense note string.
 */
export const decodeExpenseSplitMeta = (
  rawNote: string | undefined | null
): {
  note: string;
  paidBy?: string;
  paidByName?: string;
  splitWith?: string[];
} => {
  const raw = rawNote || '';
  const match = raw.match(SPLIT_META_REGEX);
  if (!match) {
    return { note: raw };
  }

  const cleanNote = raw.replace(SPLIT_META_REGEX, '').trimEnd();
  try {
    const parsed = JSON.parse(match[1]);
    return {
      note: cleanNote,
      ...(typeof parsed?.p === 'string' && parsed.p ? { paidBy: parsed.p } : {}),
      ...(typeof parsed?.pn === 'string' && parsed.pn ? { paidByName: parsed.pn } : {}),
      ...(Array.isArray(parsed?.s) && parsed.s.length > 0
        ? { splitWith: parsed.s.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0) }
        : {}),
    };
  } catch {
    return { note: raw };
  }
};

/**
 * Computes per-member totals and greedy minimum-transfer AA settlement instructions
 * (Splitwise-style debt simplification) normalized to TWD.
 */
export const calculateSplitwiseSettlement = (
  expenses: Expense[],
  members: SplitMember[]
): { balances: MemberBalance[]; transfers: SplitTransfer[] } => {
  const memberMap = new Map<string, string>();
  members.forEach((m) => {
    if (m.id) memberMap.set(m.id, m.name || m.id);
  });

  // Ensure payers referenced on expenses always appear in memberMap
  expenses.forEach((e) => {
    const payerId = e.paidBy || e.user_id;
    const payerName = e.paidByName || e.user_name;
    if (payerId && !memberMap.has(payerId)) {
      memberMap.set(payerId, payerName || payerId);
    }
    if (Array.isArray(e.splitWith)) {
      e.splitWith.forEach((id) => {
        if (id && !memberMap.has(id)) {
          memberMap.set(id, id);
        }
      });
    }
  });

  const allMemberIds = Array.from(memberMap.keys());
  if (allMemberIds.length === 0) {
    return { balances: [], transfers: [] };
  }

  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();
  allMemberIds.forEach((id) => {
    paidMap.set(id, 0);
    shareMap.set(id, 0);
  });

  expenses.forEach((e) => {
    const rate = Number(e.exchangeRate) || 1;
    const twdAmount = Number(e.amount) * rate;
    if (!Number.isFinite(twdAmount) || twdAmount <= 0) return;

    const payerId = e.paidBy || e.user_id;
    if (!payerId) return;

    paidMap.set(payerId, (paidMap.get(payerId) || 0) + twdAmount);

    const rawParticipants =
      Array.isArray(e.splitWith) && e.splitWith.length > 0
        ? Array.from(new Set(e.splitWith.filter((id) => memberMap.has(id))))
        : allMemberIds;

    const participants = rawParticipants.length > 0 ? rawParticipants : [payerId];
    const eachShare = twdAmount / participants.length;
    participants.forEach((id) => {
      shareMap.set(id, (shareMap.get(id) || 0) + eachShare);
    });
  });

  const balances: MemberBalance[] = allMemberIds.map((id) => {
    const paid = paidMap.get(id) || 0;
    const share = shareMap.get(id) || 0;
    return {
      id,
      name: memberMap.get(id) || id,
      paid: Math.round(paid),
      share: Math.round(share),
      net: paid - share,
    };
  });

  const creditors = balances
    .filter((b) => b.net > 0.5)
    .map((b) => ({ id: b.id, name: b.name, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter((b) => b.net < -0.5)
    .map((b) => ({ id: b.id, name: b.name, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: SplitTransfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const settled = Math.min(creditor.remaining, debtor.remaining);
    const roundedAmount = Math.round(settled);

    if (roundedAmount > 0) {
      transfers.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: roundedAmount,
      });
    }

    creditor.remaining -= settled;
    debtor.remaining -= settled;

    if (creditor.remaining <= 0.5) ci++;
    if (debtor.remaining <= 0.5) di++;
  }

  return {
    balances: balances.map((b) => ({ ...b, net: Math.round(b.net) })),
    transfers,
  };
};
