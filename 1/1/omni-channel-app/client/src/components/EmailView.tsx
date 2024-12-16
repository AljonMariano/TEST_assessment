import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Reply as ReplyIcon,
  Download as DownloadIcon,
  AttachFile as AttachFileIcon
} from '@mui/icons-material';
import { markEmailAsRead } from '../utils/emailStorage';

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  attachments?: Array<{
    filename: string;
    url: string;
  }>;
  isRead: boolean;
}

interface EmailViewProps {
  email: Email;
  onClose: () => void;
  onReply: () => void;
}

const EmailView = ({ email, onClose, onReply }: EmailViewProps) => {
  useEffect(() => {
    markEmailAsRead(email.id);
  }, [email.id]);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading attachment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try parsing RFC 2822 format
        return new Date(Date.parse(dateString)).toLocaleString();
      }
      return date.toLocaleString();
    } catch (error) {
      console.error('Error parsing date:', dateString);
      return dateString; // Return original string if parsing fails
    }
  };

  return (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{email.subject}</Typography>
        <Box>
          <IconButton onClick={onReply}>
            <ReplyIcon />
          </IconButton>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="textSecondary">
          From: {email.from}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary">
          To: {email.to}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary">
          Date: {formatDate(email.timestamp)}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Email Body */}
      <Box sx={{ mb: 3, flexGrow: 1, overflow: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: email.body }} />
      </Box>

      {/* Attachments Section */}
      {email.attachments && email.attachments.length > 0 && (
        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Attachments:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {email.attachments.map((attachment, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                startIcon={<AttachFileIcon />}
                endIcon={<DownloadIcon />}
                onClick={() => handleDownload(attachment.url, attachment.filename)}
                sx={{ mb: 1 }}
              >
                {attachment.filename}
              </Button>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default EmailView; 