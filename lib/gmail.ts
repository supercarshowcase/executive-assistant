import { gmail_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { EmailMessage } from '@/types';

// Create Gmail client from access token
export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });
}

// Create OAuth2 client for token refresh
function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

// Fetch emails from inbox
export async function fetchEmails(
  accessToken: string,
  maxResults: number = 10,
  query: string = ''
): Promise<EmailMessage[]> {
  try {
    const gmail = getGmailClient(accessToken);

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: query || 'is:inbox',
    });

    const messages = res.data.messages || [];

    if (messages.length === 0) {
      return [];
    }

    // Fetch full message details for each email
    const emailPromises = messages.map((msg) =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })
    );

    const fullMessages = await Promise.all(emailPromises);

    return fullMessages.map((msg) => parseGmailMessage(msg.data));
  } catch (error) {
    console.error('Error fetching emails:', error);
    return [];
  }
}

// Get full email body
export async function getEmailBody(
  accessToken: string,
  messageId: string
): Promise<string> {
  try {
    const gmail = getGmailClient(accessToken);

    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = res.data;

    // Try to get text or HTML body
    let body = '';

    if (message.payload?.parts) {
      const textPart = message.payload.parts.find(
        (part) => part.mimeType === 'text/plain'
      );
      const htmlPart = message.payload.parts.find(
        (part) => part.mimeType === 'text/html'
      );

      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      } else if (htmlPart?.body?.data) {
        body = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    return body;
  } catch (error) {
    console.error('Error getting email body:', error);
    return '';
  }
}

// Send email
export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<string | null> {
  try {
    const gmail = getGmailClient(accessToken);

    const email = [
      `From: me`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `\r\n${body}`,
    ].join('\n');

    const encodedEmail = Buffer.from(email).toString('base64');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    return res.data.id || null;
  } catch (error) {
    console.error('Error sending email:', error);
    return null;
  }
}

// Create draft
export async function createDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<string | null> {
  try {
    const gmail = getGmailClient(accessToken);

    const email = [
      `From: me`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `\r\n${body}`,
    ].join('\n');

    const encodedEmail = Buffer.from(email).toString('base64');

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedEmail,
        },
      },
    });

    return res.data.id || null;
  } catch (error) {
    console.error('Error creating draft:', error);
    return null;
  }
}

// Trash email
export async function trashEmail(
  accessToken: string,
  messageId: string
): Promise<boolean> {
  try {
    const gmail = getGmailClient(accessToken);

    await gmail.users.messages.trash({
      userId: 'me',
      id: messageId,
    });

    return true;
  } catch (error) {
    console.error('Error trashing email:', error);
    return false;
  }
}

// Add label to email
export async function addLabelToEmail(
  accessToken: string,
  messageId: string,
  labelId: string
): Promise<boolean> {
  try {
    const gmail = getGmailClient(accessToken);

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });

    return true;
  } catch (error) {
    console.error('Error adding label:', error);
    return false;
  }
}

// Refresh OAuth access token
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const oauth2Client = getOAuth2Client();

    const res = await oauth2Client.refreshAccessToken();
    const credentials = res.credentials;

    return {
      access_token: credentials.access_token || '',
      expires_in: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return null;
  }
}

// Helper function to parse Gmail message
function parseGmailMessage(message: gmail_v1.Schema$Message): EmailMessage {
  const headers = message.payload?.headers || [];

  const getHeader = (name: string): string => {
    return headers.find((h) => h.name === name)?.value || '';
  };

  // Extract body preview
  let body = '';
  if (message.payload?.parts) {
    const textPart = message.payload.parts.find(
      (part) => part.mimeType === 'text/plain'
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8').substring(0, 500);
    }
  } else if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64')
      .toString('utf-8')
      .substring(0, 500);
  }

  return {
    id: message.id || '',
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: new Date(getHeader('Date')),
    snippet: message.snippet || '',
    body,
    labels: message.labelIds || [],
    threadId: message.threadId || '',
    isRead: !message.labelIds?.includes('UNREAD'),
  };
}
