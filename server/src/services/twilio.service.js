const twilio = require('twilio');
require('dotenv').config();

// Create clients for both accounts
const client1 = twilio(
    process.env.TWILIO_ACCOUNT_SID_1,
    process.env.TWILIO_AUTH_TOKEN_1
);

const client2 = twilio(
    process.env.TWILIO_ACCOUNT_SID_2,
    process.env.TWILIO_AUTH_TOKEN_2
);

// Create Verify Services for both accounts
const verifyService1 = client1.verify.v2.services(process.env.TWILIO_VERIFY_SID_1);
const verifyService2 = client2.verify.v2.services(process.env.TWILIO_VERIFY_SID_2);

// Get verified numbers array
const VERIFIED_NUMBERS = process.env.VERIFIED_PHONE_NUMBERS.split(',');

// Test mode configuration
const TEST_MODE = process.env.TWILIO_TEST_MODE === 'true';
const TEST_VERIFICATION_CODE = '123456'; // Fixed test verification code

// Store test messages in memory (for development only)
let testMessages = [];

const formatPhoneNumber = (phoneNumber) => {
    console.log('Formatting phone number:', phoneNumber);
    
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    console.log('Cleaned number:', cleaned);
    
    // Handle Philippine numbers
    if (cleaned.startsWith('0')) {
        // Convert 09XX to +639XX
        cleaned = '63' + cleaned.substring(1);
    } else if (cleaned.startsWith('9')) {
        // Convert 9XX to +639XX
        cleaned = '63' + cleaned;
    } else if (cleaned.startsWith('63')) {
        // Already has country code
        cleaned = cleaned;
    }
    
    // Add + prefix if missing
    const formatted = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
    
    console.log('Formatted number:', formatted);
    return formatted;
};

const getClientForNumber = (number) => {
    if (number === process.env.TWILIO_NUMBER_1) {
        return client1;
    } else if (number === process.env.TWILIO_NUMBER_2) {
        return client2;
    }
    throw new Error(`No client found for number: ${number}`);
};

const isVerifiedNumber = (number) => {
    const formattedNumber = formatPhoneNumber(number);
    // Allow Twilio numbers to communicate with each other
    if (formattedNumber === process.env.TWILIO_NUMBER_1 || 
        formattedNumber === process.env.TWILIO_NUMBER_2) {
        return true;
    }
    return VERIFIED_NUMBERS.includes(formattedNumber);
};

const getVerifyServiceForNumber = (number) => {
    if (number === process.env.TWILIO_NUMBER_1) {
        return verifyService1;
    } else if (number === process.env.TWILIO_NUMBER_2) {
        return verifyService2;
    }
    throw new Error(`No verify service found for number: ${number}`);
};

// Mock message for test mode
const createTestMessage = (to, from, body, direction = null) => {
    const message = {
        sid: 'TEST_MSG_' + Date.now(),
        body: body,
        from: from,
        to: to,
        direction: direction || (from === process.env.TWILIO_NUMBER_1 || from === process.env.TWILIO_NUMBER_2 ? 'outbound' : 'inbound'),
        status: 'delivered',
        dateCreated: new Date().toISOString()
    };
    
    // Add to test messages if in test mode
    if (TEST_MODE) {
        testMessages.push(message);
        console.log('Added new test message:', message);
        console.log('Current test messages:', testMessages);
    }
    
    return message;
};

