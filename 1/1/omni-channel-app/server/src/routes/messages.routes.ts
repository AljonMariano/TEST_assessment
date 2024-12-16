import express from 'express';
import multer, { Multer } from 'multer';
import Message from '../models/Message';
import { io } from '../wiw';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Add index for better query performance
Message.collection.createIndex({ timestamp: -1 });

// Configure multer with error handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload: Multer = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Test MongoDB connection
router.get('/test', async (req, res) => {
  try {
    const count = await Message.countDocuments();
    res.json({ success: true, messageCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Database connection error' });
  }
});

// Get messages with pagination and limit
router.get('/', async (req, res) => {
  try {
    const { account } = req.query;
    
    console.log('GET /messages - Account:', account); // Debug log
    
    if (!account) {
      return res.status(400).json({ error: 'Account parameter is required' });
    }

    // Find messages where the account is either sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: account },
        { recipient: account }
      ]
    })
    .sort({ timestamp: -1 })  // Sort by newest first
    .limit(100);  // Limit to last 100 messages

    console.log('Found messages:', messages.length); // Debug log
    
    res.json({ 
      success: true,
      messages: messages,
      count: messages.length 
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message with optimized error handling
router.post('/', async (req, res) => {
  try {
    const { sender, recipient, content } = req.body;
    
    if (!sender || !recipient || !content) {
      return res.status(400).json({ error: 'Sender, recipient, and content are required' });
    }

    const message = new Message({
      sender,
      recipient,
      content,
      timestamp: new Date()
    });

    await message.save();
    
    // Emit to both sender and recipient rooms
    io.to(sender).to(recipient).emit('newMessage', message);
    
    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload attachment with better error handling
router.post('/attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    // Validate sender and recipient
    if (!req.body.sender || !req.body.recipient) {
      throw new Error('Sender and recipient are required');
    }

    const message = new Message({
      sender: req.body.sender,
      recipient: req.body.recipient,
      content: req.body.content || '',
      timestamp: new Date(),
      attachment: {
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });

    const savedMessage = await message.save();
    
    // Emit only once to specific rooms
    if (message.sender && message.recipient) {
      io.to(message.sender).to(message.recipient).emit('newMessage', savedMessage);
    }
    
    res.status(201).json(savedMessage);
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router; 