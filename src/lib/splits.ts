import type { Expense } from './types';

export function computeSplitShares(exp: Expense): Record<string, number> {
  if (Array.isArray(exp.split_among)) {
    const count = exp.split_among.length;
    if (count === 0) return {};
    const perPerson = exp.amount / count;
    return Object.fromEntries(exp.split_among.map(id => [id, perPerson]));
  }
  return exp.split_among;
}
