import { supabase } from './supabase-config.js';
import { fetchMySkills } from './matching-engine.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;

        await loadProfileData();

        await loadSkillsData();

        await loadGoals();
        await loadKnowledgePosts();
        await loadAchievements();
        await loadSkillRequests();
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        alert('Failed to load profile data.');
    }

    document.getElementById('btn-add-goal').addEventListener('click', () => {
        document.getElementById('goal-title').value = '';
        document.getElementById('goal-date').value = '';
        document.getElementById('modal-add-goal').classList.remove('hidden');
    });

    document.getElementById('close-goal-modal').addEventListener('click', () => {
        document.getElementById('modal-add-goal').classList.add('hidden');
    });

    document.getElementById('form-add-goal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('goal-title').value;
        const date = document.getElementById('goal-date').value;
        const btn = document.getElementById('btn-save-goal');
        
        btn.innerText = 'Saving...';
        btn.disabled = true;

        const { error } = await supabase.from('goals').insert([{
            user_id: currentUser.id,
            title: title,
            target_date: date,
            status: 'in_progress'
        }]);

        if (error) {
            alert('Error adding goal: ' + error.message);
        } else {
            document.getElementById('modal-add-goal').classList.add('hidden');
            await loadGoals();
        }

        btn.innerText = 'Save Goal';
        btn.disabled = false;
    });
    document.getElementById('btn-edit-profile').addEventListener('click', async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (data) {
            document.getElementById('edit-full-name').value = data.full_name || '';
            document.getElementById('edit-username').value = data.username || '';
            document.getElementById('edit-country').value = data.country || '';
            document.getElementById('edit-bio').value = data.bio || '';
        }
        document.getElementById('modal-edit-profile').classList.remove('hidden');
    });

    document.getElementById('close-edit-modal').addEventListener('click', () => {
        document.getElementById('modal-edit-profile').classList.add('hidden');
    });

    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-profile');
        btn.innerText = 'Saving...';
        btn.disabled = true;

        const updates = {
            full_name: document.getElementById('edit-full-name').value,
            username: document.getElementById('edit-username').value,
            country: document.getElementById('edit-country').value,
            bio: document.getElementById('edit-bio').value,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id);

        if (error) {
            alert('Error updating profile: ' + error.message);
        } else {
            document.getElementById('modal-edit-profile').classList.add('hidden');
            await loadProfileData();
        }

        btn.innerText = 'Save Changes';
        btn.disabled = false;
    });
});

async function loadProfileData() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error) {
        console.error("Error fetching profile:", error);
        return;
    }

    if (data) {
        document.getElementById('profile-name').innerText = data.full_name || 'Anonymous';
        document.getElementById('profile-username').innerText = '@' + (data.username || 'user');
        document.getElementById('profile-country').innerText = data.country || 'Global';
        if (data.bio) document.getElementById('profile-bio').innerText = data.bio;
        
        const avatarEl = document.getElementById('profile-avatar-initial');
        avatarEl.innerText = (data.full_name || 'U').charAt(0).toUpperCase();
    }

    const [{ count: followers }, { count: following }, { count: connections }] = await Promise.all([
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id),
        supabase.from('followers').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id),
        supabase.from('connections').select('*', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    ]);

    document.getElementById('profile-followers').innerText = followers || 0;
    document.getElementById('profile-following').innerText = following || 0;
    document.getElementById('profile-connections').innerText = connections || 0;
}

async function loadSkillsData() {
    const mySkills = await fetchMySkills(currentUser.id);

    let score = 0; 
    const sCount = mySkills.shared.length;
    const lCount = mySkills.learning.length;
    const eCount = mySkills.exploring.length;

    score += Math.min(50, sCount * 10);
    score += Math.min(40, lCount * 10);
    score += Math.min(10, eCount * 5);
    score = Math.min(100, score);

    document.getElementById('dash-dna-percentage').innerText = score + '%';
    document.getElementById('dash-dna-bar').style.width = score + '%';

    const listShared = document.getElementById('list-shared');
    if (sCount > 0) {
        listShared.innerHTML = mySkills.shared.slice(0, 5).map(s => `
            <li>
                <span>${s.skill_name}</span>
                <span class="skill-list-category">${s.category || 'General'}</span>
            </li>
        `).join('');
    }

    const listLearning = document.getElementById('list-learning');
    if (lCount > 0) {
        listLearning.innerHTML = mySkills.learning.slice(0, 5).map(s => `
            <li>
                <span>${s.skill_name} <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:0.5rem;">${s.progress}%</span></span>
                <span class="skill-list-category">${s.category || 'General'}</span>
            </li>
        `).join('');
    }

    const listExploring = document.getElementById('list-exploring');
    if (eCount > 0) {
        listExploring.innerHTML = mySkills.exploring.slice(0, 5).map(s => `
            <li>
                <span>${s.skill_name}</span>
                <span class="skill-list-category">${s.category || 'General'}</span>
            </li>
        `).join('');
    }
}

