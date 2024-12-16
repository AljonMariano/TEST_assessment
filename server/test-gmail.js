require('dotenv').config();
const { testConnection } = require('./src/services/gmail.service');

async function testGmailConnection() {
    try {
        console.log('Testing Gmail connection...');
        console.log('Using credentials:');
        console.log('Client ID:', process.env.GMAIL_CLIENT_ID?.substring(0, 10) + '...');
        console.log('Email:', process.env.GMAIL_ADDRESS);
        
        const result = await testConnection();
        console.log('Connection successful!');
        console.log('Available labels:', result.labels.map(l => l.name).join(', '));
    } catch (error) {
        console.error('Connection failed!');
        console.error('Error details:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testGmailConnection(); 