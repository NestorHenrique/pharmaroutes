import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Doctor } from '@/types/doctor';
import { User } from '@supabase/supabase-js';

export function useDoctors(user: User | null, selectedTab: string, selectedCity: string) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const logActivity = async (actionType: 'INSERT' | 'UPDATE' | 'DELETE', doctorName: string, details: string) => {
    if (!user) return;
    await supabase.from('activity_logs').insert([
      {
        user_email: user.email,
        action_type: actionType,
        doctor_name: doctorName,
        details: details,
      },
    ]);
  };

  const loadCities = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('doctors').select('cidade');
    if (!error && data) {
      const uniqueCities = Array.from(new Set(data.map((item) => item.cidade).filter(Boolean))).sort();
      setCities(uniqueCities as string[]);
    }
  }, [user]);

  const fetchDoctors = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from('doctors').select('*');

    if (selectedTab === 'novos') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('created_at', sevenDaysAgo.toISOString()).order('created_at', { ascending: false });
    } else {
      query = query.or(`dias_semana.ilike.%${selectedTab}%,dia_semana.ilike.%${selectedTab}%`).order('bairro', { ascending: true });
    }

    if (selectedCity !== 'ALL') {
      query = query.eq('cidade', selectedCity);
    }

    const { data, error } = await query;
    if (!error) setDoctors(data || []);
    setLoading(false);
  }, [user, selectedTab, selectedCity]);

  useEffect(() => {
    loadCities();
  }, [loadCities]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const addDoctor = async (newDoctor: Partial<Doctor>) => {
    const payload = {
      ...newDoctor,
      dia_semana: newDoctor.dias_semana,
      created_at: new Date().toISOString(),
      updated_by: user?.email,
    };

    const { error } = await supabase.from('doctors').insert([payload]);
    if (!error) {
      await logActivity('INSERT', newDoctor.descricao || 'Desconhecido', `Cadastrado por ${user?.email}`);
      fetchDoctors();
      return true;
    }
    return false;
  };

  const updateDoctor = async (docId: string, updatedData: Partial<Doctor>, docName: string) => {
    const payload = { ...updatedData, dia_semana: updatedData.dias_semana, updated_by: user?.email };
    const { error } = await supabase.from('doctors').update(payload).eq('id', docId);

    if (!error) {
      await logActivity('UPDATE', docName, `Dados atualizados por ${user?.email}`);
      setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, ...payload } : d)));
      return true;
    }
    return false;
  };

  const updateShift = async (docId: string, newTurno: string, docName: string) => {
    setDoctors((prev) => prev.map((d) => (d.id === docId ? { ...d, turno: newTurno, updated_by: user?.email } : d)));
    await supabase.from('doctors').update({ turno: newTurno, updated_by: user?.email }).eq('id', docId);
    await logActivity('UPDATE', docName, `Turno alterado para ${newTurno} por ${user?.email}`);
  };

  const deleteDoctor = async (doc: Doctor) => {
    setDoctors((prev) => prev.filter((d) => d.id !== doc.id));
    const { error } = await supabase.from('doctors').delete().eq('id', doc.id);
    if (!error) {
      await logActivity('DELETE', doc.descricao || 'Sem nome', `Removido por ${user?.email}`);
    } else {
      fetchDoctors(); // reverte em caso de erro
    }
  };

  return { doctors, cities, loading, addDoctor, updateDoctor, updateShift, deleteDoctor };
}