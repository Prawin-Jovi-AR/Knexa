import { supabase } from './supabase-config.js';
import { getAuthenticatedUser } from './auth.js';

let currentUser = null;

let sharedSkills = [];
let learningSkills = [];
let exploringSkills = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await getAuthenticatedUser();
        if (!currentUser) return;

        await fetchAllSkills();
    } catch (error) {
        console.error('[KNEXA ERROR]', error);
        alert('Failed to load Skill DNA.');
    }

    document.getElementById('form-add-shared').addEventListener('submit', async (e) => {
        e.preventDefault();
        const skill = {
            user_id: currentUser.id,
            skill_name: document.getElementById('shared-name').value,
            category: document.getElementById('shared-category').value,
            experience_level: document.getElementById('shared-level').value,
            confidence: parseInt(document.getElementById('shared-confidence').value),
            years_of_experience: parseInt(document.getElementById('shared-years').value)
        };
        await addSkill('skills_shared', skill);
        document.getElementById('form-add-shared').reset();
        document.getElementById('modal-add-shared').classList.add('hidden');
    });

    document.getElementById('form-add-learning').addEventListener('submit', async (e) => {
        e.preventDefault();
        const skill = {
            user_id: currentUser.id,
            skill_name: document.getElementById('learning-name').value,
            category: document.getElementById('learning-category').value,
            progress: parseInt(document.getElementById('learning-progress').value),
            learning_goal: document.getElementById('learning-goal').value
        };
        await addSkill('skills_learning', skill);
        document.getElementById('form-add-learning').reset();
        document.getElementById('modal-add-learning').classList.add('hidden');
    });

    document.getElementById('form-add-exploring').addEventListener('submit', async (e) => {
        e.preventDefault();
        const skill = {
            user_id: currentUser.id,
            skill_name: document.getElementById('exploring-name').value,
            category: document.getElementById('exploring-category').value,
            reason_for_interest: document.getElementById('exploring-reason').value
        };
        await addSkill('skills_exploring', skill);
        document.getElementById('form-add-exploring').reset();
        document.getElementById('modal-add-exploring').classList.add('hidden');
    });
});

async function fetchAllSkills() {
    try {
        const [shared, learning, exploring] = await Promise.all([
            supabase.from('skills_shared').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
            supabase.from('skills_learning').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
            supabase.from('skills_exploring').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })
        ]);

        sharedSkills = shared.data || [];
        learningSkills = learning.data || [];
        exploringSkills = exploring.data || [];

        renderAll();
    } catch (error) {
        console.error("Error fetching skills:", error);
    }
}

async function addSkill(tableName, data) {
    const { error } = await supabase.from(tableName).upsert([data], { onConflict: 'user_id, skill_name' });
    if (error) {
        alert("Error adding skill: " + error.message);
    } else {
        await fetchAllSkills();
    }
}

window.deleteSkill = async function(tableName, id) {
    if (!confirm("Are you sure you want to delete this skill?")) return;
    
    const { data, error } = await supabase.from(tableName).delete().eq('id', id).select();
    if (error) {
        alert("Error deleting skill: " + error.message);
    } else if (!data || data.length === 0) {
        alert("Action blocked. You can only delete your own skills. Please refresh the page.");
    } else {
        await fetchAllSkills();
    }
}

function renderAll() {
    renderShared();
    renderLearning();
    renderExploring();
    calculateAndRenderDNA();
}

