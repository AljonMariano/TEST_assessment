import express from 'express';
import messageRoutes from './messages.routes';
import emailRoutes from './email.routes';

const router = express.Router();

// Mount routes
router.use('/messages', messageRoutes);
router.use('/emails', emailRoutes);

// Add a test route to verify API is working
router.get('/', (req, res) => {
  res.json({
    message: 'API is working',
    endpoints: {
      messages: '/messages',
      emails: '/emails'
    }
  });
});

export default router;