import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Divider
} from '@mui/material';
import { isEmailRead, markEmailAsRead } from '../utils/emailStorage';
import AttachFileIcon from '@mui/icons-material/AttachFile';

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

interface EmailListProps {
  emails: Email[];
  onEmailSelect: (email: Email) => void;
  folder: string;
  loading?: boolean;
}

const EmailList = ({ emails, onEmailSelect, folder, loading }: EmailListProps) => {
  const handleEmailClick = (email: Email) => {
    markEmailAsRead(email.id);
    onEmailSelect(email);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (emails.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">
          No emails in {folder}
        </Typography>
      </Box>
    );
  }

  return (
    <List>
      {emails.map((email) => (
        <ListItem
          key={email.id}
          button
          onClick={() => handleEmailClick(email)}
          sx={{
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
            bgcolor: 'background.paper'
          }}
        >
          <ListItemText
            primary={
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: isEmailRead(email.id) ? 400 : 600,
                }}
              >
                {email.subject}
              </Typography>
            }
            secondary={
              <>
                <Typography component="span" variant="body2">
                  {email.from}
                </Typography>
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ float: 'right' }}
                >
                  {new Date(email.timestamp).toLocaleString()}
                </Typography>
              </>
            }
          />
          {email.attachments && email.attachments.length > 0 && (
            <AttachFileIcon color="action" sx={{ ml: 1 }} />
          )}
        </ListItem>
      ))}
    </List>
  );
};

export default EmailList; 