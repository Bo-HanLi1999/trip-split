'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, UserPlus, Receipt, ArrowRightLeft, Loader2, Copy } from 'lucide-react';

interface Member {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_among: string[];
  created_at: string;
}

export default function RoomPage() {
  const { id: roomId } = useParams() as { id: string };
  const [roomName, setRoomName] = useState('載入中...');
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState('');
  
  // New Expense Form State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [selectedSplitters, setSelectedSplitters] = useState<string[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', roomId)
        .single();
      if (roomError) throw roomError;
      setRoomName(roomData.name);

      // Fetch Members
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch Expenses
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

    // Set up real-time subscriptions
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
      fetchData();
    } catch (err) {
      console.error('Error joining:', err);
      alert('加入成員時發生錯誤');
    } finally {
      setJoining(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || !payerId || selectedSplitters.length === 0) {
      alert('請填寫完整花費資訊');
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          room_id: roomId,
          description: expenseDesc,
          amount: parseFloat(expenseAmount),
          paid_by: payerId,
          split_among: selectedSplitters
        }]);
      if (error) throw error;
      setExpenseDesc('');
      setExpenseAmount('');
      setPayerId('');
      setSelectedSplitters([]);
      setIsAddingExpense(false);
      fetchData();
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('新增花費時發生錯誤');
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('已複製網址，分享給朋友吧！');
  };

  // Algorithm: Calculate Settlements
  const settlements = useMemo(() => {
    const balance: Record<string, number> = {};
    members.forEach(m => balance[m.id] = 0);

    expenses.forEach(exp => {
      const perPerson = exp.amount / exp.split_among.length;
      balance[exp.paid_by] += exp.amount;
      exp.split_among.forEach(mId => {
        balance[mId] -= perPerson;
      });
    });

    const creditors = Object.entries(balance)
      .filter(([_, val]) => val > 0.01)
      .sort((a, b) => b[1] - a[1]);
    const debtors = Object.entries(balance)
      .filter(([_, val]) => val < -0.01)
      .sort((a, b) => a[1] - b[1]);

    const result: { from: string, to: string, amount: number }[] = [];
    const debtorsCopy = [...debtors];
    const creditorsCopy = [...creditors];

    let d = 0, c = 0;
    while (d < debtorsCopy.length && c < creditorsCopy.length) {
      const amount = Math.min(Math.abs(debtorsCopy[d][1]), creditorsCopy[c][1]);
      result.push({
        from: members.find(m => m.id === debtorsCopy[d][0])?.name || '未知',
        to: members.find(m => m.id === creditorsCopy[c][0])?.name || '未知',
        amount: Math.round(amount * 100) / 100
      });

      debtorsCopy[d][1] += amount;
      creditorsCopy[c][1] -= amount;

      if (Math.abs(debtorsCopy[d][1]) < 0.01) d++;
      if (Math.abs(creditorsCopy[c][1]) < 0.01) c++;
    }

    return result;
  }, [members, expenses]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">載入資料中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold truncate pr-4">{roomName}</h1>
        <Button variant="outline" size="sm" onClick={copyUrl} className="flex-shrink-0">
          <Copy className="h-4 w-4 mr-1" /> 分享網址
        </Button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Members Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <UserPlus className="h-5 w-5 mr-2" /> 成員
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <div key={m.id} className="bg-slate-100 px-3 py-1 rounded-full text-sm font-medium border border-slate-200">
                  {m.name}
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
              />
              <Button type="submit" disabled={joining || !newName.trim()}>
                加入
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Settlement Section */}
        {settlements.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center text-blue-900">
                <ArrowRightLeft className="h-5 w-5 mr-2" /> 結算清單
              </CardTitle>
              <CardDescription className="text-blue-700">自動計算最少轉帳次數</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settlements.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/60 p-3 rounded-lg border border-blue-100">
                    <div className="font-medium text-slate-800">{s.from}</div>
                    <div className="flex flex-col items-center flex-1 px-4">
                      <div className="text-xs text-blue-600 font-bold">${s.amount}</div>
                      <div className="w-full h-px bg-blue-300 relative">
                        <div className="absolute right-0 -top-1 border-t-4 border-l-4 border-transparent border-l-blue-300"></div>
                      </div>
                    </div>
                    <div className="font-medium text-slate-800">{s.to}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expenses List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center">
              <Receipt className="h-5 w-5 mr-2" /> 花費紀錄
            </h2>
            <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" /> 新增花費
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>新增花費</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>花費說明</Label>
                    <Input placeholder="例如：晚餐、租車..." value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>金額 ($)</Label>
                    <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>誰付的錢？</Label>
                    <Select onValueChange={setPayerId} value={payerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇付款人" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>分攤成員 (預設全選)</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`m-${m.id}`} 
                            checked={selectedSplitters.includes(m.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSplitters([...selectedSplitters, m.id]);
                              } else {
                                setSelectedSplitters(selectedSplitters.filter(id => id !== m.id));
                              }
                            }}
                          />
                          <label htmlFor={`m-${m.id}`} className="text-sm truncate">{m.name}</label>
                        </div>
                      ))}
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedSplitters(members.map(m => m.id))}
                      className="text-xs h-8"
                    >
                      全選
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full">送出紀錄</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {expenses.map(exp => (
              <Card key={exp.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{exp.description}</h3>
                    <p className="text-xs text-slate-500">
                      {members.find(m => m.id === exp.paid_by)?.name} 付了 ${exp.amount}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      分攤者: {exp.split_among.map(id => members.find(m => m.id === id)?.name).join(', ')}
                    </p>
                  </div>
                  <div className="text-lg font-bold text-slate-900">${exp.amount}</div>
                </CardContent>
              </Card>
            ))}
            {expenses.length === 0 && (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                <Receipt className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400">尚無任何花費紀錄</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
