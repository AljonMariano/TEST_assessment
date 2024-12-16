require('dotenv').config();
const twilio = require('twilio');

// Create clients for both accounts
const client1 = twilio(
    process.env.TWILIO_ACCOUNT_SID_1,
    process.env.TWILIO_AUTH_TOKEN_1
);

const client2 = twilio(
    process.env.TWILIO_ACCOUNT_SID_2,
    process.env.TWILIO_AUTH_TOKEN_2
);

async function verifyTrialNumbers() {
    try {
        // First verify using Account 1
        console.log('Creating verification service for Account 1...');
        const service1 = await client1.verify.v2.services.create({
            friendlyName: 'Trial Number Verification 1'
        });
        
        console.log('Starting verification from Account 1 to Account 2 number...');
        const verification1 = await client1.verify.v2.services(service1.sid)
            .verifications
            .create({
                to: process.env.TWILIO_NUMBER_2,
                channel: 'sms'
            });
        
        console.log('Verification 1 status:', verification1.status);

        // Then verify using Account 2
        console.log('\nCreating verification service for Account 2...');
        const service2 = await client2.verify.v2.services.create({
            friendlyName: 'Trial Number Verification 2'
        });
        
        console.log('Starting verification from Account 2 to Account 1 number...');
        const verification2 = await client2.verify.v2.services(service2.sid)
            .verifications
            .create({
                to: process.env.TWILIO_NUMBER_1,
                channel: 'sms'
            });
        
        console.log('Verification 2 status:', verification2.status);
        
        // Store service SIDs for verification checks
        console.log('\nStore these service SIDs in your .env file:');
        console.log(`TWILIO_VERIFY_SID_1=${service1.sid}`);
        console.log(`TWILIO_VERIFY_SID_2=${service2.sid}`);
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
            console.error('More info:', error.moreInfo);
        }
    }
}

verifyTrialNumbers();