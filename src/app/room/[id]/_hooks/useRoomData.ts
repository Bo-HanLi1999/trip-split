'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Member, Expense } from '@/lib/types';

export function useRoomData(roomId: string) {
  const [roomName, setRoomName] = useState('載入中...');
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

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
      .channel(`members-changes-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` }, () => fetchData())
      .subscribe();

    const expensesChannel = supabase
      .channel(`expenses-changes-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `room_id=eq.${roomId}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, [roomId, fetchData]);

  return { roomName, members, expenses, loading, fetchData };
}
