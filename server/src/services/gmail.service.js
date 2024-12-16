const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

const gmail = google.gmail({ 
    version: 'v1', 
    auth: oauth2Client 
});

// Initialize Gmail service
const initializeGmail = async () => {
    try {
        // Force token refresh
        const { credentials } = await oauth2Client.refreshAccessToken();
        console.log('Gmail credentials refreshed successfully');
        
        // Test connection
        const response = await gmail.users.labels.list({ userId: 'me' });
        if (response.data.labels) {
            console.log('Gmail API connection successful');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Gmail initialization failed:', error);
        throw error;
    }
};

const createTransporter = async () => {
    try {
        const { token } = await oauth2Client.getAccessToken();
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.GMAIL_ADDRESS,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                accessToken: token
            }
        });
    } catch (error) {
        console.error('Error creating transporter:', error);
        throw error;
    }
};

const getEmailBody = (payload) => {
    if (!payload) return '';

    // If the message is simple, it will be in payload.body
    if (payload.body && payload.body.data) {
        return Buffer.from(payload.body.data, 'base64').toString();
    }

    // If the message is multipart, we need to parse the parts
    if (payload.parts) {
        // Try to find HTML part first
        const htmlPart = payload.parts.find(part => part.mimeType === 'text/html');
        if (htmlPart && htmlPart.body.data) {
            return Buffer.from(htmlPart.body.data, 'base64').toString();
        }

        // If no HTML, try to find plain text
        const textPart = payload.parts.find(part => part.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
            return Buffer.from(textPart.body.data, 'base64').toString();
        }

        // If still no body found, recursively check nested parts
        for (const part of payload.parts) {
            if (part.parts) {
                const body = getEmailBody(part);
                if (body) return body;
            }
        }
    }

    return '';
};

const getEmailContent = async (messageId) => {
    try {
        const message = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full'
        });

        const headers = message.data.payload.headers;
        const parts = message.data.payload.parts || [];
        
        // Extract attachments
        const attachments = parts
            .filter(part => part.filename && part.filename.length > 0)
            .map(part => ({
                filename: part.filename,
                mimeType: part.mimeType,
                attachmentId: part.body.attachmentId,
                size: part.body.size
            }));

        // Get attachment download URLs
        const attachmentsWithUrls = await Promise.all(
            attachments.map(async (attachment) => {
                const attachmentData = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: messageId,
                    id: attachment.attachmentId
                });
                
                return {
                    filename: attachment.filename,
                    url: `${process.env.EMAIL_SERVER_URL || 'http://localhost:5005'}/api/emails/attachment/${messageId}/${attachment.attachmentId}`,
                    mimeType: attachment.mimeType,
                    size: attachment.size
                };
            })
        );

        return {
            id: message.data.id,
            threadId: message.data.threadId,
            from: headers.find(h => h.name === 'From')?.value || '',
            to: headers.find(h => h.name === 'To')?.value || '',
            subject: headers.find(h => h.name === 'Subject')?.value || '',
            timestamp: headers.find(h => h.name === 'Date')?.value || '',
            body: getEmailBody(message.data.payload),
            attachments: attachmentsWithUrls,
            isRead: !(message.data.labelIds || []).includes('UNREAD')
        };
    } catch (error) {
        console.error('Error getting email content:', error);
        throw error;
    }
};

// Update the exports to include initializeGmail
module.exports = {
    gmail,
    createTransporter,
    testConnection: initializeGmail,  // Keep for backward compatibility
    initializeGmail,                  // Add the new function
    getEmailContent,
    getEmailBody
}; 