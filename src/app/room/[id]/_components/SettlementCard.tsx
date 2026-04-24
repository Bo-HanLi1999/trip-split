'use client';

import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, Check } from 'lucide-react';
import { CURRENCIES } from '@/lib/currencies';
import { computeSplitShares } from '@/lib/splits';
import type { Member, Expense } from '@/lib/types';

interface Props {
  members: Member[];
  expenses: Expense[];
  roomId: string;
  onDataChange: () => Promise<void>;
}

export function SettlementCard({ members, expenses, roomId, onDataChange }: Props) {
  const [displayCurrency, setDisplayCurrency] = useState('TWD');

  const { individualBalances, transfers } = useMemo(() => {
    const balance: Record<string, number> = {};
    members.forEach(m => { balance[m.id] = 0; });

    const filteredExpenses = expenses.filter(exp => (exp.currency || 'TWD') === displayCurrency);

    filteredExpenses.forEach(exp => {
      const splitDetails = computeSplitShares(exp);

      let actualTotal = 0;
      Object.entries(splitDetails).forEach(([id, amt]) => {
        if (balance[id] !== undefined) {
          balance[id] -= amt;
          actualTotal += amt;
        }
      });
      if (balance[exp.paid_by] !== undefined) {
        balance[exp.paid_by] += actualTotal;
      }
    });

    const individualBalances = members.map(m => ({
      id: m.id,
      name: m.name,
      net: balance[m.id] || 0,
    }));

    const currencyConfig = CURRENCIES.find(c => c.value === displayCurrency);
    const decimals = currencyConfig?.decimals ?? 0;
    const factor = Math.pow(10, decimals);

    const creditors = Object.entries(balance)
      .filter(([, val]) => val > (1 / factor) * 0.5)
      .sort((a, b) => b[1] - a[1]);
    const debtors = Object.entries(balance)
      .filter(([, val]) => val < -(1 / factor) * 0.5)
      .sort((a, b) => a[1] - b[1]);

    const transfers: { fromId: string; toId: string; from: string; to: string; amount: number }[] = [];
    const debtorsCopy = debtors.map(d => [d[0], d[1]] as [string, number]);
    const creditorsCopy = creditors.map(c => [c[0], c[1]] as [string, number]);

    let d = 0, c = 0;
    while (d < debtorsCopy.length && c < creditorsCopy.length) {
      const amount = Math.min(Math.abs(debtorsCopy[d][1]), creditorsCopy[c][1]);
      transfers.push({
        fromId: debtorsCopy[d][0],
        toId: creditorsCopy[c][0],
        from: members.find(m => m.id === debtorsCopy[d][0])?.name || '未知',
        to: members.find(m => m.id === creditorsCopy[c][0])?.name || '未知',
        amount: Math.round(amount * factor) / factor,
      });
      debtorsCopy[d][1] += amount;
      creditorsCopy[c][1] -= amount;
      if (Math.abs(debtorsCopy[d][1]) < (1 / factor) * 0.5) d++;
      if (Math.abs(creditorsCopy[c][1]) < (1 / factor) * 0.5) c++;
    }

    return { individualBalances, transfers };
  }, [members, expenses, displayCurrency]);

  const handleQuickSettle = async (fromId: string, toId: string, fromName: string, toName: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          room_id: roomId,
          description: `[轉帳] ${fromName} 給 ${toName}`,
          amount,
          currency: displayCurrency,
          paid_by: fromId,
          split_among: { [toId]: amount },
        }]);
      if (error) throw error;
      await onDataChange();
    } catch (err) {
      console.error('Error settling:', err);
      alert('結清操作失敗');
    }
  };

  return (
    <Card className="border-blue-100 shadow-md overflow-hidden bg-white">
      <div className="bg-blue-600 p-5 text-white">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold flex items-center">
            <ArrowRightLeft className="h-5 w-5 mr-2" /> 結算清單
          </h3>
          <Select value={displayCurrency} onValueChange={(val) => setDisplayCurrency(val || 'TWD')}>
            <SelectTrigger className="w-24 h-8 bg-blue-500 border-none text-white text-xs font-bold rounded-lg">
              <SelectValue placeholder="幣別" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-blue-100 text-xs opacity-90">
          僅顯示 {displayCurrency} 的花費
        </p>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-50">
          {individualBalances.map((b) => {
            const config = CURRENCIES.find(c => c.value === displayCurrency);
            const symbol = config?.symbol || '$';
            const decimals = config?.decimals ?? 0;
            const factor = Math.pow(10, decimals);

            return (
              <div key={b.id} className="flex items-center justify-between px-4 py-3.5">
                <span className="font-bold text-slate-700">{b.name}</span>
                {b.net > (1 / factor) * 0.5 ? (
                  <span className="text-emerald-600 font-extrabold text-base">應收 {symbol}{b.net.toFixed(decimals)}</span>
                ) : b.net < -(1 / factor) * 0.5 ? (
                  <span className="text-rose-500 font-extrabold text-base">應付 {symbol}{Math.abs(b.net).toFixed(decimals)}</span>
                ) : (
                  <span className="text-slate-400 font-medium">已結清</span>
                )}
              </div>
            );
          })}
        </div>

        {transfers.length > 0 && (
          <div className="bg-slate-50 p-4 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">建議轉帳順序 ({displayCurrency})</h4>
            <div className="space-y-3">
              {transfers.map((s, idx) => {
                const config = CURRENCIES.find(c => c.value === displayCurrency);
                const symbol = config?.symbol || '$';
                const decimals = config?.decimals ?? 0;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                      <span className="font-bold text-slate-800">{s.from}</span>
                      <div className="flex flex-col items-center flex-1 px-4">
                        <span className="text-[11px] font-black text-blue-600 mb-1 tracking-tighter">{symbol}{s.amount.toFixed(decimals)}</span>
                        <div className="w-full h-0.5 bg-blue-100 relative rounded-full">
                          <div className="absolute right-0 -top-0.5 border-t-2 border-l-2 border-transparent border-l-blue-400"></div>
                        </div>
                      </div>
                      <span className="font-bold text-slate-800">{s.to}</span>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="rounded-xl h-12 w-12 flex-shrink-0 bg-white hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all border-slate-200"
                      onClick={() => handleQuickSettle(s.fromId, s.toId, s.from, s.to, s.amount)}
                    >
                      <Check className="h-5 w-5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
