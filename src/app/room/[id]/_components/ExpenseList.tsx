'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Receipt, Trash2 } from 'lucide-react';
import { CURRENCIES } from '@/lib/currencies';
import { computeSplitShares } from '@/lib/splits';
import type { Member, Expense } from '@/lib/types';

interface Props {
  expenses: Expense[];
  members: Member[];
  roomId: string;
  onDataChange: () => Promise<void>;
}

export function ExpenseList({ expenses, members, onDataChange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('確定要刪除這筆花費嗎？')) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await onDataChange();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('刪除失敗');
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-100">
        <Receipt className="h-12 w-12 text-slate-100 mx-auto mb-3" />
        <p className="text-slate-400 font-medium">尚無任何花費紀錄</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map(exp => {
        const currencyConfig = CURRENCIES.find(c => c.value === exp.currency);
        const symbol = currencyConfig?.symbol || '$';
        const decimals = currencyConfig?.decimals ?? 0;
        const formattedAmount = exp.amount.toFixed(decimals);
        const payerName = members.find(m => m.id === exp.paid_by)?.name ?? '未知';
        const isExpanded = expandedIds.has(exp.id);
        const shares = computeSplitShares(exp);
        const payerIsSplitter = Object.prototype.hasOwnProperty.call(shares, exp.paid_by);
        const orderedShareIds = members
          .map(m => m.id)
          .filter(id => Object.prototype.hasOwnProperty.call(shares, id));

        return (
          <Card key={exp.id} className="border-none shadow-sm overflow-hidden group">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={() => toggleExpanded(exp.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpanded(exp.id);
                }
              }}
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800">{exp.description}</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {payerName} 付了 {symbol}{formattedAmount}
                </p>
                {!isExpanded && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                    分攤: {Array.isArray(exp.split_among)
                      ? exp.split_among.map(id => members.find(m => m.id === id)?.name).join(', ')
                      : Object.keys(exp.split_among).map(id => members.find(m => m.id === id)?.name).join(', ')
                    }
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-lg font-black text-slate-900">{symbol}{formattedAmount}</div>
                <div className="text-[10px] font-bold text-slate-300 group-hover:text-slate-400">{exp.currency}</div>
                {isExpanded
                  ? <ChevronUp className="h-4 w-4 text-slate-400" />
                  : <ChevronDown className="h-4 w-4 text-slate-400" />
                }
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-full h-9 w-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteExpense(exp.id);
                  }}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                <div className="text-xs font-semibold text-slate-600 pb-2 mb-2 border-b border-slate-100">
                  付款人：{payerName} {payerIsSplitter ? '付了' : '墊了'} {symbol}{formattedAmount}
                </div>
                {orderedShareIds.length === 0 ? (
                  <div className="text-xs text-slate-400">無分攤紀錄</div>
                ) : (
                  <div className="space-y-1.5">
                    {orderedShareIds.map(id => (
                      <div key={id} className="flex justify-between text-xs text-slate-700">
                        <span>{members.find(m => m.id === id)?.name ?? '未知'}</span>
                        <span className="font-mono">{symbol}{shares[id].toFixed(decimals)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
