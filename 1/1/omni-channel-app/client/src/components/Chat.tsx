import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, IconButton, Paper, Typography, CircularProgress, Button } from '@mui/material';
import { Send as SendIcon, AttachFile as AttachFileIcon, Download as DownloadIcon } from '@mui/icons-material';
import io from 'socket.io-client';
import { format } from 'date-fns';

const API_URL = 'http://localhost:5000';
const SOCKET_URL = 'http://localhost:5000';
const MESSAGES_PER_PAGE = 50;

interface Message {
  _id: string;
  content: string;
  sender: string;
  recipient: string;
  timestamp: string;
  attachment?: {
    type: 'image' | 'file';
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
}

const Chat = ({ selectedAccount }: { selectedAccount: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fix the message sorting and filtering
  const filteredMessages = messages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Add function to determine message alignment
  const isOwnMessage = (sender: string) => {
    // Check if the message is from the current user or Twilio numbers
    return sender === 'User' || 
           sender === '+13613392529' || 
           sender === '+13613227495';
  };

  // Add function to get full URL for attachments
  const getAttachmentUrl = (url: string) => {
    if (!url) return '';
    return `${API_URL}${url}`;
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching messages for account:', selectedAccount);
      
      if (!selectedAccount) {
        console.error('No account selected');
        return;
      }

      const url = `${API_URL}/api/messages?account=${encodeURIComponent(selectedAccount)}`;
      console.log('📡 Fetch URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📥 Raw response data:', data);
      
      if (data.success && Array.isArray(data.messages)) {
        console.log(`📝 Setting ${data.count} messages`);
        const sortedMessages = [...data.messages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        console.log('📝 First message:', sortedMessages[0]);
        console.log('📝 Last message:', sortedMessages[sortedMessages.length - 1]);
        setMessages(sortedMessages);
      } else {
        console.error('❌ Invalid messages data received:', data);
      }
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update the socket message handler
  useEffect(() => {
    if (!selectedAccount) return;

    const socket = io(SOCKET_URL, {
      path: '/socket.io/',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.emit('join', selectedAccount);

    socket.on('newMessage', (message: Message) => {
        console.log('📩 Received new message via socket:', message);
        setMessages(prev => {
            // Check if message already exists
            if (prev.some(m => m._id === message._id)) {
                return prev;
            }
            // Add new message and sort
            const newMessages = [...prev, message];
            console.log('📝 Updated messages:', newMessages);
            return newMessages.sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
        });
    });

    return () => {
        socket.disconnect();
    };
  }, [selectedAccount]);

  // Load more messages when scrolling up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && !loading && hasMore) {
      setPage(prev => prev + 1);
      fetchMessages();
    }
  };

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      const recipient = selectedAccount === '+13613392529' ? '+13613227495' : '+13613392529';
      
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage,
          sender: selectedAccount,
          recipient: recipient,
          timestamp: new Date()
        })
      });

      if (!response.ok) throw new Error('Failed to send message');
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;

    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender', selectedAccount);
    formData.append('recipient', selectedAccount === '+13613392529' ? '+13613227495' : '+13613392529');
    formData.append('content', `Sent file: ${file.name}`);

    try {
        const response = await fetch(`${API_URL}/api/messages/attachment`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload file');
        event.target.value = '';
    } catch (error) {
        console.error('Error uploading file:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    console.log('👤 Selected account changed to:', selectedAccount);
    if (selectedAccount) {
      fetchMessages();
    }
  }, [selectedAccount]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Messages Container */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: 2
        }}
        onScroll={handleScroll}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        )}
        
        {filteredMessages.map((message) => (
          <Paper
            key={message._id}
            elevation={1}
            sx={{
              p: 2,
              maxWidth: '70%',
              alignSelf: message.sender === selectedAccount ? 'flex-end' : 'flex-start',
              bgcolor: message.sender === selectedAccount ? '#0084ff' : '#e4e6eb',
              color: message.sender === selectedAccount ? 'white' : 'black',
              borderRadius: message.sender === selectedAccount ? 
                '18px 18px 4px 18px' : '18px 18px 18px 4px',
              mb: 1
            }}
          >
            <Typography sx={{ wordBreak: 'break-word' }}>
              {message.content}
            </Typography>
            <Typography variant="caption" sx={{ 
              display: 'block',
              mt: 0.5,
              color: message.sender === selectedAccount ? 'rgba(255,255,255,0.7)' : 'text.secondary',
              textAlign: message.sender === selectedAccount ? 'right' : 'left'
            }}>
              {format(new Date(message.timestamp), 'HH:mm')}
            </Typography>
            {message.attachment && (
                <Box sx={{ mt: 1 }}>
                    {message.attachment.type === 'image' ? (
                        <img 
                            src={getAttachmentUrl(message.attachment.url)}
                            alt={message.attachment.originalName}
                            style={{ maxWidth: '100%', borderRadius: '8px' }}
                        />
                    ) : (
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            backgroundColor: message.sender === selectedAccount ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            padding: '8px',
                            borderRadius: '8px'
                        }}>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                    📎 {message.attachment.originalName}
                                </Typography>
                                <Typography variant="caption" sx={{ 
                                    color: message.sender === selectedAccount ? 'rgba(255,255,255,0.7)' : 'text.secondary'
                                }}>
                                    {Math.round(message.attachment.size / 1024)}KB
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                component="a"
                                href={getAttachmentUrl(message.attachment.url)}
                                download={message.attachment.originalName}
                                startIcon={<DownloadIcon />}
                                sx={{ 
                                    backgroundColor: message.sender === selectedAccount ? 'rgba(255,255,255,0.2)' : 'primary.main',
                                    '&:hover': {
                                        backgroundColor: message.sender === selectedAccount ? 'rgba(255,255,255,0.3)' : 'primary.dark'
                                    }
                                }}
                            >
                                Download File
                            </Button>
                        </Box>
                    )}
                </Box>
            )}
          </Paper>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <IconButton onClick={() => fileInputRef.current?.click()}>
            <AttachFileIcon />
          </IconButton>
          <TextField
            fullWidth
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message... "
            size="small" 
          />
          <IconButton onClick={handleSend} disabled={!newMessage.trim()}>
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default Chat;