const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilio.service');

// Get chat messages
router.get('/', async (req, res) => {
    try {
        const { account } = req.query;
        if (!account) {
            return res.status(400).json({ 
                success: false, 
                error: 'Account number is required' 
            });
        }

        const messages = await twilioService.getMessageHistory(account);
        res.json({ 
            success: true, 
            messages,
            count: messages.length 
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Send chat message
router.post('/', async (req, res) => {
    try {
        const { to, from, content } = req.body;
        const result = await twilioService.sendSMS(to, from, content);
        res.json({ 
            success: true, 
            message: result 
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router; 