async function loadGoals() {
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const list = document.getElementById('list-goals');
    if (error || !data || data.length === 0) {
        list.innerHTML = '<li class="empty-list">No goals set yet.</li>';
        return;
    }

    list.innerHTML = data.map(g => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding: 0.75rem 0; border-bottom: 1px solid var(--color-border);">
            <div>
                <strong style="display:block; margin-bottom:0.25rem;">${g.title}</strong>
                <span style="font-size:0.75rem; color:var(--color-text-muted);"><i class="far fa-calendar-alt"></i> Target: ${new Date(g.target_date).toLocaleDateString()}</span>
            </div>
            <button class="btn btn-outline btn-small" onclick="window.deleteGoal('${g.id}')" style="border:none; color:var(--color-text-muted);"><i class="fas fa-trash"></i></button>
        </li>
    `).join('');
}

window.deleteGoal = async function(id) {
    if(!confirm("Delete this goal?")) return;
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if(error) alert(error.message);
    else await loadGoals();
};

async function loadKnowledgePosts() {
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

    const list = document.getElementById('profile-posts-list');
    if (error || !posts || posts.length === 0) {
        list.innerHTML = '<div class="empty-list">No knowledge shared yet.</div>';
        return;
    }

    list.innerHTML = posts.map(post => `
        <div style="background:var(--color-bg-alt); padding: 1rem; border-radius: var(--border-radius-md);">
            <div style="font-size: 0.75rem; color:var(--color-text-muted); margin-bottom: 0.5rem;">
                ${new Date(post.created_at).toLocaleDateString()} • <span class="post-category-tag" style="padding:0.1rem 0.4rem; font-size:0.7rem;">${post.category || 'General'}</span>
            </div>
            <p style="font-size: 0.9rem; margin:0; line-height: 1.5;">${escapeHTML(post.content)}</p>
        </div>
    `).join('');
}

async function loadAchievements() {
    const mySkills = await fetchMySkills(currentUser.id);
    const sCount = mySkills.shared.length;
    const lCount = mySkills.learning.length;
    
    let achievements = [];
    
    if (sCount >= 1) achievements.push({ name: "Knowledge Sharer", icon: "fa-hand-holding-heart", color: "#ec4899" });
    if (sCount >= 3) achievements.push({ name: "Expert Mentor", icon: "fa-chalkboard-teacher", color: "#8b5cf6" });
    if (lCount >= 1) achievements.push({ name: "Curious Mind", icon: "fa-lightbulb", color: "#eab308" });
    if (lCount >= 3) achievements.push({ name: "Avid Learner", icon: "fa-book-reader", color: "#3b82f6" });
    
    achievements.push({ name: "Early Adopter", icon: "fa-rocket", color: "#10b981" });

    const grid = document.getElementById('profile-achievements');
    
    if(achievements.length === 0) {
        grid.innerHTML = '<p class="empty-list" style="grid-column: 1 / -1;">No achievements yet. Keep sharing and learning!</p>';
        return;
    }

    grid.innerHTML = achievements.map(ach => `
        <div style="background:var(--color-bg-alt); padding: 1rem; border-radius: var(--border-radius-md); text-align: center; border: 1px solid var(--color-border);">
            <div style="width: 48px; height: 48px; background: ${ach.color}15; color: ${ach.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 0.5rem;">
                <i class="fas ${ach.icon}"></i>
            </div>
            <h4 style="font-size: 0.8rem; margin:0;">${ach.name}</h4>
        </div>
    `).join('');
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

async function loadSkillRequests() {
    const list = document.getElementById('list-skill-requests');
    if (!list) return;

    const { data: requests, error } = await supabase
        .from('skill_requests')
        .select('*, requester:profiles!requester_id(full_name, username)')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error || !requests || requests.length === 0) {
        list.innerHTML = '<p class="empty-list">No skill requests found.</p>';
        return;
    }

    list.innerHTML = requests.map(req => {
        const requesterName = req.requester ? req.requester.full_name : 'Unknown';
        const requesterUsername = req.requester ? req.requester.username : 'unknown';
        
        return `
        <div style="background:var(--color-bg-alt); padding: 1rem; border-radius: var(--border-radius-md); margin-bottom: 1rem; border: 1px solid var(--color-border);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                <div>
                    <h4 style="margin:0;">${requesterName} <span style="color:var(--color-text-muted); font-weight:normal; font-size:0.875rem;">(@${requesterUsername})</span></h4>
                    <p style="font-size:0.875rem; color:var(--color-primary); margin:0.25rem 0;">Wants to learn: <strong>${escapeHTML(req.requested_skill)}</strong></p>
                </div>
                <span style="font-size:0.75rem; color:var(--color-text-muted);">${new Date(req.created_at).toLocaleDateString()}</span>
            </div>
            ${req.message ? `<p style="font-size:0.875rem; margin-bottom:1rem; padding:0.5rem; background:var(--color-bg-main); border-radius:4px; font-style:italic;">"${escapeHTML(req.message)}"</p>` : ''}
            
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-primary btn-small" onclick="window.acceptSkillRequest('${req.id}', '${req.requester_id}', '${escapeHTML(req.requested_skill).replace(/'/g, "\\'")}')">Accept</button>
                <button class="btn btn-outline btn-small" onclick="window.declineSkillRequest('${req.id}')">Decline</button>
            </div>
        </div>
        `;
    }).join('');
}

window.acceptSkillRequest = async function(requestId, requesterId, skillName) {
    if(!confirm("Accept this request? You will be connected automatically.")) return;
    
    await supabase.from('skill_requests').update({ status: 'accepted' }).eq('id', requestId);
    
    const { data: existing } = await supabase.from('connections').select('id')
        .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${requesterId}),and(requester_id.eq.${requesterId},receiver_id.eq.${currentUser.id})`)
        .maybeSingle();
        
    if (!existing) {
        await supabase.from('connections').insert([{
            requester_id: currentUser.id,
            receiver_id: requesterId,
            status: 'accepted'
        }]);
    } else {
        await supabase.from('connections').update({ status: 'accepted' }).eq('id', existing.id);
    }
    
    const msgContent = `Hi! I accepted your request to learn/collaborate on **${skillName}**. Let's get started!`;
    await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        receiver_id: requesterId,
        content: msgContent
    }]);
    alert("Request accepted! Check your messages to start collaborating.");
    await loadSkillRequests();
};

