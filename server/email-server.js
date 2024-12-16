const express = require('express');
const cors = require('cors');
const { gmail, createTransporter, initializeGmail, getEmailContent } = require('./src/services/gmail.service');
require('dotenv').config();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const app = express();
const PORT = process.env.EMAIL_PORT || 5005;

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Email server is running!' });
});

// Email routes
app.get('/api/emails/:folder', async (req, res) => {
    try {
        const { folder } = req.params;
        console.log(`📧 Fetching emails from ${folder}`);

        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `in:${folder}`,
            maxResults: 20
        });

        if (!response.data.messages) {
            return res.json([]);
        }

        const emails = await Promise.all(
            response.data.messages.map(async (message) => {
                try {
                    return await getEmailContent(message.id);
                } catch (error) {
                    console.error(`Error fetching email ${message.id}:`, error);
                    return null;
                }
            })
        );

        const validEmails = emails.filter(email => email !== null);
        res.json(validEmails);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/emails/send', upload.array('attachments'), async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        const attachments = req.files || [];
        
        console.log('📧 Sending email:', { to, subject });

        const transporter = await createTransporter();
        
        await transporter.sendMail({
            from: process.env.GMAIL_ADDRESS,
            to,
            subject,
            html: body,
            attachments: attachments.map(file => ({
                filename: file.originalname,
                content: file.buffer
            }))
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this route for downloading attachments
app.get('/api/emails/attachment/:messageId/:attachmentId', async (req, res) => {
  try {
    const { messageId, attachmentId } = req.params;
    
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });

    const buffer = Buffer.from(attachment.data.data, 'base64');
    
    // Get the email to find the attachment filename
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const parts = message.data.payload.parts || [];
    const attachmentPart = parts.find(part => part.body.attachmentId === attachmentId);
    const filename = attachmentPart?.filename || 'attachment';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', attachmentPart?.mimeType || 'application/octet-stream');
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Initialize Gmail before starting server
async function startServer() {
    try {
        console.log('Initializing Gmail service...');
        await initializeGmail();
        
        app.listen(PORT, () => {
            console.log(`📧 Email server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 