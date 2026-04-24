'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { CURRENCIES } from '@/lib/currencies';
import type { Member } from '@/lib/types';

interface Props {
  members: Member[];
  roomId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function ExpenseForm({ members, roomId, isOpen, onOpenChange, onSuccess }: Props) {
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('TWD');
  const [payerId, setPayerId] = useState('');
  const [selectedSplitters, setSelectedSplitters] = useState<string[]>([]);
  const [isManualSplit, setIsManualSplit] = useState(false);
  const [individualAmounts, setIndividualAmounts] = useState<Record<string, string>>({});

  // Dialog 開啟時預設全選所有成員
  useEffect(() => {
    if (isOpen) {
      setSelectedSplitters(members.map(m => m.id));
      setIsManualSplit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 平分模式下自動計算各人金額
  useEffect(() => {
    if (!isManualSplit && members.length > 0) {
      const total = parseFloat(expenseAmount) || 0;
      const count = selectedSplitters.length;
      if (count > 0) {
        const currencyConfig = CURRENCIES.find(c => c.value === expenseCurrency);
        const decimals = currencyConfig?.decimals ?? 0;
        const factor = Math.pow(10, decimals);
        const perPerson = Math.ceil((total / count) * factor) / factor;
        const newAmounts: Record<string, string> = {};
        selectedSplitters.forEach(id => {
          newAmounts[id] = perPerson.toFixed(decimals);
        });
        setIndividualAmounts(newAmounts);
      } else {
        setIndividualAmounts({});
      }
    }
  }, [expenseAmount, selectedSplitters, isManualSplit, members, expenseCurrency]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || !payerId || selectedSplitters.length === 0) {
      alert('請填寫完整花費資訊');
      return;
    }

    const currencyConfig = CURRENCIES.find(c => c.value === expenseCurrency);
    const decimals = currencyConfig?.decimals ?? 0;
    const factor = Math.pow(10, decimals);
    const splitDetails: Record<string, number> = {};
    selectedSplitters.forEach(id => {
      splitDetails[id] = parseFloat(individualAmounts[id]) || 0;
    });

    if (isManualSplit) {
      const totalAmount = Math.round(parseFloat(expenseAmount) * factor);
      const splitSum = Math.round(Object.values(splitDetails).reduce((acc, v) => acc + v, 0) * factor);
      if (splitSum !== totalAmount) {
        const diff = (totalAmount - splitSum) / factor;
        const sign = diff > 0 ? '+' : '';
        alert(`分攤金額加總（${splitSum / factor}）與花費金額（${totalAmount / factor}）不符，差額 ${sign}${diff.toFixed(decimals)}，請調整後再送出。`);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          room_id: roomId,
          description: expenseDesc,
          amount: parseFloat(expenseAmount),
          currency: expenseCurrency,
          paid_by: payerId,
          split_among: splitDetails,
        }]);
      if (error) throw error;
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseCurrency('TWD');
      setPayerId('');
      setSelectedSplitters([]);
      setIndividualAmounts({});
      setIsManualSplit(false);
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('新增花費時發生錯誤');
    }
  };

  const currencySymbol = CURRENCIES.find(c => c.value === expenseCurrency)?.symbol ?? '$';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" className="rounded-full h-9 px-4 shadow-sm">
        <Plus className="h-4 w-4 mr-1" /> 新增花費
      </Button>} />
      <DialogContent className="max-w-[90vw] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">新增花費</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddExpense} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-slate-600 ml-1">花費說明</Label>
            <Input placeholder="例如：晚餐、租車..." value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="h-12 bg-slate-50 border-none rounded-xl" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label className="text-slate-600 ml-1">金額</Label>
              <Input type="number" placeholder="0" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-12 bg-slate-50 border-none rounded-xl text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 ml-1">幣別</Label>
              <Select value={expenseCurrency} onValueChange={(val) => setExpenseCurrency(val || 'TWD')}>
                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold">
                  <SelectValue placeholder="幣別" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600 ml-1">誰付的錢？</Label>
            <Select onValueChange={(val) => setPayerId(val || '')} value={payerId}>
              <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl">
                <SelectValue placeholder="選擇付款人">
                  {members.find(m => m.id === payerId)?.name || '選擇付款人'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <Label className="text-slate-600">分攤成員</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsManualSplit(!isManualSplit)}
                  className={`text-xs h-7 px-2 rounded-lg transition-colors ${isManualSplit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  {isManualSplit ? '手動模式' : '平分模式'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSplitters(members.map(m => m.id))}
                  className="text-xs h-7 px-2 text-blue-600 hover:bg-blue-50"
                >
                  全選
                </Button>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto p-1 pr-2">
              {members.map(m => {
                const isSelected = selectedSplitters.includes(m.id);
                return (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
                    <Checkbox
                      id={`m-${m.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSplitters([...selectedSplitters, m.id]);
                        } else {
                          setSelectedSplitters(selectedSplitters.filter(id => id !== m.id));
                        }
                      }}
                    />
                    <Label htmlFor={`m-${m.id}`} className="flex-1 font-bold text-slate-700 cursor-pointer truncate">{m.name}</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-xs">{currencySymbol}</span>
                      <Input
                        type="number"
                        value={individualAmounts[m.id] || ''}
                        onChange={(e) => {
                          setIsManualSplit(true);
                          setIndividualAmounts(prev => ({ ...prev, [m.id]: e.target.value }));
                        }}
                        disabled={!isSelected}
                        className="w-24 h-9 text-right font-mono text-sm bg-white border-slate-200 rounded-lg focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full h-12 text-lg font-bold rounded-2xl shadow-lg shadow-blue-200">送出紀錄</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
