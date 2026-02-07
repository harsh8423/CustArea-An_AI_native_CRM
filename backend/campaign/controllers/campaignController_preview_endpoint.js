/**
 * POST /api/campaigns/preview/templates - Generate templates from form data WITHOUT creating campaign
 * This allows users to preview/generate templates before campaign creation
 */
async function generateTemplatesPreview(req, res) {
    try {
        const { campaignData, followUpCount = 2 } = req.body;

        // Validate required fields
        if (!campaignData.company_name || !campaignData.campaign_objective || 
            !campaignData.selling_points || !campaignData.pain_points || 
            !campaignData.value_proposition) {
            return res.status(400).json({ error: 'Missing required campaign data fields' });
        }

        // Create a temporary campaign object for template generation (NOT saved to DB)
        const tempCampaignData = {
            name: campaignData.name || 'Preview Campaign',
            company_name: campaignData.company_name,
            website_url: campaignData.website_url,
            campaign_objective: campaignData.campaign_objective,
            selling_points: campaignData.selling_points,
            pain_points: campaignData.pain_points,
            value_proposition: campaignData.value_proposition,
            proof_points: campaignData.proof_points,
            language: campaignData.language || 'en',
            ai_instructions: campaignData.ai_instructions
        };

        // Generate templates using AI (no DB interaction)
        const templates = await templateService.generateCampaignTemplates(tempCampaignData, followUpCount);

        res.json({
            success: true,
            message: 'Templates generated successfully',
            templates
        });

    } catch (error) {
        console.error('Generate templates preview error:', error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    // ... existing exports
    generateTemplatesPreview
};
