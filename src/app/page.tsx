'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Home() {
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{ name: roomName }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        router.push(`/room/${data.id}`);
      }
    } catch (err) {
      console.error('Error creating room:', err);
      alert('建立分帳房間時發生錯誤，請檢查 Supabase 設定！');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Trip Split</h1>
          <p className="text-slate-500">出門玩，輕鬆算。免登入，用連結分享。</p>
        </div>

        <form onSubmit={handleCreateRoom} className="space-y-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="space-y-2 text-left">
            <label htmlFor="room-name" className="text-sm font-medium leading-none text-slate-700">
              群組名稱 (例如：日本之旅)
            </label>
            <Input
              id="room-name"
              placeholder="輸入群組名稱..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="h-12 text-lg"
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full h-12 text-lg font-semibold" disabled={loading || !roomName.trim()}>
            {loading ? '建立中...' : '建立新分帳房間'}
          </Button>
        </form>

        <div className="text-slate-400 text-sm">
          只需傳送網址給朋友，他們就能加入並開始記帳。
        </div>
      </div>
    </main>
  );
}