function renderShared() {
    const grid = document.getElementById('grid-shared');
    if (sharedSkills.length === 0) {
        grid.innerHTML = '<p class="empty-state">You haven\'t added any skills you can share yet.</p>';
        return;
    }

    grid.innerHTML = sharedSkills.map(skill => `
        <div class="skill-card">
            <div class="skill-category">${skill.category}</div>
            <h3 style="margin-top:0.5rem; margin-bottom: 0.25rem;">${skill.skill_name}</h3>
            <p style="color:var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
                ${skill.experience_level} • ${skill.years_of_experience} yrs
            </p>
            <div style="font-size: 0.875rem; margin-bottom: 1rem;">
                Confidence: <strong>${skill.confidence}%</strong>
            </div>
            <div class="skill-action-btns">
                <button class="btn btn-outline btn-small" onclick="openAIPane('${skill.skill_name.replace(/'/g, "\\'")}', '${skill.category.replace(/'/g, "\\'")}')"><i class="fas fa-magic"></i> AI Insights</button>
                <button class="btn btn-outline btn-small" onclick="deleteSkill('skills_shared', '${skill.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function renderLearning() {
    const grid = document.getElementById('grid-learning');
    if (learningSkills.length === 0) {
        grid.innerHTML = '<p class="empty-state">You aren\'t learning any new skills yet.</p>';
        return;
    }

    grid.innerHTML = learningSkills.map(skill => `
        <div class="skill-card">
            <div class="skill-category">${skill.category}</div>
            <h3 style="margin-top:0.5rem; margin-bottom: 0.25rem;">${skill.skill_name}</h3>
            <p style="color:var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
                Goal: ${skill.learning_goal}
            </p>
            <div style="margin-bottom: 1rem;">
                <div style="display:flex; justify-content:space-between; font-size: 0.875rem; margin-bottom:0.25rem;">
                    <span>Progress</span>
                    <span>${skill.progress}%</span>
                </div>
                <div class="progress-bar-container" style="height: 6px; margin-bottom:0;">
                    <div class="progress-bar-fill" style="width: ${skill.progress}%;"></div>
                </div>
            </div>
            <div class="skill-action-btns">
                <button class="btn btn-outline btn-small" onclick="openAIPane('${skill.skill_name.replace(/'/g, "\\'")}', '${skill.category.replace(/'/g, "\\'")}')"><i class="fas fa-magic"></i> AI Insights</button>
                <button class="btn btn-outline btn-small" onclick="deleteSkill('skills_learning', '${skill.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function renderExploring() {
    const grid = document.getElementById('grid-exploring');
    if (exploringSkills.length === 0) {
        grid.innerHTML = '<p class="empty-state">You haven\'t added any skills you want to explore.</p>';
        return;
    }

    grid.innerHTML = exploringSkills.map(skill => `
        <div class="skill-card">
            <div class="skill-category">${skill.category}</div>
            <h3 style="margin-top:0.5rem; margin-bottom: 0.25rem;">${skill.skill_name}</h3>
            <p style="color:var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">
                <strong>Why:</strong> ${skill.reason_for_interest}
            </p>
            <div class="skill-action-btns">
                <button class="btn btn-outline btn-small" onclick="openAIPane('${skill.skill_name.replace(/'/g, "\\'")}', '${skill.category.replace(/'/g, "\\'")}')"><i class="fas fa-magic"></i> AI Insights</button>
                <button class="btn btn-outline btn-small" onclick="deleteSkill('skills_exploring', '${skill.id}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

function calculateAndRenderDNA() {
    let score = 0; 
    
    const sCount = sharedSkills.length;
    score += Math.min(50, sCount * 10);
    
    const lCount = learningSkills.length;
    score += Math.min(40, lCount * 10);
    
    const eCount = exploringSkills.length;
    score += Math.min(10, eCount * 5);
    
    score = Math.min(100, score);
    
    let avgProgress = 0;
    if (learningSkills.length > 0) {
        const total = learningSkills.reduce((acc, curr) => acc + curr.progress, 0);
        avgProgress = Math.round(total / learningSkills.length);
    }

    document.getElementById('dna-completion-text').innerText = score + '%';
    document.getElementById('dna-completion-bar').style.width = score + '%';
    
    document.getElementById('stat-shared').innerText = sharedSkills.length;
    document.getElementById('stat-learning').innerText = learningSkills.length;
    document.getElementById('stat-exploring').innerText = exploringSkills.length;
    document.getElementById('stat-avg-progress').innerText = avgProgress + '%';
}

window.openAIPane = async function(skillName, category = '') {
    document.getElementById('modal-ai-insights').classList.remove('hidden');
    const contentDiv = document.getElementById('ai-insight-content');
    contentDiv.innerHTML = `<span style="color:var(--color-primary);"><i class="fas fa-circle-notch fa-spin"></i> Fetching Wikipedia summary for ${skillName}...</span>`;
    
    const promptText = `Provide a brief analysis of the skill "${skillName}". Provide three structured sections: "Key Strengths", "Suggested Learning Path" (with 3 numbered steps), and a concrete "Next Step". Format it nicely and don't make it too long.`;
    
    let text = '';
    if (window.generateDynamicAIInsight) {
        text = await window.generateDynamicAIInsight(promptText, skillName, category);
    } else {
        text = `[AI Insight: ${skillName}]\n${skillName} is a specialized capability that adds unique value to your professional toolkit.`;
    }
    
    window.currentTypeWriterId = (window.currentTypeWriterId || 0) + 1;
    typeWriterEffect(contentDiv, text, 0, window.currentTypeWriterId);
}

function typeWriterEffect(element, text, index, writerId) {
    if (window.currentTypeWriterId !== writerId) return;
    
    if (index === 0) {
        element.innerHTML = '';
    }
    if (index < text.length) {
        if (text.charAt(index) === '<') {
            let endIndex = text.indexOf('>', index);
            if (endIndex !== -1) {
                element.innerHTML += text.substring(index, endIndex + 1);
                setTimeout(() => typeWriterEffect(element, text, endIndex + 1, writerId), 15);
                return;
            }
        }
        element.innerHTML += text.charAt(index);
        setTimeout(() => typeWriterEffect(element, text, index + 1, writerId), 15);
    }
}
