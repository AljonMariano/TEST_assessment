import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    CircularProgress,
    IconButton,
    Avatar,
    Grid,
    TextField
} from '@mui/material';
import {
    Call as CallIcon,
    CallEnd as CallEndIcon,
    Phone as PhoneIcon,
    MicOff as MicOffIcon,
    Mic as MicOnIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
    Backspace as BackspaceIcon
} from '@mui/icons-material';
import io from 'socket.io-client';

interface CallProps {
    open: boolean;
    onClose: () => void;
    phoneNumber?: string;
    direction?: 'incoming' | 'outgoing';
    onAnswer?: () => void;
    onDecline?: () => void;
    isVerificationCall?: boolean;
    currentNumber: string;
}

const API_URL = 'http://localhost:5001';

const Call: React.FC<CallProps> = ({
    open,
    onClose,
    phoneNumber: initialPhoneNumber,
    direction = 'outgoing',
    onAnswer,
    onDecline,
    isVerificationCall = false,
    currentNumber
}) => {
    const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
    const [socket, setSocket] = useState<any>(null);
    const [callDirection, setCallDirection] = useState<'inbound' | 'outgoing'>('outgoing');
    const [showIncomingCall, setShowIncomingCall] = useState(false);
    const [isRinging, setIsRinging] = useState(false);
    const [currentCallSid, setCurrentCallSid] = useState<string>('');
    const [showIncomingDialog, setShowIncomingDialog] = useState(false);
    const [showAcceptDeclineButtons, setShowAcceptDeclineButtons] = useState(false);
    const [callAccepted, setCallAccepted] = useState(false);
    const [incomingCall, setIncomingCall] = useState<{
        from: string;
        callSid: string;
    } | null>(null);

    useEffect(() => {
        if (!currentNumber) return;

        console.log('Initializing socket connection...');
        
        const newSocket = io(API_URL, {
            transports: ['polling', 'websocket'],  
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            forceNew: true, 
            path: '/socket.io' 
        });
        
        // Clean up function for previous socket instance
        if (socket) {
            console.log('Cleaning up previous socket connection');
            socket.disconnect();
        }
        
        newSocket.on('connect', () => {
            console.log('Connected as:', currentNumber);
            newSocket.emit('register', currentNumber);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        newSocket.on('incomingCall', (data) => {
            console.log('Incoming call:', {
                ...data,
                currentNumber,
                match: data.to === currentNumber
            });
            
            if (data.to === currentNumber) {
                console.log('Showing incoming call UI');
                
                // Update call data
                setIncomingCall({
                    from: data.from,
                    callSid: data.callSid
                });
                
                // Update UI state
                setPhoneNumber(data.from);
                setCallStatus('ringing');
                setCallDirection('inbound');
                setCurrentCallSid(data.callSid);
                setShowAcceptDeclineButtons(true);
                setShowIncomingDialog(true);
                setIsRinging(true);
            }
        });

        // Add call status handler
        newSocket.on('callStatusUpdate', (data) => {
            console.log('Call status update:', data);
            
            if (data.callStatus === 'in-progress') {
                // Update UI for connected call
                setCallStatus('connected');
                setShowIncomingDialog(false);  
                setShowAcceptDeclineButtons(false);  
            } else if (data.callStatus === 'completed') {
                // Reset UI when call ends
                handleEndCall();
            }
        });

        // Set the socket instance
        setSocket(newSocket);

        // Cleanup function
        return () => {
            console.log('Cleaning up socket connection');
            if (newSocket) {
                newSocket.removeAllListeners();
                newSocket.disconnect();
            }
            setSocket(null);
        };
    }, [currentNumber]);

    useEffect(() => {
        if (initialPhoneNumber) {
            setPhoneNumber(initialPhoneNumber);
            setCallStatus('ringing');
        }
    }, [initialPhoneNumber]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (callStatus === 'connected') {
            timer = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [callStatus]);

    useEffect(() => {
        console.log('\n🔍 === UI STATE CHECK ===');
        console.log('Dialog Conditions:', {
            showIncomingDialog,
            callDirection,
            callStatus,
            showAcceptDeclineButtons,
            isRinging,
            shouldShowDialog: Boolean(showIncomingDialog && callDirection === 'inbound' && callStatus === 'ringing')
        });
        console.log('🔍 === UI STATE CHECK END ===\n');
    }, [showIncomingDialog, callDirection, callStatus, showAcceptDeclineButtons, isRinging]);

    useEffect(() => {
        return () => {
            console.log('Component unmounting, cleaning up...');
            if (socket) {
                socket.removeAllListeners();
                socket.disconnect();
                setSocket(null);
            }
            // Reset all state
            setCallStatus('idle');
            setCurrentCallSid('');
            setShowIncomingDialog(false);
            setIsRinging(false);
            setPhoneNumber('');
        };
    }, []);

    useEffect(() => {
        if (socket) {
            socket.on('connect', () => {
                console.log('Socket reconnected');
            });

            socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });

            socket.on('connect_error', (error: Error) => {
                console.error('Socket connection error:', error);
            });
        }
    }, [socket]);

    useEffect(() => {
        console.log('UI State:', {
            currentCallSid,
            callStatus,
            callDirection,
            showIncomingDialog,
            showAcceptDeclineButtons,
            dialogVisible: Boolean(currentCallSid && callStatus === 'ringing')
        });
    }, [currentCallSid, callStatus, callDirection, showIncomingDialog, showAcceptDeclineButtons]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswer = () => {
        setCallStatus('connected');
        if (onAnswer) onAnswer();
    };

    const handleDecline = () => {
        setCallStatus('ended');
        if (onDecline) onDecline();
        setTimeout(() => {
            onClose();
            setCallStatus('idle');
            setDuration(0);
            if (!initialPhoneNumber) setPhoneNumber('');
        }, 1000);
    };

    const handleEndCall = () => {
        console.log('Executing handleEndCall...');
        
        if (socket && currentCallSid) {
            socket.emit('endCall', {
                callSid: currentCallSid,
                to: currentNumber,
                from: phoneNumber
            });
            // Remove the call status listener
            socket.off('callStatus');
        }

        // Clean up UI state
        setCallStatus('ended');
        setCurrentCallSid('');
        setShowIncomingDialog(false);
        setIsRinging(false);
        setPhoneNumber('');
        setCallAccepted(false);
        
        // Force close the dialog
        onClose();
    };

    const handleDigitPress = (digit: string) => {
        if (callStatus === 'idle') {
            setPhoneNumber(prev => prev + digit);
        }
    };

    const handleBackspace = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleCall = async () => {
        if (!phoneNumber.trim()) return;
        
        try {
            setCallStatus('ringing');
            setCallDirection('outgoing');  
            setShowIncomingDialog(false);  
            console.log('📞 Attempting to call:', { to: phoneNumber, from: currentNumber });
            
            const response = await fetch(`${API_URL}/api/calls/make`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    from: currentNumber
                })
            });

            if (response.ok) {
                const data = JSON.parse(await response.text());
                console.log('✅ Call initiated:', data);
                setCurrentCallSid(data.callSid);
                
                // Listen for call status updates via socket
                if (socket) {
                    socket.on('callStatus', (status) => {
                        console.log('Call status update received:', status);
                        
                        // Check if this status update is for our current call
                        if (status.callSid === data.callSid) {
                            // Log the raw status
                            console.log('Raw CallStatus:', status.CallStatus);
                            
                            // Convert to lowercase for comparison
                            const callStatus = status.CallStatus?.toLowerCase();
                            console.log('Processed call status:', callStatus);

                            // Add debug log for dialog state
                            console.log('Current dialog state:', {
                                callStatus,
                                isDialogOpen: Boolean(currentCallSid && callStatus === 'ringing'),
                                currentCallSid
                            });

                            switch (callStatus) {
                                case 'busy':
                                case 'failed':
                                case 'no-answer':
                                case 'completed':
                                    console.log('Ending call due to status:', callStatus);
                                    setCallStatus('ended');
                                    handleEndCall();
                                    onClose();
                                    socket.removeAllListeners('callStatus');
                                    break;
                                    
                                case 'in-progress':
                                    console.log('Call connected');
                                    setCallStatus('connected');
                                    break;
                                    
                                case 'ringing':
                                    console.log('Call ringing');
                                    setCallStatus('ringing');
                                    break;
                                    
                                default:
                                    console.log('Unhandled call status:', callStatus);
                                    // For any unknown status, end the call
                                    handleEndCall();
                                    onClose();
                                    socket.removeAllListeners('callStatus');
                            }
                        }
                    });
                }
            } else {
                console.error('Failed to initiate call:', await response.text());
                handleEndCall();
                onClose(); 
            }
        } catch (error) {
            console.error('Error making call:', error);
            handleEndCall();
            onClose();  
        }
    };

    const handleAcceptCall = () => {
        if (socket && currentCallSid && !callAccepted) {
            console.log('Accepting call:', currentCallSid);
            
            // Set flag to prevent multiple accepts
            setCallAccepted(true);
            
            // Emit accept event
            socket.emit('acceptCall', {
                callSid: currentCallSid,
                to: currentNumber,
                from: phoneNumber
            });

            // Update UI immediately
            setCallStatus('connected');
            setShowIncomingDialog(false);
            setShowAcceptDeclineButtons(false);
        }
    };

    const handleDeclineCall = () => {
        if (socket && currentCallSid) {
            console.log('\n📞 === DECLINING CALL ===');
            console.log('Call Data:', {
                callSid: currentCallSid,
                to: currentNumber,
                from: phoneNumber
            });

            // Emit decline event to server
            socket.emit('declineCall', {
                callSid: currentCallSid,
                to: currentNumber,
                from: phoneNumber
            });

            // Clean up UI
            handleEndCall();
            console.log('✅ Call Declined\n');
        }
    };

    if (!open) return null;

    return (
        <>
            <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                bgcolor: 'background.paper',
                borderRadius: 2,
                overflow: 'hidden'
            }}>
                {/* Call Status Header */}
                <Box sx={{ 
                    p: 2, 
                    bgcolor: 'primary.main', 
                    color: 'white',
                    textAlign: 'center'
                }}>
                    <Typography variant="h6">
                        {callDirection === 'inbound' ? 'Incoming Call' : 'Make a Call'}
                    </Typography>
                </Box>

                {/* Main Content - Always show dial pad */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
                    {/* Phone Number Input */}
                    <TextField
                        fullWidth
                        value={phoneNumber}
                        disabled={callStatus === 'connected' || callStatus === 'ringing'}
                        InputProps={{
                            readOnly: true,
                            endAdornment: phoneNumber && (
                                <IconButton 
                                    onClick={handleBackspace}
                                    disabled={callStatus !== 'idle'}
                                >
                                    <BackspaceIcon />
                                </IconButton>
                            )
                        }}
                    />

                    {/* Dial Pad - Always visible but disabled during calls */}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((digit) => (
                            <Grid item xs={4} key={digit}>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={() => handleDigitPress(digit.toString())}
                                    disabled={callStatus === 'connected' || callStatus === 'ringing'}
                                    sx={{ 
                                        height: 56,
                                        fontSize: '1.25rem',
                                        opacity: callStatus === 'idle' ? 1 : 0.6
                                    }}
                                >
                                    {digit}
                                </Button>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Call Controls */}
                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        mt: 3,
                        gap: 2
                    }}>
                        {callStatus === 'idle' ? (
                            <IconButton 
                                sx={{ 
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    '&:hover': { bgcolor: 'success.dark' },
                                    p: 3
                                }}
                                onClick={handleCall}
                                disabled={!phoneNumber}
                            >
                                <CallIcon sx={{ fontSize: 30 }} />
                            </IconButton>
                        ) : (
                            <>
                                {callStatus === 'connected' && (
                                    <>
                                        <IconButton 
                                            onClick={() => setIsMuted(!isMuted)}
                                            sx={{ 
                                                bgcolor: isMuted ? 'error.main' : 'grey.300',
                                                color: isMuted ? 'white' : 'text.primary',
                                                '&:hover': { bgcolor: isMuted ? 'error.dark' : 'grey.400' }
                                            }}
                                        >
                                            {isMuted ? <MicOffIcon /> : <MicOnIcon />}
                                        </IconButton>
                                        <IconButton 
                                            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                            sx={{ 
                                                bgcolor: isSpeakerOn ? 'primary.main' : 'grey.300',
                                                color: isSpeakerOn ? 'white' : 'text.primary',
                                                '&:hover': { bgcolor: isSpeakerOn ? 'primary.dark' : 'grey.400' }
                                            }}
                                        >
                                            {isSpeakerOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
                                        </IconButton>
                                    </>
                                )}
                                <IconButton 
                                    sx={{ 
                                        bgcolor: 'error.main',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'error.dark' },
                                        p: 3
                                    }}
                                    onClick={handleEndCall}
                                >
                                    <CallEndIcon sx={{ fontSize: 30 }} />
                                </IconButton>
                            </>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Incoming Call Dialog - Shows on top of dial pad */}
            <Dialog
                open={Boolean(currentCallSid && ['ringing', 'initiated'].includes(callStatus))}
                maxWidth="xs"
                fullWidth
                disableEscapeKeyDown
                onClose={() => {
                    handleEndCall();
                    onClose();
                }}
            >
                <Box sx={{ 
                    textAlign: 'center', 
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 2
                }}>
                    <Avatar 
                        sx={{ 
                            width: 80, 
                            height: 80, 
                            bgcolor: 'primary.main',
                            mb: 2,
                            mx: 'auto'
                        }}
                    >
                        <PhoneIcon sx={{ fontSize: 40 }} />
                    </Avatar>

                    <Typography variant="h6" gutterBottom>
                        {phoneNumber}
                    </Typography>

                    <Typography variant="body1" color="text.secondary" gutterBottom>
                        Calling...
                    </Typography>

                    {showAcceptDeclineButtons && (
                        <Box sx={{ 
                            display: 'flex', 
                            gap: 2, 
                            justifyContent: 'center',
                            mt: 3
                        }}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<CallIcon />}
                                onClick={handleAcceptCall}
                                sx={{ minWidth: 120 }}
                            >
                                Accept
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<CallEndIcon />}
                                onClick={handleDeclineCall}
                                sx={{ minWidth: 120 }}
                            >
                                Decline
                            </Button>
                        </Box>
                    )}
                </Box>
            </Dialog>
        </>
    );
};

export default Call; 