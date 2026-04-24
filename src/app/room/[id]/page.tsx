'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, UserPlus, Receipt, ArrowRightLeft, Loader2, Copy, Trash2, Check, X } from 'lucide-react';

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  split_among: string[] | Record<string, number>;
  created_at: string;
}

const CURRENCIES = [
  { value: 'TWD', label: 'TWD (台幣)', symbol: '$', decimals: 0 },
  { value: 'JPY', label: 'JPY (日幣)', symbol: '¥', decimals: 0 },
  { value: 'USD', label: 'USD (美金)', symbol: '$', decimals: 2 },
  { value: 'EUR', label: 'EUR (歐元)', symbol: '€', decimals: 2 },
];

// 以 TWD 為基準的匯率 (1 外幣 = ? TWD)
// 實際應用可考慮串接即時 API，這裡先使用常數
const EXCHANGE_RATES: Record<string, number> = {
  TWD: 1,
  JPY: 0.21,  // 1 JPY = 0.21 TWD
  USD: 32.5,  // 1 USD = 32.5 TWD
  EUR: 35.2,  // 1 EUR = 35.2 TWD
};

export default function RoomPage() {
  const { id: roomId } = useParams() as { id: string };
  const [roomName, setRoomName] = useState('載入中...');
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState('');
  
  // Currency State
  const [displayCurrency, setDisplayCurrency] = useState('TWD');
  const [expenseCurrency, setExpenseCurrency] = useState('TWD');
  
  // New Expense Form State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [selectedSplitters, setSelectedSplitters] = useState<string[]>([]);
  const [isManualSplit, setIsManualSplit] = useState(false);
  const [individualAmounts, setIndividualAmounts] = useState<Record<string, string>>({});
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // 當總金額、成員選擇、模式或幣別改變時，自動更新各成員金額
  useEffect(() => {
    if (!isManualSplit && members.length > 0) {
      const total = parseFloat(expenseAmount) || 0;
      const count = selectedSplitters.length;
      if (count > 0) {
        // 根據幣別決定精度
        const currencyConfig = CURRENCIES.find(c => c.value === expenseCurrency);
        const decimals = currencyConfig?.decimals ?? 0;
        const factor = Math.pow(10, decimals);
        
        // 使用 Math.ceil 確保總額不低於原價 (如 user 所述：100/3 = 34 或 33.34)
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

  // 當打開新增花費視窗時，自動預設全選所有成員
  useEffect(() => {
    if (isAddingExpense && members.length > 0) {
      setSelectedSplitters(members.map(m => m.id));
      setIsManualSplit(false);
    }
  }, [isAddingExpense, members]);

  const fetchData = useCallback(async () => {
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      setRoomName(roomData.name);

      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (membersError) throw membersError;
      setMembers(membersData || []);

      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });
      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchData();

    const membersChannel = supabase
      .channel('members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` }, () => fetchData())
      .subscribe();

    const expensesChannel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `room_id=eq.${roomId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, [roomId, fetchData]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setJoining(true);
    try {
      const { error } = await supabase
        .from('members')
        .insert([{ room_id: roomId, name: newName }]);
      if (error) throw error;
      setNewName('');
      await fetchData();
    } catch (err) {
      console.error('Error joining:', err);
      alert('加入成員時發生錯誤');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    // 檢查該成員是否有相關花費紀錄
    const hasExpense = expenses.some(exp => {
      const isPayer = exp.paid_by === memberId;
      let isSplitter = false;
      
      if (Array.isArray(exp.split_among)) {
        isSplitter = exp.split_among.includes(memberId);
      } else {
        isSplitter = Object.keys(exp.split_among).includes(memberId);
      }
      
      return isPayer || isSplitter;
    });

    if (hasExpense) {
      alert(`無法刪除 ${memberName}，因為他已有相關的花費紀錄。請先刪除他的紀錄再嘗試。`);
      return;
    }

    if (!confirm(`確定要將 ${memberName} 從房間中移除嗎？`)) return;

    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('刪除成員失敗');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || !payerId || selectedSplitters.length === 0) {
      alert('請填寫完整花費資訊');
      return;
    }

    const currencyConfig = CURRENCIES.find(c => c.value === expenseCurrency);
    const decimals = currencyConfig?.decimals ?? 0;
    const factor = Math.pow(10, decimals);
    const totalAmount = Math.round(parseFloat(expenseAmount) * factor);
    const splitDetails: Record<string, number> = {};
    selectedSplitters.forEach(id => {
      splitDetails[id] = parseFloat(individualAmounts[id]) || 0;
    });
    const splitSum = Math.round(Object.values(splitDetails).reduce((acc, v) => acc + v, 0) * factor);
    if (splitSum !== totalAmount) {
      const diff = (totalAmount - splitSum) / factor;
      const sign = diff > 0 ? '+' : '';
      alert(`分攤金額加總（${splitSum / factor}）與花費金額（${totalAmount / factor}）不符，差額 ${sign}${diff.toFixed(decimals)}，請調整後再送出。`);
      return;
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
          split_among: splitDetails
        }]);
      if (error) throw error;
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseCurrency('TWD');
      setPayerId('');
      setSelectedSplitters([]);
      setIndividualAmounts({});
      setIsManualSplit(false);
      setIsAddingExpense(false);
      await fetchData();
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('新增花費時發生錯誤');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('確定要刪除這筆花費嗎？')) return;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('刪除失敗');
    }
  };

  const handleQuickSettle = async (fromId: string, toId: string, fromName: string, toName: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          room_id: roomId,
          description: `[轉帳] ${fromName} 給 ${toName}`,
          amount: amount,
          currency: displayCurrency,
          paid_by: fromId,
          split_among: { [toId]: amount }
        }]);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error settling:', err);
      alert('結清操作失敗');
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('已複製網址，分享給朋友吧！');
  };

  const { individualBalances, transfers } = useMemo(() => {
    const balance: Record<string, number> = {};
    members.forEach(m => balance[m.id] = 0);

    // 僅過濾出與目前「顯示幣別」相同的花費
    const filteredExpenses = expenses.filter(exp => (exp.currency || 'TWD') === displayCurrency);

    filteredExpenses.forEach(exp => {
      let splitDetails: Record<string, number> = {};
      
      if (Array.isArray(exp.split_among)) {
        // 舊格式：平均分配
        const count = exp.split_among.length;
        if (count > 0) {
          const perPerson = exp.amount / count;
          exp.split_among.forEach(id => {
            splitDetails[id] = perPerson;
          });
        }
      } else {
        // 新格式：指定金額
        splitDetails = exp.split_among as Record<string, number>;
      }

      let actualTotal = 0;
      Object.entries(splitDetails).forEach(([id, amt]) => {
        if (balance[id] !== undefined) {
          balance[id] -= amt;
          actualTotal += amt;
        }
      });
      // 付款人增加對應金額
      if (balance[exp.paid_by] !== undefined) {
        balance[exp.paid_by] += actualTotal;
      }
    });

    const individualBalances = members.map(m => {
      return {
        id: m.id,
        name: m.name,
        net: balance[m.id] || 0
      };
    });

    // 計算轉帳路徑 (僅針對當前幣別)
    const currencyConfig = CURRENCIES.find(c => c.value === displayCurrency);
    const decimals = currencyConfig?.decimals ?? 0;
    const factor = Math.pow(10, decimals);

    const creditors = Object.entries(balance)
      .filter(([_, val]) => val > (1 / factor) * 0.5) // 根據幣別精度調整閾值
      .sort((a, b) => b[1] - a[1]);
    const debtors = Object.entries(balance)
      .filter(([_, val]) => val < -(1 / factor) * 0.5)
      .sort((a, b) => a[1] - b[1]);

    const transfers: { fromId: string, toId: string, from: string, to: string, amount: number }[] = [];
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
        amount: Math.round(amount * factor) / factor
      });

      debtorsCopy[d][1] += amount;
      creditorsCopy[c][1] -= amount;

      if (Math.abs(debtorsCopy[d][1]) < (1 / factor) * 0.5) d++;
      if (Math.abs(creditorsCopy[c][1]) < (1 / factor) * 0.5) c++;
    }

    return { individualBalances, transfers };
  }, [members, expenses, displayCurrency]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">載入資料中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold truncate pr-4">{roomName}</h1>
        <Button variant="outline" size="sm" onClick={copyUrl} className="flex-shrink-0">
          <Copy className="h-4 w-4 mr-1" /> 分享
        </Button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center text-slate-700">
              <UserPlus className="h-5 w-5 mr-2" /> 成員
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <div key={m.id} className="bg-white pl-3 pr-1 py-1 rounded-full text-sm font-semibold border border-slate-200 shadow-sm flex items-center gap-1">
                  <span>{m.name}</span>
                  <button 
                    onClick={() => handleDeleteMember(m.id, m.name)}
                    className="p-1 hover:text-rose-500 text-slate-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {members.length === 0 && <p className="text-slate-400 text-sm">尚未有成員加入</p>}
            </div>
            <form onSubmit={handleJoin} className="flex gap-2">
              <Input 
                placeholder="輸入你的暱稱..." 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={joining}
                className="bg-white h-10"
              />
              <Button type="submit" disabled={joining || !newName.trim()} className="h-10 px-6">
                加入
              </Button>
            </form>
          </CardContent>
        </Card>

        {individualBalances.length > 0 && (expenses.length > 0) && (
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
                依據設定匯率換算為 {displayCurrency}
              </p>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {individualBalances.map((b, idx) => {
                  const config = CURRENCIES.find(c => c.value === displayCurrency);
                  const symbol = config?.symbol || '$';
                  const decimals = config?.decimals ?? 0;
                  const factor = Math.pow(10, decimals);
                  
                  return (
                    <div key={idx} className="flex items-center justify-between px-4 py-3.5">
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
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center text-slate-800">
              <Receipt className="h-5 w-5 mr-2" /> 花費紀錄
            </h2>
            <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
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
                          {members.find(m => m.id === payerId)?.name || "選擇付款人"}
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
                              <span className="text-slate-400 text-xs">$</span>
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
          </div>

          <div className="space-y-3">
            {expenses.map(exp => {
              const symbol = CURRENCIES.find(c => c.value === exp.currency)?.symbol || '$';
              return (
                <Card key={exp.id} className="border-none shadow-sm overflow-hidden group">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">{exp.description}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {members.find(m => m.id === exp.paid_by)?.name} 付了 {symbol}{exp.amount}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                        分攤: {Array.isArray(exp.split_among) 
                          ? exp.split_among.map(id => members.find(m => m.id === id)?.name).join(', ')
                          : Object.keys(exp.split_among).map(id => members.find(m => m.id === id)?.name).join(', ')
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="text-lg font-black text-slate-900">{symbol}{exp.amount}</div>
                      <div className="text-[10px] font-bold text-slate-300 group-hover:text-slate-400">{exp.currency}</div>
                      <Button 
                        variant="ghost" 
                        size="icon-sm" 
                        className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-full h-9 w-9"
                        onClick={() => handleDeleteExpense(exp.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {expenses.length === 0 && (
              <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <Receipt className="h-12 w-12 text-slate-100 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">尚無任何花費紀錄</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
