require('dotenv').config();
const twilio = require('twilio');

// Using Account 2 to verify Account 1's number
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID_2,
    process.env.TWILIO_AUTH_TOKEN_2
);

async function verifyCallerId() {
    try {
        console.log('Requesting Caller ID verification...');
        
        const validationRequest = await client.validationRequests.create({
            friendlyName: 'Trial Number Verification',
            phoneNumber: process.env.TWILIO_NUMBER_1,
            method: 'call'
        });
        
        console.log('Validation request created:', {
            sid: validationRequest.sid,
            status: validationRequest.status,
            phoneNumber: validationRequest.phoneNumber,
            validationCode: validationRequest.validationCode
        });

        // The validationCode will be provided in the response
        // You'll need to enter this code on the call you receive
        console.log('\nIMPORTANT: When you receive the call, enter this validation code:', validationRequest.validationCode);
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code) {
            console.error('Error code:', error.code);
            console.error('More info:', error.moreInfo);
        }
    }
}

verifyCallerId();