import { fetchMySkills, calculateAllMatches } from './matching-engine.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let activeTab = 'people';
let searchTimeout = null;

let allProfiles = [];
let allSkills = [];
let allPosts = [];
let allCommunities = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await getAuthenticatedUser();
    if (!currentUser) return;

    bindTabs();
    bindSearch();
    bindFilters();
    bindModal();

    try {
        await loadInitialData();
        renderFilters();
    } catch (e) {
        console.error('[KNEXA ERROR]', e);
        showError(e);
    }
});

function bindTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;

            renderFilters();
            performSearch();
        });
    });
}

function bindSearch() {
    const searchInput = document.getElementById('discover-search');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    });

    document.querySelectorAll('.search-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            searchInput.value = chip.innerText;
            performSearch();
        });
    });
}

function bindFilters() {
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
        performSearch();
    });

    document.getElementById('btn-empty-clear').addEventListener('click', () => {
        document.getElementById('discover-search').value = '';
        document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
        performSearch();
    });

    document.getElementById('sort-select').addEventListener('change', performSearch);
}

function bindModal() {
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('skill-request-modal').classList.add('hidden');
    });

    document.getElementById('close-ai-insights').addEventListener('click', () => {
        document.getElementById('modal-ai-insights').classList.add('hidden');
    });

    document.getElementById('discover-grid').addEventListener('click', (event) => {
        const button = event.target.closest('[data-ai-skill]');
        if (button) openDiscoverAIInsights(button.dataset.aiSkill, button.dataset.aiCategory);
    });

    document.getElementById('skill-request-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetId = document.getElementById('req-target-id').value;
        const skillName = document.getElementById('req-skill-name').value;
        const msg = document.getElementById('req-message').value;
        const btn = document.getElementById('btn-submit-request');

        btn.innerText = 'Sending...';
        btn.disabled = true;

        const { error } = await supabase.from('skill_requests').insert([{
            requester_id: currentUser.id,
            receiver_id: targetId,
            requested_skill: skillName,
            message: msg
        }]);

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Skill request sent successfully!');
            document.getElementById('skill-request-modal').classList.add('hidden');
        }

        btn.innerText = 'Send Request';
        btn.disabled = false;
    });
}

function renderFilters() {
    const container = document.getElementById('filter-content');
    const sidebar = document.getElementById('filter-sidebar');
    let html = '';

    if (activeTab === 'communities') {
        if (sidebar) sidebar.style.display = 'none';
        container.innerHTML = '';
        return;
    } else {
        if (sidebar) sidebar.style.display = 'block';
    }

    if (activeTab === 'people') {
        const uniqueCountries = [...new Set(allProfiles.map(p => p.country).filter(Boolean))].sort();
        let countryHTML = uniqueCountries.map(country =>
            `<label class="filter-option"><input type="checkbox" class="filter-checkbox" value="${country}"> ${country}</label>`
        ).join('\n                ');

        if (uniqueCountries.length === 0) {
            countryHTML = '<p style="color:var(--color-text-muted);font-size:0.875rem;">No countries found</p>';
        }

        html = `
            <div class="filter-group">
                <h4>Country</h4>
                ${countryHTML}
            </div>
        `;
    } else if (activeTab === 'skills') {
        html = `
            <div class="filter-group">
                <h4>Category</h4>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Technology"> Technology</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Design"> Design</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Business"> Business</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Science"> Science</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Arts"> Arts</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Other"> Other</label>
            </div>
        `;
    } else if (activeTab === 'knowledge') {
        html = `
            <div class="filter-group">
                <h4>Type</h4>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Question"> Question</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Resource"> Resource</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Article"> Article</label>
                <label class="filter-option"><input type="checkbox" class="filter-checkbox" value="Discussion"> Discussion</label>
            </div>
        `;
    }

    container.innerHTML = html;

    document.querySelectorAll('.filter-checkbox').forEach(cb => {
        cb.addEventListener('change', performSearch);
    });
}


async function loadInitialData() {
    showLoading();
    const { data: profiles, error } = await supabase.from('profiles').select('*').neq('id', currentUser.id).limit(50);
    if (error) throw error;
    allProfiles = profiles || [];

    const { data: connections } = await supabase.from('connections').select('requester_id, receiver_id, status').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    window.myConnections = (connections || []).reduce((acc, c) => {
        const otherId = c.requester_id === currentUser.id ? c.receiver_id : c.requester_id;
        acc[otherId] = { status: c.status, amIRequester: c.requester_id === currentUser.id };
        return acc;
    }, {});

    await performSearch();
}

