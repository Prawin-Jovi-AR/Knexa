import { supabase } from './supabase-config.js';

export async function fetchMySkills(userId) {
    const [shared, learning, exploring] = await Promise.all([
        supabase.from('skills_shared').select('*').eq('user_id', userId),
        supabase.from('skills_learning').select('*').eq('user_id', userId),
        supabase.from('skills_exploring').select('*').eq('user_id', userId)
    ]);
    return {
        shared: shared.data || [],
        learning: learning.data || [],
        exploring: exploring.data || []
    };
}

export async function calculateAllMatches(currentUser) {
    const mySkills = await fetchMySkills(currentUser.id);

    const { data: profiles, error } = await supabase.from('profiles').select('id, full_name, username, country, avatar_url, bio').neq('id', currentUser.id);
    if (error) {
        console.error("Failed to load profiles:", error);
        return [];
    }
    if (!profiles || profiles.length === 0) return [];

    const [sharedRes, learningRes, exploringRes] = await Promise.all([
        supabase.from('skills_shared').select('*').neq('user_id', currentUser.id),
        supabase.from('skills_learning').select('*').neq('user_id', currentUser.id),
        supabase.from('skills_exploring').select('*').neq('user_id', currentUser.id)
    ]);

    const otherShared = sharedRes.data || [];
    const otherLearning = learningRes.data || [];
    const otherExploring = exploringRes.data || [];

    const allMatches = [];

    profiles.forEach(profile => {
        if (profile.id === currentUser.id) return;

        const theirShared = otherShared.filter(s => s.user_id === profile.id);
        const theirLearning = otherLearning.filter(s => s.user_id === profile.id);
        const theirExploring = otherExploring.filter(s => s.user_id === profile.id);

        const matchResult = computeScore(mySkills, { profile: profile, shared: theirShared, learning: theirLearning, exploring: theirExploring });
        
        if (matchResult.score > 0) { 
            allMatches.push({
                profile: profile,
                score: Math.min(100, matchResult.score),
                category: matchResult.category,
                reasons: matchResult.reasons,
                teachThem: matchResult.teachThem,
                learnFromThem: matchResult.learnFromThem,
                allShared: theirShared.map(s => s.skill_name),
                allLearning: theirLearning.map(s => s.skill_name)
            });
        }
    });

    return allMatches.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.profile.id.localeCompare(b.profile.id);
    });
}

export function computeScore(me, them) {
    let score = 0;
    let reasons = [];
    let teachThemArr = [];
    let learnFromThemArr = [];
    let sharedLearningArr = [];
    let sharedCategoriesArr = [];
    
    me.shared.forEach(myS => {
        them.learning.forEach(theirL => {
            if (isRelated(myS.skill_name, theirL.skill_name)) {
                if (!teachThemArr.includes(myS.skill_name)) teachThemArr.push(myS.skill_name);
            }
        });
    });

    them.shared.forEach(theirS => {
        me.learning.forEach(myL => {
            if (isRelated(theirS.skill_name, myL.skill_name)) {
                if (!learnFromThemArr.includes(theirS.skill_name)) learnFromThemArr.push(theirS.skill_name);
            }
        });
    });

    me.learning.forEach(myL => {
        them.learning.forEach(theirL => {
            if (isRelated(myL.skill_name, theirL.skill_name)) {
                if (!sharedLearningArr.includes(myL.skill_name)) sharedLearningArr.push(myL.skill_name);
            }
        });
    });

    const iCanTeach = teachThemArr.length > 0;
    const theyCanTeach = learnFromThemArr.length > 0;
    const studyBuddy = sharedLearningArr.length > 0;

    let matchType = "INTEREST MATCH";
    let badgeClass = "badge-community";
    let icon = "fa-users";

    if (iCanTeach && theyCanTeach) {
        score += 75;
        reasons.push('Perfect reciprocal skill exchange');
        matchType = "RECIPROCAL MATCH";
        badgeClass = "badge-perfect";
        icon = "fa-fire";
    } else if (iCanTeach || theyCanTeach) {
        score += 50;
        if (iCanTeach) reasons.push('You can teach them something they want to learn');
        if (theyCanTeach) reasons.push('They can teach you something you want to learn');
        matchType = "LEARNING MATCH";
        badgeClass = "badge-learning";
        icon = "fa-seedling";
    }

    if (studyBuddy && score < 50) {
        score += 35;
        reasons.push('Study Buddies for: ' + sharedLearningArr.join(', '));
        if (score === 35) {
            matchType = "STUDY BUDDY";
            badgeClass = "badge-learning";
            icon = "fa-book-open";
        }
    } else if (studyBuddy) {
        score += 15;
        reasons.push('Also learning together: ' + sharedLearningArr.join(', '));
    }

    const myCategories = new Set([...me.shared, ...me.learning, ...me.exploring].map(s => s.category?.toLowerCase()).filter(Boolean));
    const theirCategories = new Set([...them.shared, ...them.learning, ...them.exploring].map(s => s.category?.toLowerCase()).filter(Boolean));
    
    let sharedCategoryCount = 0;
    myCategories.forEach(cat => {
        if (theirCategories.has(cat)) {
            sharedCategoryCount++;
            sharedCategoriesArr.push(cat);
        }
    });

    if (sharedCategoryCount > 0) {
        const catScore = Math.min(20, sharedCategoryCount * 5);
        score += catScore;
        reasons.push(`Shared interests in: ${sharedCategoriesArr.slice(0, 3).join(', ')}`);
    }

    let commonExploring = 0;
    me.exploring.forEach(myE => {
        them.exploring.forEach(theirE => {
            if (isRelated(myE.skill_name, theirE.skill_name)) commonExploring++;
        });
    });

    if (commonExploring > 0) {
        score += Math.min(10, commonExploring * 5);
        reasons.push('You are both exploring similar topics');
    }

    if (score === 0 && sharedCategoryCount > 0) {
        score = 15;
    } else if (score === 0) {
        score = 5;
        if (them.profile && them.profile.bio) {
            reasons.push(them.profile.bio);
        } else {
            reasons.push('General community connection');
        }
    }

    if (iCanTeach || theyCanTeach) {
        const averageConfidence = them.shared.length
            ? them.shared.reduce((total, skill) => total + (skill.confidence || 0), 0) / them.shared.length
            : 0;
        const averageProgress = me.learning.length
            ? me.learning.reduce((total, skill) => total + (skill.progress || 0), 0) / me.learning.length
            : 0;
        score += Math.min(12, Math.round(averageConfidence / 20) + Math.round(averageProgress / 25));
    }

    return {
        score: score,
        category: { text: matchType, class: badgeClass, icon: icon },
        reasons: reasons,
        teachThem: teachThemArr.length > 0 ? teachThemArr.join(', ') : 'Nothing currently',
        learnFromThem: learnFromThemArr.length > 0 ? learnFromThemArr.join(', ') : 'Nothing currently'
    };
}

function isRelated(str1, str2) {
    if (!str1 || !str2) return false;
    return str1.toLowerCase() === str2.toLowerCase() || 
           str1.toLowerCase().includes(str2.toLowerCase()) || 
           str2.toLowerCase().includes(str1.toLowerCase());
}
