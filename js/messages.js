import { supabase } from './supabase-config.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let contacts = [];
let activeContact = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;
        
        localStorage.setItem('last_messages_check', new Date().toISOString());
        const badge = document.getElementById('nav-msg-badge');
        if (badge) badge.style.display = 'none';

        await loadContacts();

        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id');
        if (targetId) {
            const contact = contacts.find(c => c.id === targetId);
            if (contact) {
                selectContact(contact);
            }
        }
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        alert('Failed to load messages interface.');
    }

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content || !activeContact) return;

        input.value = '';

        renderMessage({ sender_id: currentUser.id, content: content }, true);

        const { error } = await supabase.from('messages').insert([{
            sender_id: currentUser.id,
            receiver_id: activeContact.id,
            content: content
        }]);

        if (error) {
            alert("Failed to send message: " + error.message);
        } else {
            loadChatHistory(activeContact.id);
        }
    });
});

async function loadContacts() {
    const { data: conns } = await supabase.from('connections')
        .select('*')
        .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .eq('status', 'accepted');

    if (!conns || conns.length === 0) {
        document.getElementById('contacts-list').innerHTML = `<div style="padding:2rem; text-align:center; color:var(--color-text-muted);">No connections yet. Connect with someone to message them.</div>`;
        return;
    }

    const contactIds = conns.map(c => c.requester_id === currentUser.id ? c.receiver_id : c.requester_id);
    
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', contactIds);
    contacts = profiles || [];

    const list = document.getElementById('contacts-list');
    list.innerHTML = contacts.map(c => `
        <div class="inbox-contact" id="contact-${c.id}" onclick="window.selectContactById('${c.id}')">
            <div style="width:40px; height:40px; border-radius:50%; background:var(--gradient-primary); color:white; display:flex; justify-content:center; align-items:center; font-weight:bold;">
                ${(c.full_name || 'U').charAt(0)}
            </div>
            <div>
                <h4 style="margin:0; font-size:0.95rem;">${c.full_name || 'Unknown'}</h4>
                <p style="margin:0; font-size:0.75rem; color:var(--color-text-muted);">@${c.username || 'user'}</p>
            </div>
        </div>
    `).join('');
}

window.selectContactById = (id) => {
    const contact = contacts.find(c => c.id === id);
    if (contact) selectContact(contact);
};

function selectContact(contact) {
    activeContact = contact;
    
    document.querySelectorAll('.inbox-contact').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`contact-${contact.id}`);
    if (el) el.classList.add('active');

    document.getElementById('chat-empty').style.display = 'none';
    const chatActive = document.getElementById('chat-active');
    chatActive.style.display = 'flex';

    document.getElementById('chat-name').innerText = contact.full_name;
    document.getElementById('chat-username').innerText = '@' + contact.username;
    document.getElementById('chat-avatar').innerText = (contact.full_name || 'U').charAt(0).toUpperCase();

    loadChatHistory(contact.id);
}

async function loadChatHistory(otherUserId) {
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '<div style="text-align:center; padding:1rem;"><i class="fas fa-spinner fa-spin"></i></div>';

    const { data: msgs, error } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    messagesDiv.innerHTML = '';

    if (msgs && msgs.length > 0) {
        msgs.forEach(msg => renderMessage(msg, false));
    } else {
        messagesDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted); font-size:0.875rem;">This is the start of your conversation.</div>`;
    }

    scrollToBottom();
}

function renderMessage(msg, appendToExisting) {
    const messagesDiv = document.getElementById('chat-messages');
    
    if (appendToExisting && messagesDiv.innerHTML.includes('start of your conversation')) {
        messagesDiv.innerHTML = '';
    }

    const isMine = msg.sender_id === currentUser.id;
    const cls = isMine ? 'message-sent' : 'message-received';
    
    messagesDiv.innerHTML += `
        <div class="message-bubble ${cls}" style="position:relative;" onmouseenter="const actions = this.querySelector('.msg-actions'); if(actions) actions.style.display='flex';" onmouseleave="const actions = this.querySelector('.msg-actions'); if(actions) actions.style.display='none';">
            ${escapeHTML(msg.content)}
            ${isMine ? `
            <div class="msg-actions" style="display:none; gap:8px; margin-top:4px; justify-content:flex-end;">
                <button onclick="window.editDirectMessage('${msg.id}', '${escapeHTML(msg.content).replace(/'/g, "\\'")}')" style="background:transparent; color:inherit; opacity:0.8; border:none; cursor:pointer; display:flex; align-items:center; font-size:0.8rem;"><i class="fas fa-edit"></i></button>
                <button onclick="window.deleteDirectMessage('${msg.id}')" style="background:transparent; color:inherit; opacity:0.8; border:none; cursor:pointer; display:flex; align-items:center; font-size:0.8rem;"><i class="fas fa-trash"></i></button>
            </div>
            ` : ''}
        </div>
    `;

    if (appendToExisting) {
        scrollToBottom();
    }
}

function scrollToBottom() {
    const div = document.getElementById('chat-messages');
    div.scrollTop = div.scrollHeight;
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

window.deleteDirectMessage = async (msgId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const { error } = await supabase.from('messages').delete().eq('id', msgId).eq('sender_id', currentUser.id);
    if (error) {
        alert('Failed to delete message: ' + error.message);
    } else {
        await loadChatHistory(activeContact.id);
    }
};

window.editDirectMessage = async (msgId, currentContent) => {
    const newContent = prompt('Edit your message:', currentContent);
    if (newContent === null || newContent.trim() === '' || newContent === currentContent) return;
    
    const { error } = await supabase.from('messages').update({ content: newContent }).eq('id', msgId).eq('sender_id', currentUser.id);
    if (error) {
        alert('Failed to edit message: ' + error.message);
    } else {
        await loadChatHistory(activeContact.id);
    }
};
