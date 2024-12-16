import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import messagesRouter from './routes/messages.routes';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - IMPORTANT: This should be before the API routes
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Connect to MongoDB
connectDB().catch(console.error);

// Routes
app.use('/api/messages', messagesRouter);

// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Use httpServer instead of app.listen
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  let currentAccount = '';

  socket.on('join', (account) => {
    if (currentAccount) {
      socket.leave(currentAccount);
    }
    currentAccount = account;
    socket.join(account);
    console.log(`Account ${account} joined the chat`);
  });

  socket.on('disconnect', () => {
    if (currentAccount) {
      console.log(`Account ${currentAccount} disconnected`);
      socket.leave(currentAccount);
    }
  });
});

export { io };
export default app; 