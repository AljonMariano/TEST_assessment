import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { google } from 'googleapis';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function diagnoseSetup() {
  console.log('\n=== Environment Variables Check ===');
  const requiredVars = [
    'PORT',
    'MONGODB_URI',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
    'GMAIL_ACCESS_TOKEN',
    'GMAIL_ADDRESS'
  ];

  requiredVars.forEach(varName => {
    console.log(`${varName}: ${process.env[varName] ? '✓ Present' : '✗ Missing'}`);
  });

  console.log('\n=== MongoDB Connection Test ===');
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✓ MongoDB connection successful');
    await mongoose.disconnect();
    console.log('✓ MongoDB disconnection successful');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
  }

  console.log('\n=== Gmail API Test ===');
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    console.log('1. OAuth2 Client created');

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      access_token: process.env.GMAIL_ACCESS_TOKEN
    });

    console.log('2. Credentials set');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('3. Gmail client created');

    try {
      const tokens = await oauth2Client.refreshAccessToken();
      console.log('4. Token refresh successful:', tokens.credentials.access_token?.substring(0, 10) + '...');
    } catch (error) {
      console.error('✗ Token refresh failed:', error);
    }

    try {
      const response = await gmail.users.labels.list({ userId: 'me' });
      console.log('5. Gmail API test successful');
      console.log('Labels found:', response.data.labels?.length || 0);
    } catch (error) {
      console.error('✗ Gmail API test failed:', error);
    }
  } catch (error) {
    console.error('✗ Gmail setup failed:', error);
  }

  console.log('\n=== File System Check ===');
  try {
    const uploadsPath = path.resolve(__dirname, '../../uploads');
    console.log('Uploads directory:', uploadsPath);
    const fs = require('fs');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath);
      console.log('✓ Uploads directory created');
    } else {
      console.log('✓ Uploads directory exists');
    }
  } catch (error) {
    console.error('✗ File system check failed:', error);
  }
}

diagnoseSetup().catch(console.error).finally(() => process.exit()); 