const sendSMS = async (to, from, body) => {
    console.log('🔍 SMS Request:', { to, from, body });
    
    try {
        const formattedTo = formatPhoneNumber(to);
        const formattedFrom = formatPhoneNumber(from);
        
        const client = getClientForNumber(formattedFrom);
        
        const message = await client.messages.create({
            to: formattedTo,
            from: formattedFrom,
            body,
            statusCallback: `${process.env.NGROK_URL}/api/sms/webhook`
        });

        // Create message data
        const messageData = {
            sid: message.sid,
            body: message.body,
            from: message.from,
            to: message.to,
            direction: 'outbound-api',
            status: message.status,
            dateCreated: new Date().toISOString()
        };

        // Emit to connected clients immediately
        const senderSocket = global.io?.sockets.connected[global.connectedClients.get(formattedFrom)];
        if (senderSocket) {
            senderSocket.emit('messageSent', messageData);
        }

        const recipientSocket = global.io?.sockets.connected[global.connectedClients.get(formattedTo)];
        if (recipientSocket) {
            recipientSocket.emit('messageReceived', messageData);
        }

        return messageData;
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};

const getMessageHistory = async (number) => {
    console.log('🔍 Fetching message history for:', number);
    try {
        let allMessages = [];
        const clients = [client1, client2]; // Use both clients to fetch messages
        
        // Fetch messages from both accounts
        for (const client of clients) {
            try {
                // Fetch messages where the number is either sender or recipient
                const sentMessages = await client.messages.list({
                    from: number,
                    limit: 50
                });
                
                const receivedMessages = await client.messages.list({
                    to: number,
                    limit: 50
                });
                
                allMessages = [...allMessages, ...sentMessages, ...receivedMessages];
            } catch (err) {
                console.log('Error fetching from client, continuing...', err.message);
            }
        }

        // Sort messages by date
        allMessages.sort((a, b) => 
            new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
        );

        // Remove duplicates based on message SID
        const uniqueMessages = Array.from(
            new Map(allMessages.map(msg => [msg.sid, msg])).values()
        );

        console.log('✅ Fetched messages:', {
            total: uniqueMessages.length,
            number
        });

        return uniqueMessages;
    } catch (error) {
        console.error('❌ Error fetching message history:', error);
        throw error;
    }
};

// Add this new function to handle message status updates
const handleMessageStatusUpdate = async (statusData) => {
    console.log('📱 Message status update:', statusData);
    
    try {
        const { MessageSid, MessageStatus, To, From } = statusData;
        
        // Find the socket for the sender
        const senderSocket = global.connectedClients?.get(From);
        if (senderSocket) {
            senderSocket.emit('messageStatusUpdate', {
                sid: MessageSid,
                status: MessageStatus,
                to: To,
                from: From
            });
            console.log('✅ Emitted status update to sender');
        }

        // Find the socket for the recipient
        const recipientSocket = global.connectedClients?.get(To);
        if (recipientSocket) {
            recipientSocket.emit('messageStatusUpdate', {
                sid: MessageSid,
                status: MessageStatus,
                to: To,
                from: From
            });
            console.log('✅ Emitted status update to recipient');
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Error handling message status update:', error);
        throw error;
    }
};

// Update makeCall function to use proper number formatting
const makeCall = async (to, from) => {
    try {
        console.log('Initial call request:', { to, from });
        
        // Format the destination number properly
        const formattedTo = formatPhoneNumber(to);
        
        // Use the second Twilio account and number
        const fromNumber = process.env.TWILIO_NUMBER_2;  // +13613227495
        
        console.log('Making call with formatted numbers:', {
            originalTo: to,
            formattedTo: formattedTo,
            from: fromNumber
        });
        
        // Use client2 for the second Twilio account
        const client = twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2);
        
        const call = await client.calls.create({
            to: formattedTo,
            from: fromNumber,
            url: `${process.env.NGROK_URL}/api/voice/outbound`,
            statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST'
        });
        
        console.log('Call created:', call.sid);
        return call;
    } catch (error) {
        console.error('Error in makeCall:', error);
        throw error;
    }
};

const getCallHistory = async (number) => {
    try {
        const client = getClientForNumber(number);
        const calls = await client.calls.list({
            limit: 50,
            from: number
        });
        return calls;
    } catch (error) {
        console.error('Error fetching call history:', error);
        throw error;
    }
};

const sendVerificationCode = async (to, from, channel = 'sms') => {
    try {
        const formattedTo = formatPhoneNumber(to);
        
        // In test mode, skip the number verification check
        if (!TEST_MODE && !isVerifiedNumber(formattedTo)) {
            throw new Error(`Number ${formattedTo} is not verified. Please verify this number in your Twilio console first.`);
        }

        // In test mode, return a mock verification response
        if (TEST_MODE) {
            console.log('TEST MODE: Sending verification code:', {
                to: formattedTo,
                from: from,
                channel: channel,
                testCode: TEST_VERIFICATION_CODE
            });
            
            return {
                status: 'pending',
                to: formattedTo,
                channel: channel,
                valid: false,
                sid: 'TEST_VERIFICATION_' + Date.now()
            };
        }

        const verifyService = getVerifyServiceForNumber(from);
        
        // Log the verify service configuration
        console.log('Verify Service Configuration:', {
            serviceSid: verifyService.serviceSid,
            accountSid: verifyService._solution.accountSid,
            from: from,
            channel: channel
        });

        // First check if there's a pending verification
        const verifications = await verifyService.verifications.list({to: formattedTo});
        console.log('Existing verifications:', verifications);
        
        const pendingVerification = verifications.find(v => v.status === 'pending');
        if (pendingVerification) {
            console.log('Found pending verification:', pendingVerification);
            // If there's a pending verification, cancel it
            await verifyService.verifications(pendingVerification.sid).update({status: 'canceled'});
        }
        
        // Create new verification with explicit channel configuration
        const verification = await verifyService.verifications.create({
            to: formattedTo,
            channel: channel, // Can be 'sms' or 'call'
            locale: 'en',
            // Custom message for SMS only
            ...(channel === 'sms' ? {
                customMessage: 'Your verification code for Omni-Channel App is: {code}'
            } : {})
        });
        
        console.log('Verification initiated:', {
            to: formattedTo,
            status: verification.status,
            valid: verification.valid,
            sid: verification.sid,
            channel: verification.channel,
            serviceSid: verification.serviceSid
        });
        
        return verification;
    } catch (error) {
        console.error('Error sending verification code:', {
            error: error.message,
            code: error.code,
            moreInfo: error.moreInfo,
            status: error.status
        });
        throw error;
    }
};

const checkVerificationCode = async (to, from, code) => {
    try {
        const formattedTo = formatPhoneNumber(to);

        // In test mode, check against test verification code
        if (TEST_MODE) {
            console.log('TEST MODE: Checking verification code:', {
                to: formattedTo,
                code: code,
                testCode: TEST_VERIFICATION_CODE
            });

            const isValid = code === TEST_VERIFICATION_CODE;
            return {
                status: isValid ? 'approved' : 'failed',
                valid: isValid,
                to: formattedTo,
                sid: 'TEST_VERIFICATION_CHECK_' + Date.now()
            };
        }

        const verifyService = getVerifyServiceForNumber(from);
        
        const verificationCheck = await verifyService.verificationChecks.create({
            to: formattedTo,
            code: code
        });
        
        console.log('Verification check:', {
            to: formattedTo,
            status: verificationCheck.status,
            valid: verificationCheck.valid,
            sid: verificationCheck.sid
        });
        
        return verificationCheck;
    } catch (error) {
        console.error('Error checking verification code:', error);
        throw error;
    }
};

const requestCallerIdVerification = async (phoneNumber) => {
    try {
        const formattedNumber = formatPhoneNumber(phoneNumber);
        console.log('📱 Requesting Caller ID verification for:', formattedNumber);
        
        // Use client1 for validation requests
        const validationRequest = await client1.validationRequests.create({
            friendlyName: 'Twilio Trial Number',
            phoneNumber: formattedNumber,
            // Use call for verification since it's a Twilio number
            method: 'call',
            // Add status callback
            statusCallback: `${process.env.NGROK_URL || 'http://localhost:5001'}/api/verify/status`
        });
        
        console.log(' Validation request created:', {
            sid: validationRequest.sid,
            status: validationRequest.status,
            phoneNumber: validationRequest.phoneNumber,
            validationCode: validationRequest.validationCode
        });
        
        // Add to verified numbers array
        if (!VERIFIED_NUMBERS.includes(formattedNumber)) {
            VERIFIED_NUMBERS.push(formattedNumber);
        }
        
        return validationRequest;
    } catch (error) {
        console.error('❌ Error requesting Caller ID verification:', error);
        throw error;
    }
};

// Add this function to update TwiML app
const updateTwimlApp = async () => {
    try {
        const client = client1;
        const app = await client.applications(process.env.TWILIO_TWIML_APP_SID)
            .update({
                voiceUrl: `${process.env.NGROK_URL}/api/voice`,
                voiceMethod: 'POST',
                statusCallback: `${process.env.NGROK_URL}/api/voice/status`,
                statusCallbackMethod: 'POST'
            });
        return app;
    } catch (error) {
        console.error('Error updating TwiML App:', error);
        throw error;
    }
};

// Add this endpoint to handle voice fallback
const handleVoiceFallback = (error) => {
    const twiml = new twilio.twiml.VoiceResponse();
    console.error('Voice Fallback Error:', error);
    twiml.say({ voice: 'alice' }, 'Sorry, we encountered an error with your call. Please try again.');
    return twiml.toString();
};

const endCall = async (callSid) => {
    try {
        console.log('📞 Attempting to end call:', callSid);
        // Try both clients since we might not know which account owns the call
        const clients = [
            twilio(process.env.TWILIO_ACCOUNT_SID_1, process.env.TWILIO_AUTH_TOKEN_1),
            twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2)
        ];
        
        let success = false;
        
        for (const client of clients) {
            try {
                // Try to end the call with this client
                await client.calls(callSid)
                    .update({
                        status: 'completed',
                        twiml: new twilio.twiml.VoiceResponse().hangup().toString()
                    });
                    
                success = true;
                break;  // Exit loop if successful
            } catch (err) {
                // Continue to next client if this one fails
                console.log('Trying next client...');
            }
        }

        if (!success) {
            throw new Error('Could not end call with any available client');
        }

        console.log('✅ Call ended successfully:', callSid);
        return true;
    } catch (error) {
        console.error('❌ Error ending call:', error);
        return false;
    }
};

