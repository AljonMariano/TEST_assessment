import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Typography,
  Paper,
  Fab,
  CircularProgress,
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  Create as CreateIcon,
  Star as StarIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import EmailList from './EmailList';
import EmailCompose from './EmailCompose';
import EmailView from './EmailView';

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

const API_URL = 'http://localhost:5005/api';

const EmailClient = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const drawerWidth = 240;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/emails/${selectedFolder}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setEmails(data);
    } catch (error) {
      console.error('Error fetching emails:', error);
      setError('Failed to fetch emails. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [selectedFolder]);

  const folders = [
    { name: 'inbox', icon: <InboxIcon />, label: 'Inbox' },
    { name: 'sent', icon: <SendIcon />, label: 'Sent' },
    { name: 'starred', icon: <StarIcon />, label: 'Starred' },
    { name: 'trash', icon: <DeleteIcon />, label: 'Trash' },
  ];

  const handleRefresh = () => {
    fetchEmails();
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100%',
      position: 'relative'
    }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          position: 'relative',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'absolute',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            borderRadius: '4px',
            height: '100%',
          },
        }}
      >
        <Box sx={{ 
          overflow: 'auto',
          height: '100%',
          bgcolor: 'background.paper'
        }}>
          <List>
            {folders.map((folder) => (
              <ListItem
                button
                key={folder.name}
                selected={selectedFolder === folder.name}
                onClick={() => setSelectedFolder(folder.name)}
              >
                <ListItemIcon>{folder.icon}</ListItemIcon>
                <ListItemText primary={folder.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box sx={{ 
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
        }}>
          <Typography variant="h6">Email</Typography>
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {error && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography>{error}</Typography>
          </Box>
        )}
        {loading && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        )}

        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          bgcolor: 'background.default',
          p: 2
        }}>
          {selectedEmail ? (
            <EmailView
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onReply={() => setIsComposeOpen(true)}
            />
          ) : (
            <EmailList
              emails={emails}
              onEmailSelect={setSelectedEmail}
              folder={selectedFolder}
              loading={loading}
            />
          )}
        </Box>

        <Fab
          color="primary"
          aria-label="compose"
          onClick={() => setIsComposeOpen(true)}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
          }}
        >
          <CreateIcon />
        </Fab>

        <EmailCompose
          open={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          onSend={fetchEmails}
        />
      </Box>
    </Box>
  );
};

export default EmailClient; 