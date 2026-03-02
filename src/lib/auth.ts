import { supabase } from './supabase';

// ─── Login ───────────────────────────────────────────────────────────────────
export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ─── Register ────────────────────────────────────────────────────────────────
export async function register(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// ─── Logout ──────────────────────────────────────────────────────────────────
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Session holen ───────────────────────────────────────────────────────────
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Auth State Listener ─────────────────────────────────────────────────────
// Rufe diese Funktion beim App-Start auf.
// callback(session) wird aufgerufen wenn sich Login-Status ändert.
export function onAuthChange(callback: (session: any) => void) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
