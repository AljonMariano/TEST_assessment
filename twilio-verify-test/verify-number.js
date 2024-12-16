require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID_2,  // Using Account 2 to verify number from Account 1
    process.env.TWILIO_AUTH_TOKEN_2
);

async function verifyNumber() {
    try {
        // Create a Verify Service
        const service = await client.verify.v2.services.create({
            friendlyName: 'Number Verification Service'
        });
        
        console.log('Verify Service created:', service.sid);

        // Start verification for the number from Account 1
        const verification = await client.verify.v2.services(service.sid)
            .verifications
            .create({
                to: process.env.TWILIO_NUMBER_1,  // Number to verify
                channel: 'call'  // Using call verification since it's a Twilio number
            });
        
        console.log('Verification initiated:', {
            status: verification.status,
            to: verification.to,
            channel: verification.channel
        });

        // Get verification code input
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
                        to: process.env.TWILIO_NUMBER_1,
                        code: code
                    });
                
                console.log('Verification result:', {
                    status: verificationCheck.status,
                    valid: verificationCheck.valid
                });
            } catch (checkError) {
                console.error('Verification check error:', checkError);
            } finally {
                readline.close();
            }
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

verifyNumber();