const rejectCall = async (callSid) => {
    try {
        console.log('📞 Rejecting call:', callSid);
        const clients = [
            twilio(process.env.TWILIO_ACCOUNT_SID_1, process.env.TWILIO_AUTH_TOKEN_1),
            twilio(process.env.TWILIO_ACCOUNT_SID_2, process.env.TWILIO_AUTH_TOKEN_2)
        ];
        
        let success = false;
        
        for (const client of clients) {
            try {
                await client.calls(callSid)
                    .update({
                        status: 'completed',
                        twiml: new twilio.twiml.VoiceResponse()
                            .reject({ reason: 'rejected' })
                            .toString()
                    });
                    
                success = true;
                break;
            } catch (err) {
                console.log('Trying next client...');
            }
        }

        if (!success) {
            throw new Error('Could not reject call with any available client');
        }

        console.log('✅ Call rejected successfully:', callSid);
        return true;
    } catch (error) {
        console.error('❌ Error rejecting call:', error);
        return false;
    }
};

const getCallStatus = async (callSid) => {
    try {
        const client = getClientForNumber(process.env.TWILIO_NUMBER_1);
        const call = await client.calls(callSid).fetch();
        return {
            callSid: call.sid,
            status: call.status,
            direction: call.direction,
            from: call.from,
            to: call.to,
            duration: call.duration
        };
    } catch (error) {
        console.error('Error fetching call status:', error);
        throw error;
    }
};

