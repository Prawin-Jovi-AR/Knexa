
export async function generateDynamicAIInsight(promptText, skillName, category) {
    if (!skillName) {
        return "[Error] Skill name is required to fetch data.";
    }

    try {
        const query = encodeURIComponent(skillName);
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`;
        
        try {
            const response = await fetch(wikiUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.type !== 'disambiguation' && data.extract) {
                    let insight = `[AI Insight: ${data.title}]\n\n${data.extract}`;
                    if (data.content_urls && data.content_urls.desktop) {
                        insight += `\n\nReference: ${data.content_urls.desktop.page}`;
                    }
                    return insight;
                }
            }

        } catch (e) {
            console.warn("API failed", e);
        }

        const catName = category && category !== 'undefined' ? category : 'professional';
        return `[AI Insight: ${skillName}]\n\n${skillName} is recognized as a specialized capability within the ${catName} domain. Professionals leveraging this skill typically apply advanced methodologies to solve complex problems and drive significant value in their respective projects.`;
    } catch (error) {
        console.error("API Error:", error);
        return `[Error] Failed to generate insight: ${error.message}`;
    }
}
window.generateDynamicAIInsight = generateDynamicAIInsight;
