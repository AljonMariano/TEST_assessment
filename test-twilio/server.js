const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
const port = 5008;

// Enable CORS for all routes
app.use(cors({
    origin: 'http://localhost:8000',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Route to generate token
app.get('/api/token', (req, res) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID_1;
        const authToken = process.env.TWILIO_AUTH_TOKEN_1;
        
        const capability = new twilio.jwt.ClientCapability({
            accountSid: accountSid,
            authToken: authToken
        });
        
        // Allow outgoing calls
        capability.addScope(
            new twilio.jwt.ClientCapability.OutgoingClientScope({
                applicationSid: process.env.TWILIO_TWIML_APP_SID
            })
        );
        
        const token = capability.toJwt();
        res.json({ token });
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/voice', (req, res) => {
    const twiml = new VoiceResponse();
    
    console.log('Voice webhook received:', req.body);
    
    try {
        // Get the list of verified numbers from env
        const verifiedNumbers = process.env.VERIFIED_PHONE_NUMBERS.split(',');
        
        if (req.body.From.startsWith('client:')) {
            // For calls from browser client
            twiml.dial({
                callerId: verifiedNumbers[0], // Use your first verified number as caller ID
                answerOnBridge: true
            }, verifiedNumbers[0]); // Call to your first verified number
        } else {
            // For incoming calls
            twiml.say('Hello from your Twilio app!');
        }
        
        console.log('TwiML response:', twiml.toString());
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('TwiML Error:', error);
        res.status(500).send('Error generating TwiML');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});