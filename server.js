const { gmail, createTransporter, initializeGmail, getEmailContent } = require('./src/services/gmail.service');
const PORT = process.env.PORT || 5003;

// Add this route group after your existing routes
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

        // Filter out any null results from errors
        const validEmails = emails.filter(email => email !== null);
        res.json(validEmails);
    } catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/emails/send', async (req, res) => {
    try {
        const { to, subject, body } = req.body;
        console.log('📧 Sending email:', { to, subject });

        const transporter = await createTransporter();
        await transporter.sendMail({
            from: process.env.GMAIL_ADDRESS,
            to,
            subject,
            html: body
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: error.message });
    }
}); 