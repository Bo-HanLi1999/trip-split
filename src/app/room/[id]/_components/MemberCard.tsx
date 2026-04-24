'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, X } from 'lucide-react';
import type { Member, Expense } from '@/lib/types';

interface Props {
  members: Member[];
  expenses: Expense[];
  roomId: string;
  onDataChange: () => Promise<void>;
}

export function MemberCard({ members, expenses, roomId, onDataChange }: Props) {
  const [newName, setNewName] = useState('');
  const [joining, setJoining] = useState(false);

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
      await onDataChange();
    } catch (err) {
      console.error('Error joining:', err);
      alert('加入成員時發生錯誤');
    } finally {
      setJoining(false);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const hasExpense = expenses.some(exp => {
      const isPayer = exp.paid_by === memberId;
      const isSplitter = Array.isArray(exp.split_among)
        ? exp.split_among.includes(memberId)
        : Object.keys(exp.split_among).includes(memberId);
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
      await onDataChange();
    } catch (err) {
      console.error('Error deleting member:', err);
      alert('刪除成員失敗');
    }
  };

  return (
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
  );
}
