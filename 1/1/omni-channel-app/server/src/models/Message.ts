import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: String,
  sender: String,
  recipient: String,
  timestamp: { type: Date, default: Date.now },
  attachment: {
    type: {
      type: String,
      enum: ['image', 'file'],
      required: false
    },
    url: String,
    originalName: String,
    mimeType: String,
    size: Number
  }
});

export default mongoose.model('Message', messageSchema);