const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    content: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    attachment: {
        type: {
            type: String,
            enum: ['image', 'file']
        },
        url: String,
        originalName: String,
        mimeType: String,
        size: Number
    }
});

module.exports = mongoose.model('Message', messageSchema);
