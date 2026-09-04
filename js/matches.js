import { supabase } from './supabase-config.js';
import { fetchMySkills, calculateAllMatches } from './matching-engine.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;
let mySkills = { shared: [], learning: [], exploring: [] };
let allMatches = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('[KNEXA] Page initialized');
        console.log('[KNEXA] Session checked');
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;
        console.log('[KNEXA] User detected');

        document.getElementById('empty-state').classList.add('hidden');
        const errState = document.getElementById('error-state');
        if (errState) errState.classList.add('hidden');
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('matches-grid').innerHTML = '';
        
        console.log('[KNEXA] Data request started');

        mySkills = await fetchMySkills(currentUser.id);
        const totalSkills = mySkills.shared.length + mySkills.learning.length + mySkills.exploring.length;
        if (totalSkills < 3) {
            document.getElementById('incomplete-dna-banner').classList.remove('hidden');
        }

        allMatches = await calculateAllMatches(currentUser);
        
        const { data: connections } = await supabase.from('connections').select('requester_id, receiver_id, status').or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
        window.myConnections = (connections || []).reduce((acc, c) => {
            const otherId = c.requester_id === currentUser.id ? c.receiver_id : c.requester_id;
            acc[otherId] = { status: c.status, amIRequester: c.requester_id === currentUser.id };
            return acc;
        }, {});
        
        console.log('[KNEXA] Data received');

        finishLoading(allMatches.length === 0);
        renderMatches();
        console.log('[KNEXA] Rendering completed');

        document.getElementById('search-matches').addEventListener('input', renderMatches);
        document.getElementById('filter-category').addEventListener('change', renderMatches);
        document.getElementById('sort-matches').addEventListener('change', renderMatches);
        
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        finishLoading(false, true, error);
    } finally {
        console.log('[KNEXA] Loading finished');
        document.getElementById('loading-state').classList.add('hidden');
    }
});

function finishLoading(isEmpty, isError = false, error = null) {
    document.getElementById('loading-state').classList.add('hidden');
    
    if (isError) {
        const errState = document.getElementById('error-state');
        if (errState) {
            errState.classList.remove('hidden');
            if (error && error.message) {
                const errText = document.getElementById('error-message-text');
                if (errText) errText.innerText = error.message;
            }
        }
    } else if (isEmpty) {
        document.getElementById('empty-state').classList.remove('hidden');
    }
}

function renderMatches() {
    const grid = document.getElementById('matches-grid');
    const searchTerm = document.getElementById('search-matches').value.toLowerCase();
    const filterCat = document.getElementById('filter-category').value;
    const sortVal = document.getElementById('sort-matches').value;

    let filtered = allMatches.filter(m => {
        const searchStr = `${m.profile.full_name} ${m.profile.username} ${m.teachThem} ${m.learnFromThem} ${m.reasons.join(' ')}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm)) return false;

        if (filterCat !== 'All') {
            if (filterCat === 'Perfect' && !m.category.text.includes('Perfect')) return false;
            if (filterCat === 'Learning' && !m.category.text.includes('Learning')) return false;
            if (filterCat === 'Community' && !m.category.text.includes('Community')) return false;
        }
        return true;
    });

    if (sortVal === 'Highest') {
        filtered.sort((a, b) => b.score - a.score);
    } else {
        filtered.reverse(); 
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">No matches fit your search criteria.</p>';
        return;
    }

    grid.innerHTML = filtered.map(m => {
        let btnText = 'Connect';
        let btnDisabled = '';
        let btnOnClick = `window.handleConnect(event, '${m.profile.id}')`;
        if (window.myConnections && window.myConnections[m.profile.id]) {
            const conn = window.myConnections[m.profile.id];
            if (conn.status === 'accepted') {
                btnText = 'Connected';
                btnDisabled = 'disabled';
            } else if (conn.status === 'pending') {
                if (conn.amIRequester) {
                    btnText = 'Pending';
                    btnDisabled = 'disabled';
                } else {
                    btnText = 'Accept';
                    btnOnClick = `window.handleAccept(event, '${m.profile.id}')`;
                }
            }
        }

        let teachText = m.teachThem;
        if (teachText === 'Nothing currently') {
            if (m.allLearning && m.allLearning.length > 0) {
                teachText = m.allLearning.slice(0, 2).join(', ') + (m.allLearning.length > 2 ? ', ...' : '');
            } else {
                teachText = 'Nothing currently';
            }
        }

        let learnText = m.learnFromThem;
        if (learnText === 'Nothing currently') {
            if (m.allShared && m.allShared.length > 0) {
                learnText = m.allShared.slice(0, 2).join(', ') + (m.allShared.length > 2 ? ', ...' : '');
            } else {
                learnText = 'Nothing currently';
            }
        }

        const isConnected = window.myConnections && window.myConnections[m.profile.id] && window.myConnections[m.profile.id].status === 'accepted';
        const displayName = isConnected ? (m.profile.full_name || 'Anonymous') : 'Hidden User';
        const displayAvatar = isConnected ? (m.profile.full_name ? m.profile.full_name.charAt(0) : '?') : '?';
        const displayUsername = isConnected ? ('@' + (m.profile.username || 'user')) : '@hidden';

        return `
        <div class="match-card">
            <div class="match-header">
                <div class="match-avatar">${displayAvatar}</div>
                <div class="match-info">
                    <h3>${displayName}</h3>
                    <p>${displayUsername} • ${m.profile.country || 'Global'}</p>
                </div>
                <div class="match-score-badge">
                    <div class="score">${m.score}%</div>
                    <div class="label">Match</div>
                </div>
            </div>
            
            <div class="match-body">
                <div class="match-category-badge ${m.category.class}">
                    <i class="fas ${m.category.icon}"></i> ${m.category.text}
                </div>

                <div class="match-exchange-section">
                    <div class="exchange-block">
                        <h4>You can teach</h4>
                        <p>${teachText}</p>
                    </div>
                    <div class="exchange-block">
                        <h4>They can teach</h4>
                        <p>${learnText}</p>
                    </div>
                </div>

                <div class="match-why">
                    <h4>Why you match:</h4>
                    <ul>
                        ${m.reasons.map(r => `<li><i class="fas fa-check"></i> ${r}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="match-actions">
                <a href="user.html?id=${m.profile.id}" class="btn btn-outline" style="text-align:center;">View Profile</a>
                <button class="btn btn-primary" onclick="${btnOnClick}" ${btnDisabled}>${btnText}</button>
            </div>
        </div>
    `;
    }).join('');
}

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
    
    window.myConnections[targetId] = { status: 'pending', amIRequester: true };
    
    if (button) button.innerText = 'Pending';
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
        
    if (window.myConnections[targetId]) {
        window.myConnections[targetId].status = 'accepted';
    }
    
    if (button) {
        button.innerText = 'Connected';
    }
};
