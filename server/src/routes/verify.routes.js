const express = require('express');
const router = express.Router();
const { requestCallerIdVerification, verifyNumberForVoice, checkVoiceVerification } = require('../services/twilio.service');

// Request caller ID verification
router.post('/caller-id', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        console.log('📱 Verifying caller ID for:', phoneNumber);
        
        const validationRequest = await requestCallerIdVerification(phoneNumber);
        res.json({
            success: true,
            message: 'Verification initiated',
            data: validationRequest
        });
    } catch (error) {
        console.error('❌ Error verifying caller ID:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Handle verification status callback
router.post('/status', (req, res) => {
    console.log('📱 Verification status update:', req.body);
    res.sendStatus(200);
});

// Add route to start voice verification
router.post('/voice', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const verification = await verifyNumberForVoice(phoneNumber);
        res.json({ success: true, status: verification.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add route to check verification code
router.post('/voice/check', async (req, res) => {
    try {
        const { phoneNumber, code } = req.body;
        const isVerified = await checkVoiceVerification(phoneNumber, code);
        res.json({ success: true, verified: isVerified });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 