// Add this function to verify numbers for voice calls
const verifyNumberForVoice = async (phoneNumber) => {
    try {
        console.log('Starting voice verification for:', phoneNumber);
        
        const formattedNumber = formatPhoneNumber(phoneNumber);
        
        // Start verification
        const verification = await verifyService1.verifications.create({
            to: formattedNumber,
            channel: 'call'  // Use call channel for voice verification
        });
        
        console.log('Verification initiated:', verification.status);
        return verification;
    } catch (error) {
        console.error('Error verifying number:', error);
        throw error;
    }
};

// Add this function to check verification status
const checkVoiceVerification = async (phoneNumber, code) => {
    try {
        const formattedNumber = formatPhoneNumber(phoneNumber);
        
        const verification = await verifyService1.verificationChecks.create({
            to: formattedNumber,
            code: code
        });
        
        return verification.status === 'approved';
    } catch (error) {
        console.error('Error checking verification:', error);
        throw error;
    }
};

module.exports = {
    sendSMS,
    makeCall,
    getMessageHistory,
    getCallHistory,
    sendVerificationCode,
    checkVerificationCode,
    isVerifiedNumber,
    formatPhoneNumber,
    createTestMessage,
    requestCallerIdVerification,
    handleMessageStatusUpdate,
    updateTwimlApp,
    handleVoiceFallback,
    endCall,
    rejectCall,
    getCallStatus,
    verifyNumberForVoice,
    checkVoiceVerification
}; 