window.declineSkillRequest = async function(requestId) {
    if(!confirm("Decline this request?")) return;
    await supabase.from('skill_requests').update({ status: 'declined' }).eq('id', requestId);
    await loadSkillRequests();
};

window.openStatsModal = async function(type) {
    const modal = document.getElementById('stats-modal');
    const title = document.getElementById('stats-modal-title');
    const list = document.getElementById('stats-modal-list');
    
    modal.classList.remove('hidden');
    list.innerHTML = '<div style="text-align:center; padding:1rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    let users = [];
    if (type === 'followers') {
        title.innerText = 'Followers';
        const { data } = await supabase.from('followers').select('follower_id').eq('following_id', currentUser.id);
        if (data) {
            const ids = data.map(d => d.follower_id);
            if (ids.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', ids);
                users = profiles || [];
            }
        }
    } else if (type === 'following') {
        title.innerText = 'Following';
        const { data } = await supabase.from('followers').select('following_id').eq('follower_id', currentUser.id);
        if (data) {
            const ids = data.map(d => d.following_id);
            if (ids.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', ids);
                users = profiles || [];
            }
        }
    } else if (type === 'connections') {
        title.innerText = 'Connections';
        const { data } = await supabase.from('connections').select('requester_id, receiver_id')
            .eq('status', 'accepted')
            .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
        if (data) {
            const ids = data.map(d => d.requester_id === currentUser.id ? d.receiver_id : d.requester_id);
            if (ids.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', ids);
                users = profiles || [];
            }
        }
    }

    if (users.length === 0) {
        list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--color-text-muted);">No users found.</div>';
    } else {
        list.innerHTML = users.map(u => `
            <div style="display:flex; align-items:center; gap:0.75rem; padding: 0.5rem; border-bottom: 1px solid var(--color-border);">
                <div style="width:32px; height:32px; border-radius:50%; background:var(--gradient-primary); color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:0.8rem;">
                    ${(u.full_name || 'U').charAt(0)}
                </div>
                <div>
                    <div style="font-weight:600; font-size:0.9rem;">${u.full_name || 'Anonymous'}</div>
                    <div style="font-size:0.75rem; color:var(--color-text-muted);">@${u.username || 'user'}</div>
                </div>
            </div>
        `).join('');
    }
};

document.getElementById('close-stats-modal')?.addEventListener('click', () => {
    document.getElementById('stats-modal').classList.add('hidden');
});

const attachStatListeners = () => {
    const folEl = document.getElementById('profile-followers');
    if(folEl) {
        folEl.parentElement.style.cursor = 'pointer';
        folEl.parentElement.onclick = () => window.openStatsModal('followers');
    }
    const fwgEl = document.getElementById('profile-following');
    if(fwgEl) {
        fwgEl.parentElement.style.cursor = 'pointer';
        fwgEl.parentElement.onclick = () => window.openStatsModal('following');
    }
    const conEl = document.getElementById('profile-connections');
    if(conEl) {
        conEl.parentElement.style.cursor = 'pointer';
        conEl.parentElement.onclick = () => window.openStatsModal('connections');
    }
};

attachStatListeners();
setTimeout(attachStatListeners, 500);
