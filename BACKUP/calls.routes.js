const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const twilioService = require('../services/twilio.service');

// Handle outgoing calls
router.post('/', async (req, res) => {
    try {
        console.log('📞 Initiating call:', req.body);
        const { to, from } = req.body;

        if (!to || !from) {
            throw new Error('Missing required parameters: to and from');
        }

        const call = await twilioService.makeCall(to, from);
        
        if (call && call.sid) {
            res.json({
                sid: call.sid,
                status: call.status,
                direction: call.direction,
                from: call.from,
                to: call.to
            });
        } else {
            throw new Error('Failed to initiate call');
        }
    } catch (error) {
        console.error('Error making call:', error);
        res.status(400).json({
            error: error.message || 'Failed to make call'
        });
    }
});

// Handle call status checks
router.post('/status', async (req, res) => {
    try {
        const { CallSid } = req.body;
        if (!CallSid) {
            throw new Error('Missing CallSid parameter');
        }

        // Use the correct account credentials
        const client = twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2);
        const call = await client.calls(CallSid).fetch();
        
        res.json({
            CallSid: call.sid,
            CallStatus: call.status,
            CallDuration: call.duration,
            Direction: call.direction,
            From: call.from,
            To: call.to
        });
    } catch (error) {
        console.error('Error fetching call status:', error);
        // If call not found, assume it's ended
        if (error.code === 20404) {
            res.json({
                CallSid: req.body.CallSid,
                CallStatus: 'completed'
            });
        } else {
            res.status(400).json({
                error: error.message || 'Failed to get call status'
            });
        }
    }
});

// Handle incoming calls
router.post('/incoming', (req, res) => {
    console.log('📞 Incoming call webhook:', req.body);
    const twiml = new VoiceResponse();
    
    try {
        // Create a unique conference name
        const conferenceName = `conf_${req.body.CallSid}`;
        
        // Add initial greeting
        twiml.play('https://api.twilio.com/cowbell.mp3');
        twiml.say({ voice: 'alice' }, 'Connecting to conference.');
        
        const dial = twiml.dial({
            answerOnBridge: true,
            callerId: process.env.TWILIO_NUMBER_1
        });
        
        // Add to conference
        dial.conference({
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            waitUrl: 'https://api.twilio.com/cowbell.mp3',
            statusCallbackEvent: ['join', 'leave', 'end'],
            statusCallback: `${process.env.NGROK_URL}/api/voice/conference-status`,
            statusCallbackMethod: 'POST',
            record: 'record-from-start'
        }, conferenceName);

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in incoming call handler:', error);
        twiml.say('An error occurred. Please try again.');
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Handle call status callbacks
router.post('/status', (req, res) => {
    console.log('📞 Call status update:', req.body);
    res.sendStatus(200);
});

// Handle accepted calls
router.post('/accept', (req, res) => {
    console.log('📞 Accept call endpoint hit:', req.body);
    const twiml = new VoiceResponse();
    
    try {
        // Connect the call directly
        const dial = twiml.dial({
            answerOnBridge: true,
            callerId: process.env.TWILIO_NUMBER_1,
            action: `${process.env.NGROK_URL}/api/voice/status`,
            method: 'POST'
        });

        dial.number({
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
            statusCallbackMethod: 'POST'
        }, process.env.TWILIO_NUMBER_1);

        console.log('📞 Generated accept call TwiML:', twiml.toString());
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in accept call handler:', error);
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

module.exports = router; 