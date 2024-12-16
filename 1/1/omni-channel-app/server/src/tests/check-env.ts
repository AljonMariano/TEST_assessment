import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('Environment Variables Check:');
console.log('=========================');
console.log('PORT:', process.env.PORT);
console.log('GMAIL_CLIENT_ID exists:', !!process.env.GMAIL_CLIENT_ID);
console.log('GMAIL_CLIENT_SECRET exists:', !!process.env.GMAIL_CLIENT_SECRET);
console.log('GMAIL_REFRESH_TOKEN exists:', !!process.env.GMAIL_REFRESH_TOKEN);
console.log('GMAIL_ACCESS_TOKEN exists:', !!process.env.GMAIL_ACCESS_TOKEN);
console.log('GMAIL_ADDRESS:', process.env.GMAIL_ADDRESS); 