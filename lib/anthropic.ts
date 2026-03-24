import Anthropic from '@anthropic-ai/sdk';
import type {
  EmailMessage,
  TriagedEmail,
  DailyBriefing,
  Lead,
  Transaction,
  ContentItem,
} from '@/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get Anthropic client instance
export function getAnthropicClient(): Anthropic {
  return client;
}

// Email category type
export type EmailCategory =
  | 'urgent'
  | 'new_lead'
  | 'transaction_update'
  | 'follow_up'
  | 'low_priority';

// Categorize email using Claude
export async function categorizeEmail(
  email: EmailMessage,
  accountContext: string
): Promise<TriagedEmail> {
  try {
    const prompt = `You are an email triage assistant for a real estate agent. Analyze the following email and categorize it.

Account Context: ${accountContext}

Email Details:
- From: ${email.from}
- Subject: ${email.subject}
- Body: ${email.body.substring(0, 1000)}

Categorize this email into ONE of these categories:
- urgent: Time-sensitive issues that need immediate attention
- new_lead: New potential clients or property inquiries
- transaction_update: Updates about ongoing transactions/deals
- follow_up: Responses to previous messages that need acknowledgment
- low_priority: Marketing, newsletters, or non-critical information

Respond ONLY with valid JSON (no markdown code blocks):
{
  "category": "category_name",
  "summary": "2-3 sentence summary of the email",
  "suggestedAction": "Brief suggested action or response"
}`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : {
          category: 'low_priority',
          summary: email.snippet,
          suggestedAction: 'Review and respond as needed',
        };

    return {
      id: email.id,
      messageId: email.id,
      from: email.from,
      subject: email.subject,
      category: parsed.category || 'low_priority',
      summary: parsed.summary || email.snippet,
      suggestedAction: parsed.suggestedAction || '',
      date: email.date,
      isRead: email.isRead,
      flagged: false,
    };
  } catch (error) {
    console.error('Error categorizing email:', error);
    return {
      id: email.id,
      messageId: email.id,
      from: email.from,
      subject: email.subject,
      category: 'low_priority',
      summary: email.snippet,
      suggestedAction: 'Review manually',
      date: email.date,
      isRead: email.isRead,
      flagged: false,
    };
  }
}

// Generate daily briefing
export async function generateBriefing(
  emails: TriagedEmail[],
  events: any[],
  leads: Lead[],
  transactions: Transaction[]
): Promise<DailyBriefing> {
  try {
    const urgentEmails = emails.filter((e) => e.category === 'urgent');
    const newLeads = emails.filter((e) => e.category === 'new_lead');
    const transactionUpdates = emails.filter(
      (e) => e.category === 'transaction_update'
    );

    const prompt = `You are an executive briefing assistant for a real estate agent. Create a concise, actionable daily briefing based on this information:

URGENT EMAILS (${urgentEmails.length}):
${urgentEmails.map((e) => `- ${e.subject}: ${e.summary}`).join('\n')}

NEW LEADS (${newLeads.length}):
${newLeads.map((e) => `- ${e.subject}: ${e.summary}`).join('\n')}

TRANSACTION UPDATES (${transactionUpdates.length}):
${transactionUpdates.map((e) => `- ${e.subject}: ${e.summary}`).join('\n')}

TODAY'S CALENDAR EVENTS:
${events.map((e) => `- ${e.summary} at ${e.start?.dateTime || e.start?.date}`).join('\n')}

ACTIVE LEADS: ${leads.length}
ACTIVE TRANSACTIONS: ${transactions.length}

Create a 3-5 paragraph natural language briefing that:
1. Starts with the most important action items
2. Summarizes key leads and opportunities
3. Highlights any at-risk transactions
4. Ends with today's schedule overview

Write conversational, professional English. Do NOT use JSON or markdown.`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const briefingText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    return {
      date: new Date(),
      summary: briefingText,
      urgentCount: urgentEmails.length,
      newLeadsCount: newLeads.length,
      transactionUpdatesCount: transactionUpdates.length,
      upcomingEventsCount: events.length,
    };
  } catch (error) {
    console.error('Error generating briefing:', error);
    return {
      date: new Date(),
      summary:
        'Unable to generate briefing at this time. Please review emails manually.',
      urgentCount: 0,
      newLeadsCount: 0,
      transactionUpdatesCount: 0,
      upcomingEventsCount: 0,
    };
  }
}

