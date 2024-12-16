require('dotenv').config();
const fetch = require('node-fetch');

async function testServer() {
    try {
        console.log('Testing email server connection...');
        
        // Test basic server connection
        const response = await fetch('http://localhost:5002/test');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Server test:', data);

        // Test email endpoint
        console.log('Testing email endpoint...');
        const emailResponse = await fetch('http://localhost:5002/api/emails/inbox');
        if (!emailResponse.ok) {
            throw new Error(`Email endpoint error! status: ${emailResponse.status}`);
        }
        const emails = await emailResponse.json();
        console.log('Email test:', emails.length > 0 ? 'Success' : 'No emails found');
        if (emails.length > 0) {
            console.log('First email subject:', emails[0].subject);
        }
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('Make sure the email server is running on port 5002');
        }
    }
}

testServer(); 