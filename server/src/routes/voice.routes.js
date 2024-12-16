const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

// Generate capability token for Twilio Client
router.get('/token', (req, res) => {
    const clientName = req.query.clientName || 'anonymous';
    
    // Create a capability token
    const capability = new twilio.jwt.ClientCapability({
        accountSid: process.env.TWILIO_ACCOUNT_SID_1,
        authToken: process.env.TWILIO_AUTH_TOKEN_1,
    });

    // Allow the client to make outgoing calls
    capability.addScope(
        new twilio.jwt.ClientCapability.OutgoingClientScope({
            applicationSid: process.env.TWILIO_TWIML_APP_SID,
            clientName: clientName,
            params: {
                // Add the target number as a parameter
                To: process.env.TWILIO_NUMBER_2
            }
        })
    );

    const token = capability.toJwt();
    res.json({ token });
});

// Handle main voice endpoint
router.post('/', (req, res) => {
    console.log('📞 Voice webhook received:', req.body);
    const twiml = new VoiceResponse();
    
    try {
        // Check if it's a client call
        const isClientCall = req.body.From?.startsWith('client:');
        console.log('Call type:', isClientCall ? 'Client call' : 'Regular call');

        if (isClientCall) {
            // Check if it's an outbound call (has a To parameter)
            if (req.body.To) {
                // Outbound call to a phone number
                twiml.say({ voice: 'alice' }, 'Connecting your call.');
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
                }, req.body.To);
            } else {
                // Internal call (echo test)
                twiml.play('https://api.twilio.com/cowbell.mp3');
                twiml.say({ voice: 'alice' }, 'Please wait while we connect you.');
                twiml.pause({ length: 2 });

                // Add gather to keep the call alive while waiting for accept/reject
                const gather = twiml.gather({
                    timeout: 30,
                    numDigits: 1,
                    action: `${process.env.NGROK_URL}/api/voice/gather`,
                    method: 'POST'
                });
                gather.say({ voice: 'alice' }, 'Please wait for your call to be accepted.');

                // Add a redirect in case gather times out
                twiml.redirect(`${process.env.NGROK_URL}/api/voice/gather`);

                // Emit the incoming call event
                const io = req.app.get('io');
                if (io) {
                    io.emit('incomingCall', {
                        from: req.body.From,
                        to: process.env.TWILIO_NUMBER_2,
                        callSid: req.body.CallSid,
                        direction: 'inbound',
                        status: 'ringing'
                    });
                    console.log('Emitted incoming call event');
                }
            }
        } else {
            // Regular incoming call
            twiml.play('https://api.twilio.com/cowbell.mp3');
            twiml.say({ voice: 'alice' }, 'Please wait while we connect you.');
            twiml.pause({ length: 2 });
            twiml.echo();
            twiml.pause({ length: 120 });
        }

        console.log('Generated TwiML:', twiml.toString());
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in voice webhook:', error);
        twiml.say({ voice: 'alice' }, 'An error occurred. Please try again.');
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Handle accepted calls
router.post('/accept', (req, res) => {
    console.log('\n📞 === ACCEPTING CALL ===');
    console.log('Accept call data:', req.body);
    
    const twiml = new VoiceResponse();
    try {
        // Just say connected without mentioning echo
        twiml.say({ voice: 'alice' }, 'Call connected.');
        
        // Add echo without announcing it
        twiml.echo();
        
        // Add a long pause to keep the call alive
        twiml.pause({ length: 120 });
        
        console.log('Generated accept TwiML:', twiml.toString());
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error accepting call:', error);
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Add reject call endpoint
router.post('/reject', (req, res) => {
    console.log('\n📞 === REJECTING CALL ===');
    console.log('Reject call data:', req.body);
    
    const twiml = new VoiceResponse();
    try {
        twiml.say({ voice: 'alice' }, 'Call rejected');
        twiml.hangup();
        
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error rejecting call:', error);
        twiml.hangup();
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

// Status endpoint
router.post('/status', (req, res) => {
    console.log('\n📞 === CALL STATUS UPDATE ===');
    console.log('Raw status data:', req.body);
    
    const io = req.app.get('io');
    const toNumber = req.body.To || process.env.TWILIO_NUMBER_2;
    
    // Create status data with CallStatus field
    const statusData = {
        callSid: req.body.CallSid,
        CallStatus: req.body.CallStatus,  // Use CallStatus instead of status
        from: req.body.From || 'client:Anonymous',
        to: toNumber,
        direction: req.body.Direction || 'inbound'
    };
    
    console.log('Emitting status update:', statusData);

    if (io) {
        io.emit('callStatus', statusData);
        console.log('Status update emitted to clients');
    }

    res.sendStatus(200);
});

// Handle conference status updates
router.post('/conference-status', (req, res) => {
    console.log('📞 Conference status update:', req.body);
    res.sendStatus(200);
});

// Handle user input (DTMF or speech)
router.post('/handle-input', (req, res) => {
    console.log('🎤 User input received:', req.body);
    const input = req.body.Digits || req.body.SpeechResult;
    const type = req.body.Digits ? 'dtmf' : 'speech';
    
    const twimlResponse = handleUserInput(input, type);
    res.type('text/xml');
    res.send(twimlResponse);
});

// Handle call events
router.post('/events', (req, res) => {
    console.log('📱 Call event received:', {
        callSid: req.body.CallSid,
        status: req.body.CallStatus,
        duration: req.body.CallDuration,
        timestamp: new Date().toISOString()
    });
    res.sendStatus(200);
});

// Handle recording callback
router.post('/handle-recording', (req, res) => {
    console.log('📝 Recording received:', {
        recordingUrl: req.body.RecordingUrl,
        duration: req.body.RecordingDuration
    });

    const response = new twilio.twiml.VoiceResponse();
    
    // Play back the recording
    response.say('Here is what you said:');
    response.play(req.body.RecordingUrl);
    
    // Ask if they want to try again
    response.gather({
        numDigits: 1,
        action: '/api/voice',
        method: 'POST'
    }).say('Press any key to try again, or hang up to end the call.');

    res.type('text/xml');
    res.send(response.toString());
});

// Simplified fallback endpoint
router.post('/fallback', (req, res) => {
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'alice' }, 'An error occurred. Please try again.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
});

// Update the gather endpoint
router.post('/gather', (req, res) => {
    console.log('📞 Gather endpoint hit:', req.body);
    const twiml = new VoiceResponse();
    
    // Keep playing the waiting message
    twiml.play('https://api.twilio.com/cowbell.mp3');
    twiml.say({ voice: 'alice' }, 'Please wait while we connect you.');
    twiml.pause({ length: 2 });
    
    const gather = twiml.gather({
        timeout: 30,
        numDigits: 1,
        action: `${process.env.NGROK_URL}/api/voice/gather`,
        method: 'POST'
    });
    gather.say({ voice: 'alice' }, 'Please wait for your call to be accepted.');
    
    // Add a redirect to keep the call alive
    twiml.redirect(`${process.env.NGROK_URL}/api/voice/gather`);
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Add outbound call endpoint
router.post('/outbound', (req, res) => {
    console.log('📞 Outbound call webhook:', req.body);
    const twiml = new VoiceResponse();
    
    try {
        twiml.say({ voice: 'alice' }, 'Connecting your call.');
        
        const dial = twiml.dial({
            callerId: process.env.TWILIO_NUMBER_1,
            answerOnBridge: true,
            action: `${process.env.NGROK_URL}/api/voice/status`,
            method: 'POST'
        });
        
        dial.number(req.body.To);
        
        console.log('Generated outbound TwiML:', twiml.toString());
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in outbound call:', error);
        twiml.say({ voice: 'alice' }, 'An error occurred.');
        res.type('text/xml');
        res.send(twiml.toString());
    }
});

module.exports = router; 