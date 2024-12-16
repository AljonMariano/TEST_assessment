require('dotenv').config();
const { gmail, testConnection } = require('./src/services/gmail.service');

async function testGmailConnection() {
    try {
        console.log('Testing Gmail connection...');
        const result = await testConnection();
        console.log('Connection successful:', result);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testGmailConnection(); 