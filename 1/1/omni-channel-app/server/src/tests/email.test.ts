import dotenv from 'dotenv';
import path from 'path';
import { gmail, createTransporter } from '../services/gmail.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testEmailFeatures() {
  try {
    // Debug: Print credentials (remove in production)
    console.log('Checking credentials...');
    console.log('Client ID exists:', !!process.env.GMAIL_CLIENT_ID);
    console.log('Client Secret exists:', !!process.env.GMAIL_CLIENT_SECRET);
    console.log('Refresh Token exists:', !!process.env.GMAIL_REFRESH_TOKEN);
    console.log('Gmail Address:', process.env.GMAIL_ADDRESS);

    // 1. Test Connection
    console.log('\nTesting Gmail connection...');
    const labels = await gmail.users.labels.list({ userId: 'me' });
    console.log('Labels:', labels.data.labels);

    // 2. Test Fetching Emails
    console.log('\nFetching recent emails...');
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 5
    });
    console.log('Recent emails:', messages.data.messages?.length || 0);

    // 3. Test Sending Email
    console.log('\nSending test email...');
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: process.env.GMAIL_ADDRESS,
      to: process.env.GMAIL_ADDRESS,
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>This is a test email sent at ' + new Date().toISOString() + '</p>'
    });
    console.log('Test email sent successfully');

  } catch (error) {
    console.error('Test failed:', error);
    // Print more error details
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
  }
}

testEmailFeatures(); 