function showLoading() {
    console.log('[KNEXA] Data request started');
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    const errState = document.getElementById('error-state');
    if (errState) errState.classList.add('hidden');
    document.getElementById('discover-grid').innerHTML = '';
}

function showError(err) {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    const errState = document.getElementById('error-state');
    if (errState) {
        errState.classList.remove('hidden');
        if (err && err.message) {
            const errText = document.getElementById('error-message-text');
            if (errText) errText.innerText = err.message;
        }
    }
}

async function performSearch() {
    showLoading();
    try {
        const query = document.getElementById('discover-search').value.toLowerCase().trim();

        const checkedFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.value);

        const sortValue = document.getElementById('sort-select').value;
        let html = '';

        if (activeTab === 'people') {
            html = await renderPeople(query, checkedFilters, sortValue);
        } else if (activeTab === 'skills') {
            html = await renderSkills(query, checkedFilters, sortValue);
        } else if (activeTab === 'knowledge') {
            html = await renderKnowledge(query, checkedFilters, sortValue);
        } else if (activeTab === 'communities') {
            html = await renderCommunities(query, sortValue);
        }

        console.log('[KNEXA] Rendering completed');
        const grid = document.getElementById('discover-grid');

        if (activeTab === 'knowledge') {
            grid.style.display = 'flex';
            grid.style.flexDirection = 'column';
            grid.style.gap = '1.5rem';
        } else if (activeTab === 'communities') {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
            grid.style.gap = '1.5rem';
            grid.style.flexDirection = '';
        } else {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
            grid.style.gap = '1.5rem';
            grid.style.flexDirection = '';
        }

        grid.style.flexWrap = '';
        grid.style.overflowX = '';
        grid.style.paddingBottom = '';

        document.getElementById('loading-state').classList.add('hidden');
        if (!html) {
            document.getElementById('empty-state').classList.remove('hidden');
            grid.innerHTML = '';
        } else {
            document.getElementById('empty-state').classList.add('hidden');
            grid.innerHTML = html;
        }
    } catch (err) {
        console.error('[KNEXA ERROR]', err);
        showError(err);
    } finally {
        console.log('[KNEXA] Loading finished');
        document.getElementById('loading-state').classList.add('hidden');
    }
}

