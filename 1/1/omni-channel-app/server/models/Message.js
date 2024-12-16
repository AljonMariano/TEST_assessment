const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: false,
    default: ''
  },
  sender: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  attachment: {
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'file'],
    },
    url: String,
    mimeType: String
  }
});

module.exports = mongoose.model('Message', messageSchema);