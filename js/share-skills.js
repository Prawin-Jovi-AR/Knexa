import { supabase, getAuthenticatedUser } from './app.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getAuthenticatedUser();
    if (!currentUser) return;

    await loadSharedSkills();
    await loadIncomingRequests();

    document.getElementById('form-share-skill').addEventListener('submit', handleAddSkill);
});

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

async function loadSharedSkills() {
    const list = document.getElementById('my-shared-skills-list');
    const { data, error } = await supabase
        .from('skills_shared')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading shared skills:", error);
        list.innerHTML = '<p class="empty-list">Failed to load skills.</p>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p class="empty-list">You are not sharing any skills yet.</p>';
        return;
    }

    list.innerHTML = data.map(s => `
        <div style="background:var(--color-bg); border: 1px solid var(--color-border); padding: 1rem; border-radius: var(--border-radius-sm); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="color:var(--color-primary); display:block;">${escapeHTML(s.skill_name)}</strong>
                <span style="font-size: 0.75rem; color:var(--color-text-muted);">${escapeHTML(s.category)} • ${escapeHTML(s.experience_level)} • ${s.years_experience} years exp</span>
            </div>
            <button class="btn btn-outline" style="border:none; color:var(--color-danger); padding:0.25rem 0.5rem;" onclick="window.deleteSharedSkill('${s.id}')" title="Stop Sharing"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

async function loadIncomingRequests() {
    const list = document.getElementById('incoming-requests-list');
    const { data, error } = await supabase
        .from('skill_requests')
        .select('*, profiles!skill_requests_requester_id_fkey(full_name, username)')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error loading incoming requests:", error);
        list.innerHTML = '<p class="empty-list">Failed to load requests.</p>';
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '<p class="empty-list">No pending requests right now.</p>';
        return;
    }

    list.innerHTML = data.map(req => `
        <div style="background:var(--color-bg); border: 1px solid var(--color-border); border-left: 3px solid var(--color-primary); padding: 1rem; border-radius: var(--border-radius-md);">
            <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                <strong>${escapeHTML(req.profiles?.full_name)} wants to learn <span style="color:var(--color-primary);">${escapeHTML(req.requested_skill)}</span></strong>
                <span style="font-size: 0.75rem; color:var(--color-text-muted);">${new Date(req.created_at).toLocaleDateString()}</span>
            </div>
            <p style="font-size: 0.875rem; color:var(--color-text-muted); margin-bottom: 1rem; white-space: pre-wrap;">"${escapeHTML(req.message)}"</p>
            <div style="display:flex; gap: 0.5rem;">
                <button class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size:0.875rem;" onclick="window.updateRequestStatus('${req.id}', 'accepted')">Accept</button>
                <button class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size:0.875rem;" onclick="window.updateRequestStatus('${req.id}', 'rejected')">Decline</button>
            </div>
        </div>
    `).join('');
}

async function handleAddSkill(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-share-skill');
    btn.innerText = 'Saving...';
    btn.disabled = true;

    const skill_name = document.getElementById('share-skill-name').value;
    const category = document.getElementById('share-skill-category').value;
    const experience_level = document.getElementById('share-skill-level').value;
    const years_experience = document.getElementById('share-skill-years').value;

    const { error } = await supabase.from('skills_shared').insert([{
        user_id: currentUser.id,
        skill_name,
        category,
        experience_level,
        years_experience: parseInt(years_experience, 10),
        confidence_level: 100
    }]);

    btn.innerText = 'Start Sharing';
    btn.disabled = false;

    if (error) {
        alert('Error adding skill: ' + error.message);
    } else {
        document.getElementById('form-share-skill').reset();
        await loadSharedSkills();
    }
}

window.deleteSharedSkill = async (id) => {
    if (!confirm('Are you sure you want to stop sharing this skill?')) return;
    
    const { error } = await supabase.from('skills_shared').delete().eq('id', id);
    if (error) {
        alert('Error deleting skill: ' + error.message);
    } else {
        await loadSharedSkills();
    }
};

window.updateRequestStatus = async (id, newStatus) => {
    const { error } = await supabase.from('skill_requests').update({ status: newStatus }).eq('id', id);
    if (error) {
        alert('Error updating request: ' + error.message);
    } else {
        await loadIncomingRequests();
        alert(`Request ${newStatus}!`);
    }
};
