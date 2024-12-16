const express = require('express');
const router = express.Router();
const { 
    sendSMS, 
    getMessageHistory, 
    sendVerificationCode, 
    checkVerificationCode,
    isVerifiedNumber,
    formatPhoneNumber 
} = require('../services/twilio.service');

// Get message history
router.get('/history/:number', async (req, res) => {
    try {
        const messages = await getMessageHistory(req.params.number);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching message history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send SMS
router.post('/send', async (req, res) => {
    try {
        const { to, from, message } = req.body;
        const formattedTo = formatPhoneNumber(to);
        
        // Check if number needs verification
        const needsVerification = !isVerifiedNumber(formattedTo);
        
        // Try to send message
        const result = await sendSMS(to, from, message);
        
        // Return success with verification status
        res.json({ 
            ...result, 
            needsVerification,
            message: needsVerification ? 'Number requires verification' : 'Message sent successfully'
        });
    } catch (error) {
        console.error('Error sending SMS:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send verification code (supports both SMS and voice)
router.post('/verify/send', async (req, res) => {
    try {
        const { to, from, channel = 'sms' } = req.body;
        const verification = await sendVerificationCode(to, from, channel);
        res.json({ 
            success: true, 
            verification,
            message: `Verification code will be ${channel === 'call' ? 'called' : 'sent'} to ${to}`
        });
    } catch (error) {
        console.error('Error sending verification code:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check verification code
router.post('/verify/check', async (req, res) => {
    try {
        const { to, from, code } = req.body;
        const verificationCheck = await checkVerificationCode(to, from, code);
        res.json({ 
            success: true, 
            valid: verificationCheck.valid, 
            status: verificationCheck.status 
        });
    } catch (error) {
        console.error('Error checking verification code:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 