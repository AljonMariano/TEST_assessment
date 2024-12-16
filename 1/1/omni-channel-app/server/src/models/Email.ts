import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema({
  from: String,
  to: String,
  subject: String,
  content: String,
  attachments: [{
    filename: String,
    path: String,
    contentType: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  },
  folder: {
    type: String,
    enum: ['inbox', 'sent', 'trash', 'starred'],
    default: 'inbox'
  }
});

export default mongoose.model('Email', emailSchema); 