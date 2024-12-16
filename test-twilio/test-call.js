require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
    'AC71564c582fc1401e04de2e5b6a884a41',  // Your Account SID
    '28772943e641a6e2e41e803757892b08'      // Your Auth Token
);

async function makeTestCall() {
    try {
        const call = await client.calls.create({
            url: 'https://83af-120-29-90-44.ngrok-free.app/api/voice',
            to: process.env.TWILIO_NUMBER_1,  // Your Twilio number
            from: process.env.TWILIO_NUMBER_2 // Your other Twilio number
        });
        
        console.log('Test call initiated:', call.sid);
        
        // Monitor call status
        setTimeout(async () => {
            const updatedCall = await client.calls(call.sid).fetch();
            console.log('Call status:', updatedCall.status);
        }, 5000);
        
    } catch (error) {
        console.error('Error making test call:', error);
    }
}

makeTestCall();