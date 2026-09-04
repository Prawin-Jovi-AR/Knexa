import { supabase } from './supabase-config.js';

export async function getAuthenticatedUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

export async function ensureProfile(user, profile = {}) {
    const { data, error } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        ...profile
    }, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
}
