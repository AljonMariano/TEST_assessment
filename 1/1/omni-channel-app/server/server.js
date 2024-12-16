const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Move PORT declaration to the top
const PORT = process.env.PORT || 5000;

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// CORS configuration - IMPORTANT: Allow requests from your client port
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://192.168.100.9:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Add this line after your other app.use statements
app.use('/uploads', express.static('uploads'));

// Logging middleware
app.use((req, res, next) => {
    console.log(`Incoming ${req.method} request to ${req.url}`);
    console.log('Request body:', req.body);
    next();
});

// Update MongoDB URI to use Atlas instead of local
const MONGODB_URI = 'mongodb+srv://yanokent35:kent213345@cluster0.udbt1.mongodb.net/omnichannel?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB Atlas');
        
        // Test if we can query messages
        const count = await Message.countDocuments();
        console.log(`📊 Current message count: ${count}`);

        // Start server after successful DB connection
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    socket.on('join', (account) => {
        console.log(`👤 User ${socket.id} joined room: ${account}`);
        socket.join(account);
    });

    socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
    });
});

// Add a root route handler
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running',
        availableEndpoints: {
            messages: '/api/messages',
            test: '/test'
        }
    });
});

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!' });
});

// Messages routes
app.get('/api/messages', async (req, res) => {
    try {
        const { account } = req.query;
        console.log('\n🔍 Fetching messages for account:', account);

        if (!account) {
            return res.status(400).json({ error: 'Account parameter is required' });
        }

        // Simplified query to get ALL messages between both numbers
        const query = {
            $or: [
                { sender: { $in: ['+13613392529', '+13613227495'] } },
                { recipient: { $in: ['+13613392529', '+13613227495'] } }
            ]
        };

        const messages = await Message.find(query)
            .sort({ timestamp: -1 })
            .lean();

        console.log(`✅ Found ${messages.length} messages`);

        res.json({
            success: true,
            messages,
            count: messages.length
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', async (req, res) => {
    console.log('📝 New message received:', req.body);
    try {
        const message = new Message(req.body);
        const savedMessage = await message.save();
        console.log('✅ Message saved to database');
        
        // Emit to both sender and recipient rooms
        io.emit('newMessage', savedMessage);
        console.log('📡 Message broadcasted to all clients');
        
        res.status(201).json(savedMessage);
    } catch (error) {
        console.error('❌ Error saving message:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/messages/attachment', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        // Log the file information
        console.log('Uploaded file:', req.file);

        const message = new Message({
            sender: req.body.sender || 'Anonymous',
            content: req.body.content || '',
            timestamp: new Date(),
            attachment: {
                type: req.file.mimetype.startsWith('image/') ? 'image' : 'file',
                url: `/uploads/${req.file.filename}`,
                originalName: req.file.originalname,  // Add original filename
                mimeType: req.file.mimetype,
                size: req.file.size  // Add file size
            }
        });

        const savedMessage = await message.save();
        
        // Log the complete saved message
        console.log('Complete saved message:', JSON.stringify(savedMessage, null, 2));
        
        // Emit the new message to all connected clients
        io.emit('newMessage', savedMessage);

        res.status(201).json(savedMessage);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Add this after your other routes, before the listen call
app.get('/api/messages/test', async (req, res) => {
    try {
        const count = await Message.countDocuments();
        console.log('Total messages in database:', count);
        res.json({ 
            success: true, 
            messageCount: count,
            message: 'Database connection is working'
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Database connection error',
            details: error.message 
        });
    }
});

// Serve static files from the React/Vite app
// app.use(express.static(path.join(__dirname, '../client/dist')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
// });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory');
}

// Serve uploaded files - make sure this is before your routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
