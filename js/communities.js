import { supabase } from './supabase-config.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let currentProfile = null;
let activeGroupId = null;
let allGroups = [];
let profileMap = {};
let messageSubscription = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (profile) currentProfile = profile;

        await loadGroups();
        
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        alert('Failed to load communities.');
    }

    document.getElementById('form-create-group').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('group-name').value;
        const desc = document.getElementById('group-desc').value;
        const category = document.getElementById('group-category').value;
        const btn = e.target.querySelector('button');
        
        btn.innerText = 'Creating...';
        btn.disabled = true;

        try {
            const { data, error } = await supabase.from('communities').insert([{
                name: name,
                description: desc,
                category: category,
                creator_id: currentUser.id
            }]).select().single();
            
            if (error) throw error;
            
            await supabase.from('community_members').insert([{
                community_id: data.id,
                user_id: currentUser.id
            }]);

            document.getElementById('form-create-group').reset();
            document.getElementById('modal-create-group').classList.add('hidden');
            await loadGroups();
            selectGroup(data.id);
            
        } catch (err) {
            alert('Error creating group: ' + err.message);
        } finally {
            btn.innerText = 'Create Group';
            btn.disabled = false;
        }
    });

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeGroupId) return;
        
        const input = document.getElementById('chat-input');
        const content = input.value;
        if (!content.trim()) return;

        input.disabled = true;
        
        try {
            const { error } = await supabase.from('community_messages').insert([{
                community_id: activeGroupId,
                user_id: currentUser.id,
                content: content
            }]);
            
            if (error) throw error;
            input.value = '';
            
            await loadMessages(activeGroupId);
        } catch (err) {
            alert('Error sending message: ' + err.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    });
    
    document.getElementById('btn-join-group').addEventListener('click', async (e) => {
        if (!activeGroupId) return;
        
        const btn = e.target;
        btn.disabled = true;
        btn.innerText = 'Joining...';
        
        try {
            const { error } = await supabase.from('community_members').insert([{
                community_id: activeGroupId,
                user_id: currentUser.id
            }]);
            
            if (error) throw error;
            
            btn.classList.add('hidden');
            document.getElementById('chat-form').classList.remove('hidden');
            await loadMessages(activeGroupId);
        } catch (err) {
            alert('Error joining group: ' + err.message);
            btn.disabled = false;
            btn.innerText = 'Join Group';
        }
    });
});

async function loadGroups() {
    try {
        const { data, error } = await supabase.from('communities').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allGroups = data || [];
        renderGroups();
    } catch (err) {
        console.error("Error loading groups", err);
    }
}

function renderGroups() {
    const container = document.getElementById('groups-container');
    if (allGroups.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.875rem;">No groups available.</p>';
        return;
    }
    
    container.innerHTML = allGroups.map(group => `
        <div class="community-item ${group.id === activeGroupId ? 'active' : ''}" onclick="selectGroup('${group.id}')" id="group-card-${group.id}">
            <h4 style="margin:0;">${group.name}</h4>
            <p style="margin:0; font-size:0.75rem; color:var(--color-text-muted); margin-top:0.25rem;">${group.description || ''}</p>
        </div>
    `).join('');
}

window.selectGroup = async function(groupId) {
    activeGroupId = groupId;
    
    document.querySelectorAll('.community-item').forEach(el => el.classList.remove('active'));
    const activeCard = document.getElementById('group-card-' + groupId);
    if (activeCard) activeCard.classList.add('active');
    
    const group = allGroups.find(g => g.id === groupId);
    if (!group) return;
    
    document.getElementById('chat-title').innerText = group.name;
    document.getElementById('chat-desc').innerText = group.description;
    
    const { data: member } = await supabase.from('community_members')
        .select('*')
        .eq('community_id', groupId)
        .eq('user_id', currentUser.id)
        .single();
        
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const joinBtn = document.getElementById('btn-join-group');
    
    if (member) {
        joinBtn.classList.add('hidden');
        chatForm.classList.remove('hidden');
        await loadMessages(groupId);
    } else {
        joinBtn.classList.remove('hidden');
        joinBtn.disabled = false;
        joinBtn.innerText = 'Join Group';
        chatForm.classList.add('hidden');
        chatMessages.innerHTML = `
            <div style="text-align:center; padding: 3rem; color:var(--color-text-muted);">
                <i class="fas fa-lock" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>Join this group to view and send messages.</p>
            </div>
        `;
    }
}

async function loadMessages(groupId) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-circle-notch fa-spin"></i></div>';
    
    try {
        const { data: messages, error } = await supabase
            .from('community_messages')
            .select('*')
            .eq('community_id', groupId)
            .order('created_at', { ascending: true })
            .limit(100);
            
        if (error) throw error;
        
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = `
                <div style="text-align:center; padding: 3rem; color:var(--color-text-muted);">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>No messages yet. Say hello!</p>
                </div>
            `;
            return;
        }
        
        const userIds = [...new Set(messages.map(m => m.user_id))];
        const missingUserIds = userIds.filter(id => !profileMap[id]);
        
        if (missingUserIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', missingUserIds);
            if (profiles) {
                profiles.forEach(p => profileMap[p.id] = p);
            }
        }
        
        chatMessages.innerHTML = messages.map(m => {
            const isOwn = m.user_id === currentUser.id;
            const author = profileMap[m.user_id] || { full_name: 'Unknown' };
            const time = new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div style="display:flex; flex-direction:column; gap:0.25rem;">
                    <div class="message-bubble ${isOwn ? 'own' : ''}" style="position:relative;">
                        ${isOwn ? '' : `<h5 style="margin:0 0 0.25rem 0; font-size:0.75rem; color:var(--color-primary);">${author.full_name}</h5>`}
                        <p style="margin:0;">${escapeHTML(m.content)}</p>
                        ${isOwn ? `
                        <div class="msg-actions" style="display:none; gap:8px; margin-top:8px; justify-content:flex-end;">
                            <button onclick="window.editCommunityMessage('${m.id}', '${escapeHTML(m.content).replace(/'/g, "\\'")}')" style="background:transparent; color:inherit; opacity:0.8; border:none; cursor:pointer; display:flex; align-items:center; font-size:0.8rem;" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="window.deleteCommunityMessage('${m.id}')" style="background:transparent; color:inherit; opacity:0.8; border:none; cursor:pointer; display:flex; align-items:center; font-size:0.8rem;" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                        ` : ''}
                    </div>
                    <span style="font-size:0.65rem; color:var(--color-text-muted); align-self: ${isOwn ? 'flex-end' : 'flex-start'}; padding:0 0.5rem;">${time}</span>
                </div>
            `;
        }).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
    } catch (err) {
        console.error("Error loading messages", err);
        chatMessages.innerHTML = '<p style="color:var(--color-danger); text-align:center;">Failed to load messages.</p>';
    }
}

function escapeHTML(str) {
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

window.deleteCommunityMessage = async (msgId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const { error } = await supabase.from('community_messages').delete().eq('id', msgId).eq('user_id', currentUser.id);
    if (error) {
        alert('Failed to delete message: ' + error.message);
    } else {
        await loadMessages(activeGroupId);
    }
};

window.editCommunityMessage = async (msgId, currentContent) => {
    const newContent = prompt('Edit your message:', currentContent);
    if (newContent === null || newContent.trim() === '' || newContent === currentContent) return;
    
    const { error } = await supabase.from('community_messages').update({ content: newContent }).eq('id', msgId).eq('user_id', currentUser.id);
    if (error) {
        alert('Failed to edit message: ' + error.message);
    } else {
        await loadMessages(activeGroupId);
    }
};
