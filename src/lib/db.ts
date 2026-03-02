// ============================================================
// BYCORE — db.ts
// Alle Datenbankfunktionen (Tasks, Notizen, Events) via Supabase
// ============================================================

import { supabase } from './supabase';

// ─── Aktuellen User holen ─────────────────────────────────
async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error('Nicht eingeloggt');
  return userId;
}

// ════════════════════════════════════════════════════════════
// NOTIZEN
// ════════════════════════════════════════════════════════════

export async function getNotes() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(title: string = '', content: string = '') {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, title: string, content: string) {
  const { error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════

export async function getTasks() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTask(
  title: string,
  description: string = '',
  priority: 'low' | 'medium' | 'high' = 'medium',
  dueDate: string | null = null
) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title,
      description,
      priority,
      due_date: dueDate,
      status: 'todo'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done') {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function updateTask(
  id: string,
  title: string,
  description: string,
  priority: 'low' | 'medium' | 'high',
  dueDate: string | null
) {
  const { error } = await supabase
    .from('tasks')
    .update({ title, description, priority, due_date: dueDate })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ════════════════════════════════════════════════════════════
// EVENTS (Kalender)
// ════════════════════════════════════════════════════════════

export async function getEvents() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createEvent(
  title: string,
  startTime: string,
  endTime: string | null = null,
  description: string = '',
  allDay: boolean = false
) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      title,
      description,
      start_time: startTime,
      end_time: endTime,
      all_day: allDay
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  title: string,
  startTime: string,
  endTime: string | null,
  description: string
) {
  const { error } = await supabase
    .from('events')
    .update({ title, start_time: startTime, end_time: endTime, description })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
