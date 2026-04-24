'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Copy, Loader2, Receipt } from 'lucide-react';
import { useRoomData } from './_hooks/useRoomData';
import { MemberCard } from './_components/MemberCard';
import { SettlementCard } from './_components/SettlementCard';
import { ExpenseList } from './_components/ExpenseList';
import { ExpenseForm } from './_components/ExpenseForm';

export default function RoomPage() {
  const { id: roomId } = useParams() as { id: string };
  const { roomName, members, expenses, loading, fetchData } = useRoomData(roomId);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('已複製網址，分享給朋友吧！');
    } catch {
      alert('複製失敗，請手動複製網址列的連結。');
    }
  };

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
        <MemberCard
          members={members}
          expenses={expenses}
          roomId={roomId}
          onDataChange={fetchData}
        />

        {members.length > 0 && expenses.length > 0 && (
          <SettlementCard
            members={members}
            expenses={expenses}
            roomId={roomId}
            onDataChange={fetchData}
          />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center text-slate-800">
              <Receipt className="h-5 w-5 mr-2" /> 花費紀錄
            </h2>
            <ExpenseForm
              members={members}
              roomId={roomId}
              isOpen={isAddingExpense}
              onOpenChange={setIsAddingExpense}
              onSuccess={fetchData}
            />
          </div>

          <ExpenseList
            expenses={expenses}
            members={members}
            roomId={roomId}
            onDataChange={fetchData}
          />
        </div>
      </div>
    </div>
  );
}
