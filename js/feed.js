import { supabase } from './supabase-config.js';
import { calculateAllMatches } from './matching-engine.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (profileError) console.error("Error loading profile:", profileError);
        
        if (profile) {
            currentProfile = profile;
            const name = profile.full_name || 'Anonymous';
            document.getElementById('feed-name').innerText = name;
            document.getElementById('feed-username').innerText = '@' + (profile.username || 'user');
            document.getElementById('feed-avatar').innerText = name.charAt(0).toUpperCase();
        }

        await loadMatchesWidget();

        await loadFeed();
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        document.getElementById('feed-stream').innerHTML = '<div style="color:var(--color-danger); padding:2rem; text-align:center;">Failed to load feed. Please try again later.</div>';
    }

    document.getElementById('post-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('post-content').value;
        const category = document.getElementById('post-category').value;
        const btn = document.getElementById('btn-submit-post');
        
        btn.innerText = 'Posting...';
        btn.disabled = true;

        const { error } = await supabase.from('posts').insert([{
            user_id: currentUser.id,
            content: content,
            category: category
        }]);

        if (error) {
            alert('Error creating post: ' + error.message);
        } else {
            document.getElementById('post-content').value = '';
            loadFeed();
        }

        btn.innerText = 'Post';
        btn.disabled = false;
    });
});

async function loadFeed() {
    const stream = document.getElementById('feed-stream');
    
    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (!posts || posts.length === 0) {
            stream.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--color-text-muted);">No posts yet. Be the first to share your knowledge!</div>`;
            return;
        }

    const userIds = [...new Set(posts.map(p => p.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds);
    
    const profileMap = {};
    if (profiles) {
        profiles.forEach(p => profileMap[p.id] = p);
    }

    stream.innerHTML = posts.map(post => {
        const author = profileMap[post.user_id] || { full_name: 'Unknown User', username: 'unknown' };
        const date = new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
        
        let avatarHtml = `<div class="post-avatar">${author.full_name.charAt(0).toUpperCase()}</div>`;


        let actionsHtml = '';
        if (post.user_id === currentUser.id) {
            actionsHtml = `
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline btn-small" onclick="editPost('${post.id}', '${escapeHTML(post.content).replace(/'/g, "\\'")}')" title="Edit Post" style="border:none; color:var(--color-primary); padding:0.25rem;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline btn-small" onclick="deletePost('${post.id}')" title="Delete Post" style="border:none; color:var(--color-danger, #ef4444); padding:0.25rem;"><i class="fas fa-trash"></i></button>
            </div>`;
        }

        return `
            <div class="post-card" id="post-${post.id}">
                <div class="post-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; gap:1rem;">
                        ${avatarHtml}
                        <div class="post-meta">
                            <a href="user.html?id=${post.user_id}" style="text-decoration:none; color:inherit;"><h4>${author.full_name}</h4></a>
                            <p>@${author.username} • ${date}</p>
                        </div>
                    </div>
                    ${actionsHtml}
                </div>
                <div class="post-content" id="post-content-${post.id}">${escapeHTML(post.content)}</div>
                <div class="post-category-tag">${post.category || 'General'}</div>
            </div>
        `;
    }).join('');
    } catch (err) {
        console.error('[KNEXA ERROR]', err);
        stream.innerHTML = '<div style="color:var(--color-danger); padding:2rem; text-align:center;">Failed to load feed posts.</div>';
    }
}

async function loadMatchesWidget() {
    const widget = document.getElementById('feed-matches-widget');
    const allMatches = await calculateAllMatches(currentUser);
    const topMatches = allMatches.slice(0, 3);

    if (topMatches.length === 0) {
        widget.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.875rem;">Add more skills to find matches.</p>';
        return;
    }

    widget.innerHTML = topMatches.map(m => `
        <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom: 1rem;">
            <div style="width:36px; height:36px; border-radius:50%; background:var(--gradient-primary); color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; font-size:0.875rem;">
                ${(m.profile.full_name || 'U').charAt(0)}
            </div>
            <div style="flex:1;">
                <a href="user.html?id=${m.profile.id}" style="text-decoration:none; color:inherit;"><h4 style="margin:0; font-size:0.875rem;">${m.profile.full_name}</h4></a>
                <p style="margin:0; font-size:0.75rem; color:var(--color-text-muted);">${m.score}% Match</p>
            </div>
        </div>
    `).join('');
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

window.deletePost = async function(postId) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    
    try {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) throw error;
        
        const postElement = document.getElementById('post-' + postId);
        if (postElement) {
            postElement.remove();
        }
        
        if (document.getElementById('feed-stream').children.length === 0) {
            document.getElementById('feed-stream').innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--color-text-muted);">No posts yet. Be the first to share your knowledge!</div>`;
        }
    } catch (err) {
        console.error("Error deleting post:", err);
        alert("Could not delete post.");
    }
}

window.editPost = async function(postId, currentContent) {
    const newContent = prompt("Edit your post:", currentContent);
    if (newContent === null || newContent.trim() === '' || newContent === currentContent) return;
    
    try {
        const { error } = await supabase.from('posts').update({ content: newContent }).eq('id', postId);
        if (error) throw error;
        
        const contentEl = document.getElementById('post-content-' + postId);
        if (contentEl) {
            contentEl.innerText = newContent;
        }
    } catch (err) {
        console.error("Error editing post:", err);
        alert("Could not edit post.");
    }
}
