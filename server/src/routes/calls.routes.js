const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const twilioService = require('../services/twilio.service');
const cors = require('cors');

// Configure CORS for this route
const corsOptions = {
    origin: '*',
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Add preflight handler
router.options('/make', cors(corsOptions));

// Handle outgoing calls
router.post('/', async (req, res) => {
    try {
        console.log('📞 Initiating call:', req.body);
        const { to = process.env.TWILIO_NUMBER_2, from } = req.body;

        // Use environment variable for status callback
        const call = await twilioService.makeCall(to, from, {
            statusCallback: `${process.env.NGROK_URL}/api/calls/status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST'
        });
        
        console.log('Call initiated:', call.sid);
        res.json({ 
            success: true, 
            callSid: call.sid,
            to: to,
            from: from
        });
    } catch (error) {
        console.error('Error making call:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle call status updates
router.post('/status', (req, res) => {
    console.log('📞 Call status update:', {
        ...req.body,
        to: req.body.To || process.env.TWILIO_NUMBER_2 // Ensure we have a "to" number
    });
    res.sendStatus(200);
});

// Update the calls route
router.post('/make', cors(corsOptions), async (req, res) => {
    try {
        console.log('\n📞 === OUTBOUND CALL REQUEST ===');
        console.log('Request body:', req.body);
        const { to, from } = req.body;

        if (!to || !from) {
            throw new Error('Missing required parameters: to and from');
        }

        console.log('Making call with:', { to, from });
        const call = await twilioService.makeCall(to, from);
        console.log('Call initiated:', call);
        
        res.json({ 
            success: true, 
            callSid: call.sid,
            to: to,
            from: from,
            status: call.status
        });
    } catch (error) {
        console.error('Error making call:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 