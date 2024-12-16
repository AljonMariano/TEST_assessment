require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID_1,
    process.env.TWILIO_AUTH_TOKEN_1
);

async function verifyNumber() {
    try {
        // First, create a Verify Service if you don't have one
        const service = await client.verify.v2.services.create({
            friendlyName: 'My Verification Service'
        });
        
        console.log('Verify Service created:', service.sid);

        // Start verification to your personal number
        const verification = await client.verify.v2.services(service.sid)
            .verifications
            .create({
                to: '+639568513053',  // Your personal mobile number
                channel: 'sms'
            });
        
        console.log('Verification initiated:', {
            status: verification.status,
            to: verification.to,
            channel: verification.channel
        });
        
        // Ask for verification code input
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Enter the verification code you received: ', async (code) => {
            try {
                // Check verification code
                const verificationCheck = await client.verify.v2.services(service.sid)
                    .verificationChecks
                    .create({
                        to: '+639568513053',  // Same personal number
                        code: code
                    });
                
                console.log('Verification result:', {
                    status: verificationCheck.status,
                    valid: verificationCheck.valid
                });
            } catch (checkError) {
                console.error('Verification check error:', checkError.message);
            } finally {
                readline.close();
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

verifyNumber();