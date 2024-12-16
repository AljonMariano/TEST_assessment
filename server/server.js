const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { gmail, createTransporter, initializeGmail, getEmailContent } = require('./src/services/gmail.service');
const twilioService = require('./src/services/twilio.service');
const callsRouter = require('./src/routes/calls.routes');
require('dotenv').config();
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
const { Server } = require('socket.io');
const http = require('http');
const voiceRoutes = require('./src/routes/voice.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",  // Or your specific client URL
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 10000,
    pingInterval: 5000
});

app.set('io', io);

// Initialize a Map to store connected clients
const connectedClients = new Map();
const handledCalls = new Set();

const PORT = 5001;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add OPTIONS handler
app.options('*', cors());

// Mount voice routes BEFORE the calls routes
app.use('/api/voice', voiceRoutes);
app.use('/api/calls', callsRouter);

// Add webhook routes at the top
app.get('/api/sms/webhook', (req, res) => {
    console.log('GET webhook endpoint hit');
    res.send('Webhook endpoint is working!');
});

app.post('/api/sms/webhook', (req, res) => {
    console.log('📱 SMS Webhook triggered');
    try {
        // Log the entire request body
        console.log('📥 Raw webhook data:', JSON.stringify(req.body, null, 2));
        
        // Handle message status updates
        if (req.body.MessageStatus) {
            twilioService.handleMessageStatusUpdate(req.body);
        }
        
        // Handle incoming messages
        if (req.body.Body) {
            const messageData = {
                from: req.body.From,
                to: req.body.To,
                body: req.body.Body,
                messageSid: req.body.MessageSid,
                smsSid: req.body.SmsSid,
                accountSid: req.body.AccountSid,
                status: req.body.MessageStatus || 'received',
                direction: 'inbound'
            };
            
            console.log('📨 Received SMS:', messageData);

            // Emit the message to connected clients
            const recipientSocket = connectedClients.get(messageData.to);
            if (recipientSocket) {
                recipientSocket.emit('newMessage', messageData);
                console.log('✅ Emitted new message to recipient');
            }

            const senderSocket = connectedClients.get(messageData.from);
            if (senderSocket) {
                senderSocket.emit('newMessage', messageData);
                console.log('✅ Emitted new message to sender');
            }
        }
        
        // Send a TwiML response
        res.type('text/xml');
        res.send(`
            <Response>
                <Message>Message received</Message>
            </Response>
        `);
        
        console.log('✅ Webhook processed successfully');
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).send('Error processing webhook');
    }
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Email routes
app.get('/api/emails/:folder', async (req, res) => {
    try {
        const { folder } = req.params;
        console.log(`📧 Fetching emails from ${folder}`);

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `in:${folder}`,
            maxResults: 20
        });

        if (!response.data.messages) {
            return res.json([]);
        }

        const emails = await Promise.all(
            response.data.messages.map(async (message) => {
                try {
                    return await getEmailContent(message.id);
                } catch (error) {
                    console.error(`Error fetching email ${message.id}:`, error);
                    return null;
                }
            })
        );

        const validEmails = emails.filter(email => email !== null);
        res.json(validEmails);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/emails/send', async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        console.log('📧 Sending email:', { to, subject });

        const transporter = await createTransporter();
        await transporter.sendMail({
            from: process.env.GMAIL_ADDRESS,
            to,
            subject,
            html: body
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

// SMS Routes
app.post('/api/sms/send', async (req, res) => {
    try {
        const { to, from, message } = req.body;
        const result = await twilioService.sendSMS(to, from, message);
        res.json(result);
    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sms/history/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const messages = await twilioService.getMessageHistory(number);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching SMS history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Call Routes
app.post('/api/calls/make', async (req, res) => {
    try {
        const { to, from } = req.body;
        const result = await twilioService.makeCall(to, from);
        res.json(result);
    } catch (error) {
        console.error('Error making call:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/calls/history/:number', async (req, res) => {
    try {
        const { number } = req.params;
        const calls = await twilioService.getCallHistory(number);
        res.json(calls);
    } catch (error) {
        console.error('Error fetching call history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this with your other SMS routes
app.post('/api/sms/verify-caller-id', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        console.log('Requesting Caller ID verification for:', phoneNumber);
        
        const result = await twilioService.requestCallerIdVerification(phoneNumber);
        res.json({
            success: true,
            message: 'Verification code will be sent to your phone',
            result
        });
    } catch (error) {
        console.error('Error requesting Caller ID verification:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this with your other routes
app.post('/api/calls/webhook', (req, res) => {
    console.log('📞 Call Status Update:', {
        callSid: req.body.CallSid,
        callStatus: req.body.CallStatus,
        direction: req.body.Direction,
        from: req.body.From,
        to: req.body.To,
        digits: req.body.Digits,
        speechResult: req.body.SpeechResult
    });

    // Handle user input
    if (req.body.Digits || req.body.SpeechResult) {
        res.type('text/xml');
        res.send(`
            <Response>
                <Say>You ${req.body.Digits ? 'pressed ' + req.body.Digits : 'said ' + req.body.SpeechResult}</Say>
                <Play>http://demo.twilio.com/docs/classic.mp3</Play>
            </Response>
        `);
        return;
    }

    // Initial TwiML response
    res.type('text/xml');
    res.send(`
        <Response>
            <Say>Hello! This is a test call from your Twilio number.</Say>
            <Pause length="1"/>
            <Say>Press any key to continue.</Say>
            <Gather input="dtmf speech" timeout="3" numDigits="1">
                <Say>You can speak or press a key.</Say>
            </Gather>
            <Play>http://demo.twilio.com/docs/classic.mp3</Play>
        </Response>
    `);
});

// Add this near the top with your other routes
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// Add call status callback endpoint
app.post('/api/calls/status', (req, res) => {
    console.log('📞 Raw Call Status Data:', req.body);
    
    const callData = {
        callSid: req.body.CallSid,
        callStatus: req.body.CallStatus,
        from: req.body.From,
        to: req.body.To,
        direction: req.body.Direction,
        duration: req.body.CallDuration,
        timestamp: new Date().toISOString(),
        // Additional fields that might be useful
        answeredBy: req.body.AnsweredBy,
        queueTime: req.body.QueueTime,
        recordingUrl: req.body.RecordingUrl,
        recordingSid: req.body.RecordingSid
    };

    console.log('📞 Processed Call Status:', callData);

    // Emit the call status update through Socket.IO if needed
    if (callData.from && connectedClients.has(callData.from)) {
        connectedClients.get(callData.from).emit('callStatusUpdate', callData);
    }
    if (callData.to && connectedClients.has(callData.to)) {
        connectedClients.get(callData.to).emit('callStatusUpdate', callData);
    }

    // Send a 200 OK response to acknowledge receipt
    res.status(200).send('OK');
});

// Also keep the existing callback endpoint for backward compatibility
app.post('/api/calls/callbackStatus', (req, res) => {
    console.log('📞 Call Status Callback (Legacy):', {
        callSid: req.body.CallSid,
        callStatus: req.body.CallStatus,
        from: req.body.From,
        to: req.body.To,
        direction: req.body.Direction,
        timestamp: new Date().toISOString()
    });

    // Send a 200 OK response to acknowledge receipt
    res.status(200).send('OK');
});

// Add this helper function
const logConnectedClients = () => {
    console.log('📱 Connected clients:');
    connectedClients.forEach((socket, key) => {
        console.log(`- ${key}: ${socket.id}`);
    });
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New socket connection:', socket.id);

    socket.on('register', (phoneNumber) => {
        console.log('📱 Client registered:', phoneNumber);
        connectedClients.set(phoneNumber, socket);
        console.log('Current connected clients:', Array.from(connectedClients.keys()));
    });

    // Add this new handler for SMS
    socket.on('sendMessage', async (data) => {
        try {
            console.log('📱 Sending message:', data);
            const result = await twilioService.sendSMS(data.to, data.from, data.message);
            
            // Create message data with proper format
            const messageData = {
                sid: result.sid,
                body: data.message,
                from: data.from,
                to: data.to,
                dateCreated: new Date().toISOString(),
                status: 'sent',
                direction: 'outbound'
            };

            // Emit to sender immediately
            socket.emit('messageSent', messageData);
            
            // Emit to recipient if they're connected
            const recipientSocket = connectedClients.get(data.to);
            if (recipientSocket) {
                recipientSocket.emit('messageReceived', {
                    ...messageData,
                    direction: 'inbound'
                });
            }

            console.log('✅ Message emitted to clients');
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('messageError', { error: error.message });
        }
    });

    // Update the requestInitialHistory handler
    socket.on('requestInitialHistory', async (phoneNumber) => {
        try {
            console.log('📱 Fetching initial history for:', phoneNumber);
            const messages = await twilioService.getMessageHistory(phoneNumber);
            
            // Process messages
            const processedMessages = messages.map(msg => ({
                sid: msg.sid,
                body: msg.body || 'No message content',
                from: msg.from,
                to: msg.to,
                dateCreated: msg.dateCreated,
                status: msg.status,
                direction: msg.from === phoneNumber ? 'outbound' : 'inbound'
            }));

            // Process conversations
            const conversationMap = new Map();
            processedMessages.forEach(msg => {
                const otherParty = msg.direction === 'outbound' ? msg.to : msg.from;
                if (!conversationMap.has(otherParty) || 
                    new Date(msg.dateCreated) > new Date(conversationMap.get(otherParty).dateCreated)) {
                    conversationMap.set(otherParty, {
                        phoneNumber: otherParty,
                        lastMessage: msg.body,
                        timestamp: msg.dateCreated
                    });
                }
            });

            const conversations = Array.from(conversationMap.values());

            // Send initial data to client
            socket.emit('initialHistory', {
                messages: processedMessages,
                conversations
            });
        } catch (error) {
            console.error('Error fetching initial history:', error);
            socket.emit('error', { message: 'Error fetching message history' });
        }
    });

    socket.on('acceptCall', async (data) => {
        try {
            console.log('\n📞 === ACCEPTING CALL ===');
            console.log('Call data:', data);
            
            // Only process if we haven't handled this call yet
            if (!handledCalls.has(data.callSid)) {
                handledCalls.add(data.callSid);
                
                // Use client2 since that's the account receiving the call
                const client = twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2);
                
                // Update the call with accept URL
                const call = await client.calls(data.callSid)
                    .update({
                        url: `${process.env.NGROK_URL}/api/voice/accept`,
                        method: 'POST',
                        statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
                        statusCallbackMethod: 'POST',
                        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
                    });

                console.log('Call updated:', {
                    sid: call.sid,
                    status: call.status
                });

                // Emit status update
                io.emit('callStatusUpdate', {
                    callSid: data.callSid,
                    callStatus: 'in-progress',
                    from: data.from,
                    to: data.to
                });

                console.log('✅ Call accepted and connected');
            } else {
                console.log('Call already handled, skipping');
            }
            
            console.log('📞 === ACCEPTING CALL END ===\n');
        } catch (error) {
            console.error('Error accepting call:', error);
        }
    });

    socket.on('declineCall', async (data) => {
        try {
            console.log('Call declined:', data);
            await twilioService.rejectCall(data.callSid);
        } catch (error) {
            console.error('Error declining call:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        // Remove from connectedClients
        connectedClients.forEach((value, key) => {
            if (value.id === socket.id) {
                connectedClients.delete(key);
                console.log('Removed client:', key);
            }
        });
    });

    // Handle call initiation
    socket.on('initiateCall', (data) => {
        console.log('📞 Call initiated:', data);
        const clientSocket = connectedClients.get(process.env.TWILIO_NUMBER_1);
        if (clientSocket) {
            clientSocket.emit('callInitiated', {
                ...data,
                status: 'initiating'
            });
        }
    });

    // Handle call rejection
    socket.on('rejectCall', (data) => {
        console.log('📞 Call rejected:', data);
        const clientSocket = connectedClients.get(process.env.TWILIO_NUMBER_1);
        if (clientSocket) {
            clientSocket.emit('callRejected', {
                ...data,
                status: 'rejected'
            });
        }
    });

    // Handle call end
    socket.on('endCall', async (data) => {
        try {
            console.log('Ending call:', data);
            // Use client2 since that's the account handling the call
            const client = twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2);
            
            // End the call
            await client.calls(data.callSid)
                .update({
                    status: 'completed'
                });

            console.log('Call ended successfully');
        } catch (error) {
            console.error('Error ending call:', error);
        }
    });

    // Handle DTMF (dial pad) input
    socket.on('sendDigit', (data) => {
        console.log('📞 DTMF digit sent:', data);
        const clientSocket = connectedClients.get(process.env.TWILIO_NUMBER_1);
        if (clientSocket) {
            clientSocket.emit('digitSent', {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    });
});

// Add voice fallback endpoint
app.post('/api/voice/fallback', (req, res) => {
    console.log('📞 Voice fallback triggered:', req.body);
    const twimlResponse = twilioService.handleVoiceFallback(req.body);
    res.type('text/xml');
    res.send(twimlResponse);
});

// Update the voice endpoint
app.post('/api/voice', (req, res) => {
    console.log('\n📞 === VOICE WEBHOOK START ===');
    console.log('Request body:', req.body);
    
    const twiml = new VoiceResponse();
    
    try {
        // Check if it's a client call
        const isClientCall = req.body.From?.startsWith('client:');
        console.log('Call type:', isClientCall ? 'Client call' : 'Incoming call');

        if (isClientCall) {
            // Set target number to TWILIO_NUMBER_2 and ensure it's in E.164 format
            const toNumber = process.env.TWILIO_NUMBER_2;
            console.log('Setting call to:', toNumber);

            // First, notify connected clients about incoming call
            console.log('Connected clients:', Array.from(connectedClients.keys()));
            
            // Create call data with proper "to" number
            const callData = {
                from: req.body.From || 'client:Anonymous',
                to: toNumber,  // Use the target number
                callSid: req.body.CallSid,
                direction: 'inbound',
                status: 'ringing'
            };
            console.log('Emitting call data:', callData);

            // Emit to connected clients
            connectedClients.forEach((clientSocket, phoneNumber) => {
                console.log(`Attempting to emit incoming call event to ${phoneNumber}`);
                try {
                    clientSocket.emit('incomingCall', callData);
                    console.log(`Successfully emitted incoming call event to ${phoneNumber}`);
                } catch (error) {
                    console.error(`Failed to emit to ${phoneNumber}:`, error);
                }
            });

            // Play ringing tone and wait for answer
            twiml.play('https://api.twilio.com/cowbell.mp3');
            twiml.say({ voice: 'alice' }, 'Please wait while we connect you.');
            twiml.pause({ length: 2 });

            // Add dial with specific target number
            const dial = twiml.dial({
                answerOnBridge: true,
                callerId: process.env.TWILIO_NUMBER_1,
                action: `${process.env.NGROK_URL}/api/voice/status`,
                method: 'POST',
                to: toNumber  // Add the target number here too
            });
            dial.number(toNumber);

            // Add gather to keep the call alive
            const gather = twiml.gather({
                timeout: 30,
                numDigits: 1
            });
            gather.say({ voice: 'alice' }, 'Please wait for your call to be accepted.');
        } else {
            // Regular incoming call
            twiml.play('https://api.twilio.com/cowbell.mp3');
            twiml.say({ voice: 'alice' }, 'Please wait while we connect you.');
            twiml.pause({ length: 2 });
            
            const dial = twiml.dial({
                answerOnBridge: true,
                callerId: process.env.TWILIO_NUMBER_1,
                timeout: 30
            });
            dial.client('browser');
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

// Update the voice status endpoint
app.post('/api/voice/status', (req, res) => {
    console.log('\n📞 === CALL STATUS UPDATE ===');
    
    // Ensure we have a "to" number
    const toNumber = req.body.To || process.env.TWILIO_NUMBER_2;
    
    const statusData = {
        callSid: req.body.CallSid,
        callStatus: req.body.CallStatus,
        from: req.body.From || 'client:Anonymous',
        to: toNumber,
        direction: req.body.Direction || 'inbound'
    };
    
    console.log('Call Status:', statusData);

    // Emit status update to connected clients
    connectedClients.forEach((clientSocket, phoneNumber) => {
        clientSocket.emit('callStatus', statusData);
    });

    res.sendStatus(200);
});

// Add gather endpoint to handle trial message
app.post('/api/voice/gather', (req, res) => {
    console.log('📞 Gather endpoint hit:', req.body);
    const twiml = new VoiceResponse();
    
    if (req.body.Digits) {
        // If any key was pressed, continue with the call
        twiml.say({ voice: 'alice' }, 'Thank you. Connecting your call.');
        const dial = twiml.dial({
            answerOnBridge: true,
            callerId: process.env.TWILIO_NUMBER_1
        });
        dial.number(process.env.TWILIO_NUMBER_1);
    } else {
        // Gather any keypress
        const gather = twiml.gather({
            numDigits: 1,
            action: `${process.env.NGROK_URL}/api/voice/gather`,
            method: 'POST'
        });
        gather.say({ voice: 'alice' }, 'Please press any key to continue with your call.');
        
        // Add a fallback if no key is pressed
        twiml.redirect(`${process.env.NGROK_URL}/api/voice/gather`);
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});

// 404 handler should be last
app.use((req, res) => {
    console.log(`404: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not Found' });
});

// Update the TwiML app configuration function
const updateTwimlApp = async () => {
    try {
        console.log('\n📞 === UPDATING TWIML APP ===');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID_1, process.env.TWILIO_AUTH_TOKEN_1);
        
        let app;
        try {
            // Try to update existing app
            app = await client.applications(process.env.TWILIO_TWIML_APP_SID)
                .update({
                    voiceUrl: `${process.env.NGROK_URL}/api/voice`,
                    voiceMethod: 'POST',
                    voiceFallbackUrl: `${process.env.NGROK_URL}/api/voice/fallback`,
                    voiceFallbackMethod: 'POST',
                    statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
                    statusCallbackMethod: 'POST',
                    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
                });
        } catch (error) {
            if (error.code === 20404) {
                console.log('TwiML App not found, creating new one...');
                // Create new TwiML App
                app = await client.applications
                    .create({
                        friendlyName: 'OmniChannel Voice App',
                        voiceUrl: `${process.env.NGROK_URL}/api/voice`,
                        voiceMethod: 'POST',
                        voiceFallbackUrl: `${process.env.NGROK_URL}/api/voice/fallback`,
                        voiceFallbackMethod: 'POST',
                        statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
                        statusCallbackMethod: 'POST',
                        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
                    });
                
                console.log('🆕 Created new TwiML App with SID:', app.sid);
                console.log('⚠️ Please update your .env file with the new TWILIO_TWIML_APP_SID:', app.sid);
            } else {
                throw error;
            }
        }

        console.log('TwiML App Configuration:', {
            sid: app.sid,
            voiceUrl: app.voiceUrl,
            statusCallback: app.statusCallback
        });
        console.log('✅ TwiML app updated successfully\n');

        return app;
    } catch (error) {
        console.error('❌ Error updating TwiML app:', error);
        console.error('Error details:', error.message);
        throw error;
    }
};

// Update server startup to handle TwiML App creation
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    try {
        const app = await updateTwimlApp();
        
        // Update phone number configuration
        const client = twilio(process.env.TWILIO_ACCOUNT_SID_1, process.env.TWILIO_AUTH_TOKEN_1);
        
        // First, list all incoming phone numbers
        const numbers = await client.incomingPhoneNumbers.list();
        const ourNumber = numbers.find(n => n.phoneNumber === process.env.TWILIO_NUMBER_1);
        
        if (ourNumber) {
            // Update the phone number configuration
            await client.incomingPhoneNumbers(ourNumber.sid)
                .update({
                    voiceApplicationSid: app.sid
                });
            console.log('✅ Phone number updated with new TwiML App');
        } else {
            console.log('⚠️ Phone number not found in account, skipping update');
        }
    } catch (error) {
        console.error('Failed to start server properly:', error);
        if (error.code === 20404) {
            console.log('⚠️ Phone number not found, continuing anyway...');
        }
        // Continue running the server even if TwiML setup fails
    }
}); 