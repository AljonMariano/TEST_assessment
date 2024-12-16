import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Box,
    TextField,
    Button,
    Paper,
    Typography,
    CircularProgress,
    Avatar,
    IconButton,
    Grid,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Fab
} from '@mui/material';
import { 
    Send as SendIcon, 
    Person as PersonIcon, 
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import ConversationList from './ConversationList';
import VerifyDialog from './VerifyDialog';

interface Message {
    sid: string;
    body: string;
    from: string;
    to: string;
    dateCreated: string;
    status: string;
    direction?: 'inbound' | 'outbound';
    errorCode?: string;
    errorMessage?: string;
}

interface Conversation {
    phoneNumber: string;
    lastMessage: string;
    timestamp: string;
}

interface SMSProps {
    currentNumber: string;
}

const API_URL = 'http://localhost:5001';

interface ComposeDialogProps {
    open: boolean;
    onClose: () => void;
    onSend: (to: string, message: string) => void;
    loading?: boolean;
}

const ComposeDialog: React.FC<ComposeDialogProps> = ({ open, onClose, onSend, loading }) => {
    const [to, setTo] = useState('');
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (to && message) {
            onSend(to, message);
            setTo('');
            setMessage('');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>New Message</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField
                        fullWidth
                        label="To"
                        placeholder="Enter phone number"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label="Message"
                        multiline
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={loading}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button 
                    onClick={handleSend}
                    variant="contained"
                    disabled={!to || !message || loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                >
                    Send
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const SMS: React.FC<SMSProps> = ({ currentNumber }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
    const [pendingMessage, setPendingMessage] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [composeDialogOpen, setComposeDialogOpen] = useState(false);
    const [sendingNewMessage, setSendingNewMessage] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Socket connection effect
    useEffect(() => {
        if (currentNumber) {
            // Initialize socket connection
            socketRef.current = io(API_URL, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            // Socket event handlers
            socketRef.current.on('connect', () => {
                console.log('🔌 Connected to server');
                if (socketRef.current) {
                    // Register this client with their phone number
                    socketRef.current.emit('register', currentNumber);
                    // Request initial message history
                    socketRef.current.emit('requestInitialHistory', currentNumber);
                }
            });

            socketRef.current.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });

            socketRef.current.on('initialHistory', (data) => {
                const { messages: initialMessages, conversations: initialConversations } = data;
                setMessages(initialMessages);
                setConversations(initialConversations);
                setLoading(false);
            });

            socketRef.current.on('messageStatusUpdate', (update) => {
                console.log('📱 Message status update:', update);
                setMessages(prev => prev.map(msg => 
                    msg.sid === update.sid 
                        ? { ...msg, status: update.status }
                        : msg
                ));
            });

            socketRef.current.on('newMessage', (message: Message) => {
                console.log('📱 Received real-time message:', message);
                setMessages(prev => {
                    const exists = prev.some(m => m.sid === message.sid);
                    if (!exists) {
                        return [...prev, message].sort((a, b) => 
                            new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
                        );
                    }
                    return prev;
                });

                const otherParty = message.direction === 'outbound' ? message.to : message.from;
                setConversations(prev => {
                    const existingIndex = prev.findIndex(c => c.phoneNumber === otherParty);
                    const newConversation = {
                        phoneNumber: otherParty,
                        lastMessage: message.body,
                        timestamp: message.dateCreated
                    };

                    if (existingIndex >= 0) {
                        const updated = [...prev];
                        updated[existingIndex] = newConversation;
                        return updated;
                    }
                    return [...prev, newConversation];
                });
            });

            return () => {
                if (socketRef.current) {
                    socketRef.current.off('connect');
                    socketRef.current.off('connect_error');
                    socketRef.current.off('initialHistory');
                    socketRef.current.off('newMessage');
                    socketRef.current.off('messageStatusUpdate');
                    socketRef.current.disconnect();
                }
            };
        }
    }, [currentNumber]);

    const handleSend = async () => {
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const response = await fetch(`${API_URL}/api/sms/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: selectedConversation,
                    from: currentNumber,
                    message: newMessage
                }),
            });

            if (response.ok) {
                setNewMessage('');
                // Message will be added through WebSocket
            } else {
                const error = await response.json();
                if (error.message?.includes('not verified')) {
                    setPendingMessage(newMessage);
                    setVerifyDialogOpen(true);
                } else {
                    console.error('Error response:', error);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleVerified = async () => {
        if (pendingMessage && selectedConversation) {
            try {
                const response = await fetch(`${API_URL}/api/sms/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: selectedConversation,
                        from: currentNumber,
                        message: pendingMessage
                    }),
                });

                if (response.ok) {
                    setNewMessage('');
                    setPendingMessage('');
                    // No need to fetch messages, will receive through WebSocket
                } else {
                    const error = await response.json();
                    console.error('Error response:', error);
                }
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const filteredMessages = messages.filter(msg => 
        msg.from === selectedConversation || msg.to === selectedConversation
    );

    const isVerificationMessage = (message: Message) => {
        // Check if the message is from a short code (5-6 digits) or contains verification text
        return message.from.match(/^\d{5,6}$/) || 
               message.body.toLowerCase().includes('verification code') ||
               message.body.toLowerCase().includes('verify');
    };

    const getMessageDisplay = (message: Message) => {
        if (isVerificationMessage(message)) {
            if (message.status === 'failed') {
                return {
                    body: 'Verification code will be sent shortly...',
                    status: 'pending'
                };
            }
            // Keep original message if it's not failed
            return {
                body: message.body,
                status: message.status
            };
        }
        return {
            body: message.body,
            status: message.status
        };
    };

    const handleComposeMessage = async (to: string, message: string) => {
        try {
            setSendingNewMessage(true);
            
            // Add to conversations immediately for better UX
            const newConversation: Conversation = {
                phoneNumber: to,
                lastMessage: message,
                timestamp: new Date().toISOString()
            };
            
            setConversations(prev => {
                // Check if conversation already exists
                const exists = prev.some(conv => conv.phoneNumber === to);
                if (!exists) {
                    return [...prev, newConversation];
                }
                return prev;
            });

            const response = await fetch(`${API_URL}/api/sms/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    from: currentNumber,
                    message
                }),
            });

            if (response.ok) {
                setComposeDialogOpen(false);
                // Select the new conversation
                setSelectedConversation(to);
                
                // If in test mode and number needs verification, add test verification message
                const data = await response.json();
                if (data.needsVerification) {
                    const testVerificationMessage: Message = {
                        sid: 'TEST_VERIFY_' + Date.now(),
                        body: '**verification code is: 123456**\n(Test Mode: Use this code to verify the number)',
                        from: '12345',
                        to: currentNumber,
                        dateCreated: new Date().toISOString(),
                        status: 'delivered',
                        direction: 'inbound'
                    };
                    
                    setMessages(prev => [...prev, testVerificationMessage]);
                    setPendingMessage(message);
                    setVerifyDialogOpen(true);
                }
                
                fetchMessages(); // Refresh messages
            } else {
                const error = await response.json();
                if (error.message?.includes('not verified')) {
                    setPendingMessage(message);
                    setVerifyDialogOpen(true);
                } else {
                    console.error('Error response:', error);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSendingNewMessage(false);
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', position: 'relative' }}>
            {/* Conversation List */}
            <Box sx={{ 
                width: 300, 
                borderRight: 1, 
                borderColor: 'divider',
                display: { xs: selectedConversation ? 'none' : 'block', md: 'block' }
            }}>
                <Box sx={{ 
                    p: 2, 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Typography variant="h6">Conversations</Typography>
                    <IconButton 
                        color="primary"
                        onClick={() => setComposeDialogOpen(true)}
                        size="small"
                    >
                        <EditIcon />
                    </IconButton>
                </Box>
                <ConversationList 
                    conversations={conversations}
                    selectedNumber={selectedConversation}
                    onSelectConversation={setSelectedConversation}
                />
            </Box>

            {/* Message View */}
            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                display: { xs: !selectedConversation ? 'none' : 'flex', md: 'flex' }
            }}>
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <Paper elevation={2} sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton 
                                sx={{ display: { xs: 'block', md: 'none' } }}
                                onClick={() => setSelectedConversation(null)}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                                <PersonIcon />
                            </Avatar>
                            <Typography variant="h6">{selectedConversation}</Typography>
                        </Paper>

                        {/* Messages */}
                        <Paper 
                            sx={{ 
                                flex: 1, 
                                mb: 2, 
                                p: 2, 
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                bgcolor: '#f5f5f5'
                            }}
                        >
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                filteredMessages.map((message) => {
                                    const displayInfo = getMessageDisplay(message);
                                    return (
                                        <Box
                                            key={message.sid}
                                            sx={{
                                                alignSelf: message.direction === 'outbound' ? 'flex-end' : 'flex-start',
                                                maxWidth: '70%'
                                            }}
                                        >
                                            <Paper
                                                elevation={1}
                                                sx={{
                                                    p: 1.5,
                                                    bgcolor: isVerificationMessage(message) 
                                                        ? displayInfo.status === 'pending'
                                                            ? 'warning.light'
                                                            : 'info.light'
                                                        : message.direction === 'outbound' 
                                                            ? 'primary.main' 
                                                            : 'white',
                                                    color: message.direction === 'outbound' ? 'white' : 'text.primary',
                                                    borderRadius: 2
                                                }}
                                            >
                                                <Typography variant="body1">
                                                    {displayInfo.body}
                                                </Typography>
                                                <Typography 
                                                    variant="caption" 
                                                    sx={{ 
                                                        display: 'block', 
                                                        mt: 0.5,
                                                        opacity: 0.8
                                                    }}
                                                >
                                                    {formatTime(message.dateCreated)}
                                                </Typography>
                                            </Paper>
                                        </Box>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </Paper>

                        {/* Input */}
                        <Paper elevation={2} sx={{ p: 2, display: 'flex', gap: 1 }}>
                            <TextField
                                fullWidth
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                size="small"
                                multiline
                                maxRows={4}
                            />
                            <Button
                                variant="contained"
                                endIcon={<SendIcon />}
                                onClick={handleSend}
                                disabled={!newMessage.trim()}
                            >
                                Send
                            </Button>
                        </Paper>
                    </>
                ) : (
                    <Box sx={{ 
                        display: { xs: 'none', md: 'flex' },
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%'
                    }}>
                        <Typography variant="h6" color="text.secondary">
                            Select a conversation to start messaging
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Floating Compose Button (mobile) */}
            <Fab
                color="primary"
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    display: { xs: 'flex', md: 'none' }
                }}
                onClick={() => setComposeDialogOpen(true)}
            >
                <EditIcon />
            </Fab>

            {/* Compose Dialog */}
            <ComposeDialog
                open={composeDialogOpen}
                onClose={() => setComposeDialogOpen(false)}
                onSend={handleComposeMessage}
                loading={sendingNewMessage}
            />

            {/* Verify Dialog */}
            <VerifyDialog
                open={verifyDialogOpen}
                onClose={() => {
                    setVerifyDialogOpen(false);
                    setPendingMessage('');
                }}
                phoneNumber={selectedConversation || ''}
                fromNumber={currentNumber}
                onVerified={handleVerified}
            />
        </Box>
    );
};

export default SMS; 