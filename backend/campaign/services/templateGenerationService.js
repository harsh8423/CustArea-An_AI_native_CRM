/**
 * Email Template Generation Service
 * Uses AI to generate personalized email templates for campaigns
 */

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate initial email template using AI
 */
async function generateInitialTemplate(campaign) {
    const {
        company_name,
        website_url,
        campaign_objective,
        selling_points,
        pain_points,
        value_proposition,
        proof_points,
        language,
        ai_instructions
    } = campaign;

    const systemPrompt = `You are an expert email copywriter specializing in cold outreach and sales emails. 
Create compelling, personalized, and concise email templates that convert.

Guidelines:
- Keep emails short (100-150 words maximum)
- Use a conversational, friendly tone
- Personalize with merge fields: {{name}}, {{company}}
- Focus on the recipient's pain points and how the product solves them
- Include clear call-to-action
- Avoid being overly salesy or pushy
- Language: ${language}`;

    const userPrompt = `Create an initial outreach email template with the following details:

Company: ${company_name}
${website_url ? `Website: ${website_url}` : ''}
Campaign Objective: ${campaign_objective}

What we're selling: ${selling_points}
Pain Points we solve: ${pain_points}
Value Proposition: ${value_proposition}
${proof_points ? `Proof Points: ${proof_points}` : ''}

${ai_instructions ? `Additional Instructions: ${ai_instructions}` : ''}

Return ONLY a JSON object with this structure:
{
  "subject": "Email subject line",
  "body_html": "HTML formatted email body (use <p>, <br>, <strong>, <em> tags only, personalize with {{name}} and {{company}})",
  "body_text": "Plain text version",
  "personalization_fields": {
    "name": {"default": "there"},
    "company": {"default": "your company"}
  }
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no explanation.`;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const templateData = JSON.parse(response.choices[0].message.content);

        return {
            template_type: 'initial',
            subject: templateData.subject,
            body_html: templateData.body_html,
            body_text: templateData.body_text,
            personalization_fields: templateData.personalization_fields,
            is_ai_generated: true,
            ai_generation_prompt: userPrompt
        };

    } catch (error) {
        console.error('AI template generation error:', error);
        throw new Error('Failed to generate email template: ' + error.message);
    }
}

/**
 * Generate follow-up email templates
 */
async function generateFollowUpTemplates(campaign, initialTemplate, count = 2) {
    const followUps = [];

    for (let i = 1; i <= count; i++) {
        const systemPrompt = `You are an expert email copywriter specializing in follow-up emails for cold outreach campaigns.
Create engaging follow-up emails that re-engage recipients without being pushy.

Guidelines:
- Reference the previous email naturally
- Add new value or perspective
- Keep it brief (80-120 words)
- Use merge fields: {{name}}, {{company}}
- Vary the approach (e.g., share a resource, ask a question, share a case study)
- Language: ${campaign.language}`;

        const userPrompt = `Create follow-up email #${i} for this campaign:

Company: ${campaign.company_name}
Campaign Objective: ${campaign.campaign_objective}
Value Proposition: ${campaign.value_proposition}

Initial Email Subject: ${initialTemplate.subject}

${i === 1 ? 'This is the first follow-up - they haven\'t responded to the initial email.' : ''}
${i === 2 ? 'This is the second follow-up - final attempt to engage.' : ''}

Return ONLY a JSON object with this structure:
{
  "subject": "Follow-up subject line (can be Re: or new subject)",
  "body_html": "HTML formatted email body",
  "body_text": "Plain text version",
  "personalization_fields": {
    "name": {"default": "there"},
    "company": {"default": "your company"}
  }
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting.`;

        try {
            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                response_format: { type: 'json_object' }
            });

            const templateData = JSON.parse(response.choices[0].message.content);

            followUps.push({
                template_type: 'follow_up',
                subject: templateData.subject,
                body_html: templateData.body_html,
                body_text: templateData.body_text,
                personalization_fields: templateData.personalization_fields,
                is_ai_generated: true,
                ai_generation_prompt: userPrompt
            });

        } catch (error) {
            console.error(`Follow-up ${i} generation error:`, error);
            // Continue generating other follow-ups even if one fails
        }
    }

    return followUps;
}

/**
 * Generate all templates for a campaign (initial + follow-ups)
 */
async function generateCampaignTemplates(campaign, followUpCount = 2) {
    try {
        // Generate initial template
        const initialTemplate = await generateInitialTemplate(campaign);

        // Generate follow-up templates
        const followUpTemplates = await generateFollowUpTemplates(campaign, initialTemplate, followUpCount);

        return {
            initial: initialTemplate,
            followUps: followUpTemplates
        };

    } catch (error) {
        throw new Error('Failed to generate campaign templates: ' + error.message);
    }
}

/**
 * Save templates to database
 */
async function saveTemplatesToDatabase(campaignId, templates, client) {
    const savedTemplates = [];

    // Save initial template
    const initialResult = await client.query(
        `INSERT INTO campaign_email_templates (
            campaign_id, template_type, subject, body_html, body_text,
            personalization_fields, is_ai_generated, ai_generation_prompt
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
            campaignId,
            templates.initial.template_type,
            templates.initial.subject,
            templates.initial.body_html,
            templates.initial.body_text,
            JSON.stringify(templates.initial.personalization_fields),
            templates.initial.is_ai_generated,
            templates.initial.ai_generation_prompt
        ]
    );

    savedTemplates.push(initialResult.rows[0]);

    // Save follow-up templates
    for (let i = 0; i < templates.followUps.length; i++) {
        const followUp = templates.followUps[i];
        const followUpResult = await client.query(
            `INSERT INTO campaign_email_templates (
                campaign_id, template_type, subject, body_html, body_text,
                personalization_fields, is_ai_generated, ai_generation_prompt,
                wait_period_value, wait_period_unit
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                campaignId,
                followUp.template_type,
                followUp.subject,
                followUp.body_html,
                followUp.body_text,
                JSON.stringify(followUp.personalization_fields),
                followUp.is_ai_generated,
                followUp.ai_generation_prompt,
                3, // Default: 3 days wait
                'days'
            ]
        );

        savedTemplates.push(followUpResult.rows[0]);
    }

    return savedTemplates;
}

module.exports = {
    generateInitialTemplate,
    generateFollowUpTemplates,
    generateCampaignTemplates,
    saveTemplatesToDatabase
};
