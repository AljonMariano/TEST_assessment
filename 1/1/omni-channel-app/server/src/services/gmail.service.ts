import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug: Print environment variables
console.log('Gmail Service Configuration:', {
  hasClientId: !!process.env.GMAIL_CLIENT_ID,
  hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
  hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
  email: process.env.GMAIL_ADDRESS
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

// Set credentials with required scopes
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  scope: [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send'
  ].join(' ')
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
    return false;
  }
};

// Test connection
const testConnection = async () => {
  try {
    const isInitialized = await initializeGmail();
    if (!isInitialized) {
      throw new Error('Gmail service not initialized');
    }
    
    const response = await gmail.users.labels.list({ userId: 'me' });
    return response.data;
  } catch (error) {
    console.error('Gmail test connection failed:', error);
    throw error;
  }
};

const createTransporter = async () => {
  try {
    const { token } = await oauth2Client.getAccessToken();
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_ADDRESS,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: token
      }
    } as nodemailer.TransportOptions);
  } catch (error) {
    console.error('Error creating transporter:', error);
    throw error;
  }
};

export { gmail, createTransporter, initializeGmail, testConnection }; 