async function renderPeople(query, filters, sortValue) {
    document.getElementById('results-heading').innerText = query ? 'Search Results' : 'Recommended For You';

    const allMatches = await calculateAllMatches(currentUser);
    let results = allMatches;

    if (query) {
        results = results.filter(m =>
            (m.profile.full_name && m.profile.full_name.toLowerCase().includes(query)) ||
            (m.profile.username && m.profile.username.toLowerCase().includes(query)) ||
            (m.teachThem && m.teachThem.toLowerCase().includes(query)) ||
            (m.learnFromThem && m.learnFromThem.toLowerCase().includes(query)) ||
            (m.allShared && m.allShared.some(s => s.toLowerCase().includes(query))) ||
            (m.allLearning && m.allLearning.some(s => s.toLowerCase().includes(query)))
        );
    }

    if (filters && filters.length > 0) {
        results = results.filter(m => filters.includes(m.profile.country));
    }

    if (sortValue === 'most_followers') {
        results.sort((a, b) => (b.profile.followers_count || 0) - (a.profile.followers_count || 0));
    } else if (sortValue === 'recent') {
        results.sort((a, b) => new Date(b.profile.created_at) - new Date(a.profile.created_at));
    } else if (sortValue === 'highest_match') {
        results.sort((a, b) => b.score - a.score);
    } else {
        results.sort((a, b) => b.score - a.score);
    }

    if (results.length === 0) return '';

    return results.map(m => {
        let avatarHtml = `<div class="match-avatar">${(m.profile.full_name || 'U').charAt(0).toUpperCase()}</div>`;

        let btnText = 'Connect';
        let btnAction = `window.handleConnect(event, '${m.profile.id}')`;
        if (window.myConnections && window.myConnections[m.profile.id]) {
            const conn = window.myConnections[m.profile.id];
            if (conn.status === 'accepted') {
                btnText = 'Disconnect';
                btnAction = `window.handleDisconnect(event, '${m.profile.id}')`;
            } else {
                if (conn.amIRequester) {
                    btnText = 'Cancel Request';
                    btnAction = `window.handleDisconnect(event, '${m.profile.id}')`;
                } else {
                    btnText = 'Accept';
                    btnAction = `window.handleAccept(event, '${m.profile.id}')`;
                }
            }
        }

        return `
        <div class="match-card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div class="match-header">
                ${avatarHtml}
                <div class="match-info">
                    <h3>${m.profile.full_name || 'Unknown'}</h3>
                    <p>@${m.profile.username} â€¢ ${m.profile.country || 'Global'}</p>
                </div>
                <div class="match-score-badge">
                    <div class="score">${m.score}%</div>
                    <div class="label">Match</div>
                </div>
            </div>
            <div class="match-body" style="padding: 1.5rem; flex:1;">
                <p style="font-size: 0.875rem; margin-bottom: 0.5rem;"><strong>Can Share / Teach:</strong> ${m.allShared.length > 0 ? m.allShared.join(', ') : 'Nothing listed'}</p>
                <p style="font-size: 0.875rem; margin-bottom: 1rem;"><strong>Learning:</strong> ${m.allLearning.length > 0 ? m.allLearning.join(', ') : 'Nothing listed'}</p>
                <button class="btn btn-outline btn-full" onclick="window.toggleWhy('${m.profile.id}')" style="font-size:0.75rem; padding:0.5rem;">Why this person? <i class="fas fa-chevron-down"></i></button>
                
                <div class="person-card-expand" id="why-${m.profile.id}">
                    <h4 style="font-size: 0.75rem; margin-bottom: 0.5rem; color:var(--color-primary);">MATCH REASONS</h4>
                    <ul style="list-style:none; padding:0; margin:0; font-size: 0.75rem;">
                        ${m.reasons.map(r => `<li style="margin-bottom:0.25rem;"><i class="fas fa-check" style="color:var(--color-primary);"></i> ${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="match-actions" style="padding: 1.5rem; border-top: 1px solid var(--color-border); display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
                <a href="user.html?id=${m.profile.id}" class="btn btn-outline" style="text-align:center; padding:0.5rem; font-size:0.875rem;">Profile</a>
                <button class="btn btn-primary" onclick="${btnAction}" style="padding:0.5rem; font-size:0.875rem;">${btnText}</button>
                <button class="btn btn-outline btn-full" style="grid-column: 1/-1; padding:0.5rem; font-size:0.875rem;" onclick="window.openSkillRequest('${m.profile.id}', '${m.profile.full_name}', '${m.allShared[0] || ''}')">Request Skill</button>
            </div>
        </div>
    `;
    }).join('');
}

async function renderSkills(query, filters, sortValue) {
    document.getElementById('results-heading').innerText = 'Explore Skills';

    const { data: skills } = await supabase.from('skills_shared').select('skill_name, category');

    if (!skills || skills.length === 0) return '';

    const uniqueSkills = {};
    skills.forEach(s => {
        const key = s.skill_name.toLowerCase();
        if (!uniqueSkills[key]) uniqueSkills[key] = { name: s.skill_name, cat: s.category, count: 0 };
        uniqueSkills[key].count++;
    });

    let results = Object.values(uniqueSkills);
    if (query) {
        results = results.filter(s => s.name.toLowerCase().includes(query));
    }

    if (filters && filters.length > 0) {
        results = results.filter(s => filters.includes(s.cat));
    }

    if (sortValue === 'highest_match' || sortValue === 'most_followers') {
        results.sort((a, b) => b.count - a.count);
    } else {
        results.sort((a, b) => b.count - a.count);
    }

    if (results.length === 0) return '';

    return results.map(s => `
        <div class="auth-card" style="padding: 1.5rem; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
                <h3 style="margin-bottom: 0.25rem;">${s.name}</h3>
                <span class="post-category-tag">${s.cat || 'General'}</span>
            </div>
            <div style="margin-top: 1.5rem;">
                <p style="font-size:0.875rem; color:var(--color-text-muted); margin-bottom:1rem;"><i class="fas fa-users"></i> ${s.count} people sharing</p>
                <div style="display:grid; grid-template-columns:1fr; gap:0.5rem;">
                    <button class="btn btn-primary" onclick="window.exploreSkill('${(s.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${(s.cat || 'General').replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">Explore Skill</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openDiscoverAIInsights(skillName, category) {
    const modal = document.getElementById('modal-ai-insights');
    const content = document.getElementById('ai-insight-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<span style="color:var(--color-primary);"><i class="fas fa-circle-notch fa-spin"></i> Analyzing ${escapeHTML(skillName)} with AI Engine...</span>`;

    setTimeout(() => {
        content.innerText = generateDiscoverAIInsight(skillName, category);
    }, 700);
}

function generateDiscoverAIInsight(skillName, category = 'General') {
    const skill = skillName.toLowerCase();
    if (skill.includes('python')) {
        return `[AI Insight: ${skillName}]\nDetected focus: programming and automation.\n\nWhy it matters:\n${skillName} is useful for scripting, backend services, data workflows, and machine learning.\n\nSuggested path:\n1. Strengthen core syntax and data structures.\n2. Build one practical automation project.\n3. Add a domain library such as Pandas, Flask, or PyTorch.`;
    }
    if (skill.includes('react') || skill.includes('javascript') || skill.includes('typescript')) {
        return `[AI Insight: ${skillName}]\nDetected focus: interactive web development.\n\nKey strengths:\nComponent thinking, user interaction, and asynchronous data handling are central to this skill.\n\nSuggested path:\nBuild a responsive feature, add loading and error states, then publish it with a short technical walkthrough.`;
    }
    if (skill.includes('machine learning') || skill.includes('data science') || skill.includes('analytics')) {
        return `[AI Insight: ${skillName}]\nDetected focus: data-driven problem solving.\n\nKey strengths:\nThis skill turns raw information into predictions, explanations, and better decisions.\n\nSuggested path:\nPractice data cleaning, evaluate a baseline model, and explain the result with a clear visual story.`;
    }
    if (skill.includes('design') || skill.includes('ui') || skill.includes('ux')) {
        return `[AI Insight: ${skillName}]\nDetected focus: user experience and visual communication.\n\nKey strengths:\nThis skill connects user research, interaction patterns, accessibility, and visual hierarchy.\n\nSuggested path:\nStudy a real product, redesign one flow, test it with users, and document the decision behind each change.`;
    }
    if (skill.includes('photo') || skill.includes('video') || skill.includes('film')) {
        return `[AI Insight: ${skillName}]\nDetected focus: visual storytelling.\n\nKey strengths:\nComposition, light, timing, and editing help turn an observation into a memorable story.\n\nSuggested path:\nCreate a focused series, review it for consistency, and refine one technical choice at a time.`;
    }
    if (skill.includes('speak') || skill.includes('language') || skill.includes('writing')) {
        return `[AI Insight: ${skillName}]\nDetected focus: communication.\n\nKey strengths:\nClear structure, audience awareness, and deliberate practice make this skill transferable across teams and cultures.\n\nSuggested path:\nChoose one audience, prepare a short piece, record or share it, and use feedback to improve clarity.`;
    }
    return `[AI Insight: ${skillName}]\nDetected category: ${category}.\n\nWhat this suggests:\n${skillName} can strengthen your ability to contribute in ${category.toLowerCase()} through focused practice and real projects.\n\nSuggested path:\nStart with one concrete goal, make a small project that demonstrates it, and connect with someone who can give useful feedback.`;
}

async function renderKnowledge(query, filters, sortValue) {
    document.getElementById('results-heading').innerText = 'Knowledge Feed Search';
    
    let req = supabase.from('posts').select('*, profiles(full_name, username)');
    
    if (sortValue === 'recent') {
        req = req.order('created_at', { ascending: false });
    } else {
        req = req.order('created_at', { ascending: false });
    }
    req = req.limit(20);

    if (query) {
        req = req.ilike('content', `%${query}%`);
    }

    const { data: posts } = await req;
    if (!posts || posts.length === 0) return '';

    return posts.map(post => {
        const author = post.profiles || { full_name: 'Unknown User', username: 'unknown' };
        const date = new Date(post.created_at).toLocaleDateString();

        let actionsHtml = '';
        if (post.user_id === currentUser.id) {
            actionsHtml = `
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-outline btn-small" onclick="editDiscoverPost('${post.id}', '${escapeHTML(post.content).replace(/'/g, "\\'")}')" title="Edit Post" style="border:none; color:var(--color-primary); padding:0.25rem;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-outline btn-small" onclick="deleteDiscoverPost('${post.id}')" title="Delete Post" style="border:none; color:var(--color-danger, #ef4444); padding:0.25rem;"><i class="fas fa-trash"></i></button>
            </div>`;
        }

        return `
            <div class="post-card" id="discover-post-${post.id}">
                <div class="post-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="display:flex; gap:1rem;">
                        <div class="post-avatar">${(author.full_name || 'U').charAt(0).toUpperCase()}</div>
                        <div class="post-meta">
                            <h4>${author.full_name}</h4>
                            <p>@${author.username} â€¢ ${date}</p>
                        </div>
                    </div>
                    ${actionsHtml}
                </div>
                <div class="post-content" id="discover-post-content-${post.id}">${escapeHTML(post.content)}</div>
                <div class="post-category-tag">${post.category || 'General'}</div>
            </div>
        `;
    }).join('');
}

async function renderCommunities(query, sortValue) {
    document.getElementById('results-heading').innerText = 'Communities';
    let req = supabase.from('communities').select('*');
    
    if (sortValue === 'recent') {
        req = req.order('created_at', { ascending: false });
    } else {
        req = req.order('created_at', { ascending: false });
    }
    
    req = req.limit(20);

    if (query) {
        req = req.ilike('name', `%${query}%`);
    }

    const { data: comms } = await req;
    if (!comms || comms.length === 0) {
        return `
            <div class="auth-card" style="padding: 2rem; grid-column: 1 / -1; text-align: center;">
                <i class="fas fa-users" style="font-size: 2rem; color: var(--color-primary); margin-bottom: 1rem;"></i>
                <h3>No communities found yet</h3>
                <p style="color: var(--color-text-muted); margin: 0.5rem 0 1.5rem;">Create or join a community to start learning together.</p>
                <a href="communities.html" class="btn btn-primary">Open Communities</a>
            </div>
        `;
    }

    return comms.map(c => `
        <div class="auth-card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
            <div>
                <h3 style="margin-bottom: 0.5rem;">${c.name}</h3>
                <p style="font-size:0.875rem; color:var(--color-text-muted); margin-bottom: 1rem;">${c.description}</p>
                <span class="post-category-tag">${c.category || 'General'}</span>
            </div>
            <a href="communities.html" class="btn btn-primary btn-full" style="margin-top: 1.5rem; text-align:center;">Explore Community</a>
        </div>
    `).join('');
}


window.exploreSkill = async (skillName, category) => {
    const modal = document.getElementById('modal-ai-insights');
    if (!modal) return;
    
    const title = modal.querySelector('h2');
    if (title) title.innerHTML = `<i class="fas fa-search"></i> Explore Skill: ${skillName}`;
    
    const content = modal.querySelector('.ai-insight-content');
    if (content) {
        content.innerHTML = `<div class="loader" style="margin: 2rem auto;"></div>`;
        modal.classList.remove('hidden');
        
        const promptText = `Provide a brief analysis of the skill "${skillName}" (Category: ${category}). Include two sections: "What it is" and "How it performs professionally". Keep it concise and insightful.`;
        
        let insightText = '';
        if (window.generateDynamicAIInsight) {
            insightText = await window.generateDynamicAIInsight(promptText, skillName, category);
        } else {
            insightText = `[Skill Analysis: ${skillName}]\n\nWhat it is:\n${skillName} is a highly sought-after capability within the ${category} domain.\n\nHow it performs:\nProfiles featuring ${skillName} typically see higher engagement.`;
        }
        
        content.innerHTML = `<p style="white-space: pre-wrap; font-size: 0.875rem; line-height: 1.6;">${insightText}</p>`;
    }
};

window.toggleWhy = (id) => {
    const el = document.getElementById(`why-${id}`);
    if (el.classList.contains('open')) {
        el.classList.remove('open');
    } else {
        el.classList.add('open');
    }
};

window.handleConnect = async (event, targetId) => {
    const button = event ? event.currentTarget : document.querySelector(`button[onclick*="window.handleConnect("][onclick*="'${targetId}'"]`);
    if (button) {
        button.innerText = 'Requesting...';
        button.disabled = true;
    }

    const { data } = await supabase.from('connections')
        .select('id').eq('requester_id', currentUser.id).eq('receiver_id', targetId).maybeSingle();

    if (!data) {
        await supabase.from('connections').insert([{
            requester_id: currentUser.id,
            receiver_id: targetId
        }]);

        await supabase.from('followers').insert([{
            follower_id: currentUser.id,
            following_id: targetId
        }]);
    }

    if (window.myConnections) window.myConnections[targetId] = 'pending';

    if (button) {
        button.innerText = 'Cancel Request';
        button.disabled = false;
        button.setAttribute('onclick', `window.handleDisconnect(event, '${targetId}')`);
    }
};

window.handleDisconnect = async (event, targetId) => {
    const button = event ? event.currentTarget : document.querySelector(`button[onclick*="window.handleDisconnect("][onclick*="'${targetId}'"]`);
    if (button) {
        button.innerText = 'Removing...';
        button.disabled = true;
    }
    
    await supabase.from('connections').delete().or(`and(requester_id.eq.${currentUser.id},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${currentUser.id})`);
    await supabase.from('followers').delete().eq('follower_id', currentUser.id).eq('following_id', targetId);
    
    if (window.myConnections) {
        delete window.myConnections[targetId];
    }
    
    if (button) {
        button.innerText = 'Connect';
        button.disabled = false;
        button.setAttribute('onclick', `window.handleConnect(event, '${targetId}')`);
    }
};

window.handleAccept = async (event, targetId) => {
    const button = event ? event.currentTarget : document.querySelector(`button[onclick*="window.handleAccept("][onclick*="'${targetId}'"]`);
    if (button) {
        button.innerText = 'Accepting...';
        button.disabled = true;
    }
    
    await supabase.from('connections')
        .update({ status: 'accepted' })
        .eq('requester_id', targetId)
        .eq('receiver_id', currentUser.id);
        
    if (window.myConnections && window.myConnections[targetId]) {
        window.myConnections[targetId].status = 'accepted';
    }
    
    if (button) {
        button.innerText = 'Disconnect';
        button.disabled = false;
        button.setAttribute('onclick', `window.handleDisconnect(event, '${targetId}')`);
    }
};

window.openSkillRequest = async (targetId, name, skill) => {
    document.getElementById('req-target-id').value = targetId;
    document.getElementById('req-person-name').value = name;
    document.getElementById('req-message').value = '';

    const select = document.getElementById('req-skill-name');
    if (select) {
        select.innerHTML = '<option value="">Loading skills...</option>';
    }

    document.getElementById('skill-request-modal').classList.remove('hidden');

    if (select) {
        const { data: skills } = await supabase.from('skills_shared').select('skill_name').eq('user_id', targetId);
        
        if (skills && skills.length > 0) {
            select.innerHTML = skills.map(s => `<option value="${escapeHTML(s.skill_name)}" ${s.skill_name === skill ? 'selected' : ''}>${escapeHTML(s.skill_name)}</option>`).join('');
            if (skill && !skills.find(s => s.skill_name === skill)) {
                select.innerHTML += `<option value="${escapeHTML(skill)}" selected>${escapeHTML(skill)}</option>`;
            }
        } else {
            select.innerHTML = `<option value="${escapeHTML(skill || 'General')}">${escapeHTML(skill || 'General')}</option>`;
        }
    }
};

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

window.deleteDiscoverPost = async function (postId) {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
        const { error } = await supabase.from('posts').delete().eq('id', postId);
        if (error) throw error;

        const postElement = document.getElementById('discover-post-' + postId);
        if (postElement) {
            postElement.remove();
        }
    } catch (err) {
        console.error("Error deleting post:", err);
        alert("Could not delete post.");
    }
}

window.editDiscoverPost = async function (postId, currentContent) {
    const newContent = prompt("Edit your post:", currentContent);
    if (newContent === null || newContent.trim() === '' || newContent === currentContent) return;

    try {
        const { error } = await supabase.from('posts').update({ content: newContent }).eq('id', postId);
        if (error) throw error;

        const contentEl = document.getElementById('discover-post-content-' + postId);
        if (contentEl) {
            contentEl.innerText = newContent;
        }
    } catch (err) {
        console.error("Error editing post:", err);
        alert("Could not edit post.");
    }
}
