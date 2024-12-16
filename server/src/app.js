const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const messagesRouter = require('./routes/messages.routes');
const callsRouter = require('./routes/calls.routes');
const voiceRouter = require('./routes/voice.routes');
const verifyRouter = require('./routes/verify.routes');

// Register routes
app.use('/api/messages', messagesRouter);
app.use('/api/calls', callsRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/verify', verifyRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});

module.exports = app; 