import { supabase } from './supabase-config.js';
import { fetchMySkills, computeScore } from './matching-engine.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let targetUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getAuthenticatedUser();
    if (!currentUser) return;

    const urlParams = new URLSearchParams(window.location.search);
    targetUserId = urlParams.get('id');

    if (!targetUserId || targetUserId === currentUser.id) {
        window.location.href = 'profile.html';
        return;
    }

    await loadPublicProfile();
});

async function loadPublicProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
    if (!profile) {
        alert("User not found.");
        window.location.href = 'matches.html';
        return;
    }

    document.getElementById('user-name').innerText = profile.full_name || 'Anonymous';
    document.getElementById('user-username').innerText = '@' + (profile.username || 'user');
    document.getElementById('user-avatar-initial').innerText = (profile.full_name || 'U').charAt(0).toUpperCase();
    document.getElementById('user-country').innerText = profile.country || 'Global';
    if (profile.bio) document.getElementById('user-bio').innerText = profile.bio;

    const mySkills = await fetchMySkills(currentUser.id);
    const theirSkills = await fetchMySkills(targetUserId);

    renderSkillList('list-shared', theirSkills.shared);
    renderSkillList('list-learning', theirSkills.learning);

    const match = computeScore(mySkills, theirSkills);
    document.getElementById('compat-score').innerText = Math.min(100, match.score) + '%';
    document.getElementById('compat-category').innerText = match.category.text;
    
    if (match.reasons && match.reasons.length > 0) {
        document.getElementById('compat-reasons').innerHTML = match.reasons.map(r => `<div><i class="fas fa-check" style="color:var(--color-primary);"></i> ${r}</div>`).join('');
    }

    const btnConnect = document.getElementById('btn-connect');
    const btnMessage = document.getElementById('btn-message');

    const { data: existing } = await supabase.from('connections')
        .select('*')
        .or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},receiver_id.eq.${currentUser.id})`)
        .maybeSingle();

    if (existing) {
        if (existing.status === 'accepted') {
            btnConnect.style.display = 'none';
            btnMessage.style.display = 'block';
            btnMessage.onclick = () => window.location.href = `messages.html?id=${targetUserId}`;
        } else if (existing.status === 'pending') {
            if (existing.requester_id === currentUser.id) {
                btnConnect.innerText = 'Pending';
                btnConnect.disabled = true;
            } else {
                btnConnect.innerText = 'Accept';
                btnConnect.onclick = async () => {
                    btnConnect.innerText = 'Accepting...';
                    btnConnect.disabled = true;
                    await supabase.from('connections')
                        .update({ status: 'accepted' })
                        .eq('requester_id', targetUserId)
                        .eq('receiver_id', currentUser.id);
                    btnConnect.style.display = 'none';
                    btnMessage.style.display = 'block';
                    btnMessage.onclick = () => window.location.href = `messages.html?id=${targetUserId}`;
                };
            }
        }
    } else {
        btnConnect.onclick = async () => {
            btnConnect.innerText = 'Requesting...';
            btnConnect.disabled = true;
            await supabase.from('connections').insert([{
                requester_id: currentUser.id,
                receiver_id: targetUserId
            }]);
            btnConnect.innerText = 'Pending';
        };
    }
}

function renderSkillList(elementId, skillsArray) {
    const el = document.getElementById(elementId);
    if (skillsArray && skillsArray.length > 0) {
        el.innerHTML = skillsArray.slice(0, 5).map(s => `
            <li ${elementId === 'list-learning' ? 'style="flex-direction: column; align-items: stretch; gap: 0.5rem;"' : ''}>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span>${s.skill_name} ${elementId === 'list-learning' ? `<span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:0.5rem;">${s.progress}%</span>` : ''}</span>
                    <span class="skill-list-category">${s.category || 'General'}</span>
                </div>
                ${elementId === 'list-learning' ? `
                <div class="progress-bar-container" style="height: 4px; margin: 0;">
                    <div class="progress-bar-fill" style="width: ${s.progress}%;"></div>
                </div>` : ''}
            </li>
        `).join('');
    }
}
