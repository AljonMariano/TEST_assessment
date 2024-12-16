import express from 'express';
import multer from 'multer';
import { gmail, createTransporter, initializeGmail, testConnection } from '../services/gmail.service';
import Email from '../models/Email';
import fs from 'fs';

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Email route is working' });
});

// Get emails from a folder
router.get('/:folder', async (req, res) => {
  try {
    // Initialize Gmail before fetching
    const isInitialized = await initializeGmail();
    if (!isInitialized) {
      throw new Error('Gmail service not initialized');
    }

    const { folder } = req.params;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `in:${folder}`,
      maxResults: 20
    });

    const emails = await Promise.all(
      (response.data.messages || []).map(async (message) => {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full'
        });

        const headers = email.data.payload?.headers;
        return {
          id: email.data.id,
          from: headers?.find(h => h.name === 'From')?.value || '',
          to: headers?.find(h => h.name === 'To')?.value || '',
          subject: headers?.find(h => h.name === 'Subject')?.value || '',
          timestamp: headers?.find(h => h.name === 'Date')?.value || '',
          isRead: !(email.data.labelIds || []).includes('UNREAD')
        };
      })
    );

    res.json(emails);
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email
router.post('/send', upload.array('attachments'), async (req, res) => {
  try {
    const { to, subject, content } = req.body;
    const files = req.files as Express.Multer.File[];

    const transporter = await createTransporter();
    await transporter.sendMail({
      from: process.env.GMAIL_ADDRESS,
      to,
      subject,
      html: content,
      attachments: files?.map(file => ({
        filename: file.originalname,
        path: file.path
      }))
    });

    // Clean up files
    files?.forEach(file => fs.unlinkSync(file.path));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test connection
router.get('/test-connection', async (req, res) => {
  try {
    console.log('Testing connection...');
    console.log('Credentials:', {
      clientId: process.env.GMAIL_CLIENT_ID?.substring(0, 10) + '...',
      hasSecret: !!process.env.GMAIL_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      email: process.env.GMAIL_ADDRESS
    });

    const result = await testConnection();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

export default router; 