// Draft email reply
export async function draftReply(
  email: EmailMessage,
  context: string,
  tone: 'professional' | 'friendly' | 'urgent' = 'professional'
): Promise<string> {
  try {
    const toneDescriptions = {
      professional:
        'formal and professional, focused on business matters',
      friendly: 'warm and personable while remaining professional',
      urgent: 'direct and action-oriented, with clear next steps',
    };

    const prompt = `You are drafting an email reply for a real estate agent.

Original Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}

Context for the reply: ${context}

Tone: ${toneDescriptions[tone]}

Draft a professional email reply that:
1. Acknowledges the sender's message
2. Provides relevant information or action
3. Maintains the requested tone
4. Ends with clear next steps or signature line

Return ONLY the email body text (no subject line, no formatting):`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  } catch (error) {
    console.error('Error drafting reply:', error);
    return 'I will follow up with you shortly with more information.';
  }
}

// Personalize content for agent
export async function personalizeContent(
  content: ContentItem,
  agentName: string,
  brokerage: string,
  city: string
): Promise<string> {
  try {
    const prompt = `You are personalizing real estate marketing content for an agent.

Agent: ${agentName}
Brokerage: ${brokerage}
City/Area: ${city}

Original content:
${content.body.substring(0, 1000)}

Personalize this content by:
1. Adding the agent's name naturally where appropriate
2. Referencing the specific city/market
3. Mentioning the brokerage if it's a known premium firm
4. Keeping the same tone and structure
5. Making it feel like it was written specifically for this agent

Return ONLY the personalized content text (no markdown or formatting):`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  } catch (error) {
    console.error('Error personalizing content:', error);
    return content.body;
  }
}

// Detect new lead from email
export async function detectNewLead(email: EmailMessage): Promise<Lead | null> {
  try {
    const prompt = `Analyze this email to determine if it's a new lead inquiry from a potential real estate client.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 1000)}

If this is a lead inquiry, extract the key information and respond with ONLY valid JSON (no markdown):
{
  "isLead": true,
  "name": "person's name or email display name",
  "email": "${email.from}",
  "phone": "phone number if mentioned, otherwise null",
  "propertyType": "looking for type of property (house, condo, investment, etc) or null",
  "city": "interested city/area or null",
  "budget": "price range or budget if mentioned or null",
  "timeframe": "when they want to buy/sell or null",
  "notes": "any other relevant details"
}

If this is NOT a lead inquiry, respond with:
{
  "isLead": false
}`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.isLead) {
      return null;
    }

    return {
      id: email.id,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      propertyType: parsed.propertyType,
      city: parsed.city,
      budget: parsed.budget,
      timeframe: parsed.timeframe,
      notes: parsed.notes,
      source: 'email',
      createdAt: new Date(),
      status: 'new',
      assignedTo: null,
    };
  } catch (error) {
    console.error('Error detecting lead:', error);
    return null;
  }
}

// Analyze email sentiment
export async function analyzeEmailSentiment(
  email: EmailMessage
): Promise<'positive' | 'neutral' | 'negative'> {
  try {
    const prompt = `Analyze the sentiment of this email in ONE word: positive, neutral, or negative.

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}

Respond with ONLY one word: positive, neutral, or negative`;

    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const response =
      message.content[0].type === 'text'
        ? message.content[0].text.toLowerCase().trim()
        : 'neutral';

    if (response.includes('positive')) return 'positive';
    if (response.includes('negative')) return 'negative';
    return 'neutral';
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return 'neutral';
  }
}
