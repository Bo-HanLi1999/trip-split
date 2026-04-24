export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  split_among: string[] | Record<string, number>;
  created_at: string;
}
