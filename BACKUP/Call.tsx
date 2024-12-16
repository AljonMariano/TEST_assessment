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
    const [incomingCall, setIncomingCall] = useState<{
        from: string;
        callSid: string;
    } | null>(null);
    const [showAcceptDeclineButtons, setShowAcceptDeclineButtons] = useState(false);

    useEffect(() => {
        const newSocket = io(API_URL);
        
        newSocket.on('connect', () => {
            console.log('Socket connected');
            newSocket.emit('register', currentNumber);
        });

        newSocket.on('incomingCall', (data) => {
            console.log('📞 Incoming call received:', data);
            
            if (data.direction === 'inbound' && data.callStatus === 'ringing') {
                setIncomingCall({
                    from: data.from,
                    callSid: data.callSid
                });
                
                setPhoneNumber(data.from);
                setCallStatus('ringing');
                setCallDirection('inbound');
                setIsRinging(true);
                setCurrentCallSid(data.callSid);
                setShowAcceptDeclineButtons(true);
                setShowIncomingDialog(true);

                console.log('📞 Updated UI for incoming call');
            }
        });

        newSocket.on('callStatus', (status) => {
            console.log('Call status update:', status);
            if (status.status === 'in-progress') {
                setCallStatus('connected');
            } else if (status.status === 'completed') {
                handleEndCall();
                setCallDirection('outgoing');
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
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
        setCallStatus('ended');
        setTimeout(() => {
            onClose();
            setCallStatus('idle');
            setDuration(0);
            if (!initialPhoneNumber) setPhoneNumber('');
        }, 1000);
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
            console.log('📞 Initiating call to:', phoneNumber);
            
            const API_BASE_URL = 'https://83af-120-29-90-44.ngrok-free.app';
            
            const response = await fetch(`${API_BASE_URL}/api/calls/make`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    from: currentNumber
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Call initiated:', data);
                
                // Start polling for call status
                const pollInterval = setInterval(async () => {
                    try {
                        console.log('Polling call status for SID:', data.sid);
                        const statusResponse = await fetch(`${API_BASE_URL}/api/calls/status`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                CallSid: data.sid
                            })
                        });
                        
                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();
                            console.log(' Call status update:', statusData);
                            
                            switch (statusData.CallStatus) {
                                case 'in-progress':
                                case 'answered':
                                    setCallStatus('connected');
                                    break;
                                case 'completed':
                                case 'failed':
                                case 'busy':
                                case 'no-answer':
                                    clearInterval(pollInterval);
                                    handleEndCall();
                                    break;
                                case 'ringing':
                                    setCallStatus('ringing');
                                    break;
                            }
                        } else {
                            console.error('Failed to fetch call status:', await statusResponse.text());
                        }
                    } catch (error) {
                        console.error('Error polling call status:', error);
                    }
                }, 2000);

                // Store the interval ID for cleanup
                return () => clearInterval(pollInterval);
            } else {
                const error = await response.json();
                console.error('Error response:', error);
                handleEndCall();
            }
        } catch (error) {
            console.error('Error making call:', error);
            handleEndCall();
        }
    };

    const handleAcceptCall = () => {
        if (socket && incomingCall) {
            console.log('📞 Accepting call:', incomingCall);
            socket.emit('acceptCall', {
                callSid: incomingCall.callSid,
                to: currentNumber,
                from: incomingCall.from
            });
            setShowIncomingDialog(false);
            setShowAcceptDeclineButtons(false);
            setCallStatus('connected');
        }
    };

    const handleDeclineCall = () => {
        if (socket && incomingCall) {
            console.log('📞 Declining call:', incomingCall);
            socket.emit('declineCall', {
                callSid: incomingCall.callSid,
                to: currentNumber,
                from: incomingCall.from
            });
            handleEndCall();
        }
    };

    if (!open) return null;

    return (
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

            {/* Accept/Decline Buttons - Show for incoming calls */}
            {callStatus === 'ringing' && callDirection === 'inbound' && (
                <Box sx={{ 
                    p: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 3,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider'
                }}>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<CallIcon />}
                        onClick={handleAcceptCall}
                        size="large"
                        sx={{ 
                            minWidth: 150,
                            height: 48,
                            fontSize: '1.1rem'
                        }}
                    >
                        Accept Call
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={handleDeclineCall}
                        size="large"
                        sx={{ 
                            minWidth: 150,
                            height: 48,
                            fontSize: '1.1rem'
                        }}
                    >
                        Decline Call
                    </Button>
                </Box>
            )}

            {/* Main Content */}
            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                p: 3,
                overflow: 'auto'
            }}>
                {/* Dial Pad - Moved to top */}
                {callStatus === 'idle' && (
                    <Box sx={{ 
                        width: '100%', 
                        maxWidth: 400, 
                        mx: 'auto',
                        mb: 3 
                    }}>
                        <TextField
                            fullWidth
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="Enter phone number"
                            sx={{ mb: 2 }}
                            InputProps={{
                                endAdornment: phoneNumber && (
                                    <IconButton onClick={handleBackspace} size="small">
                                        <BackspaceIcon />
                                    </IconButton>
                                )
                            }}
                        />
                        <Grid container spacing={1.5}>
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                                <Grid item xs={4} key={digit}>
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => handleDigitPress(digit)}
                                        sx={{
                                            height: 50,
                                            fontSize: '1.25rem',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        {digit}
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>
                        <Button
                            variant="contained"
                            color="success"
                            fullWidth
                            onClick={handleCall}
                            disabled={!phoneNumber.trim()}
                            startIcon={<CallIcon />}
                            sx={{ mt: 2, height: 48 }}
                        >
                            Call
                        </Button>
                    </Box>
                )}

                {/* Active Call UI */}
                {callStatus !== 'idle' && (
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        mt: 2
                    }}>
                        <Avatar 
                            sx={{ 
                                width: 80, 
                                height: 80, 
                                bgcolor: 'primary.main',
                                mb: 2
                            }}
                        >
                            <PhoneIcon sx={{ fontSize: 40 }} />
                        </Avatar>

                        <Typography variant="h6" gutterBottom>
                            {phoneNumber}
                        </Typography>

                        <Typography variant="body1" color="text.secondary" gutterBottom>
                            {callStatus === 'ringing' ? 
                                (callDirection === 'inbound' ? 'Incoming...' : 'Calling...') : 
                                callStatus}
                        </Typography>

                        {callStatus === 'connected' && (
                            <Typography variant="body2" color="text.secondary">
                                {formatDuration(duration)}
                            </Typography>
                        )}

                        {/* Call Controls */}
                        <Box sx={{ 
                            mt: 3,
                            display: 'flex',
                            gap: 2,
                            justifyContent: 'center'
                        }}>
                            {callStatus === 'ringing' && callDirection === 'inbound' ? (
                                <>
                                    <IconButton 
                                        sx={{ 
                                            bgcolor: 'success.main',
                                            color: 'white',
                                            '&:hover': { bgcolor: 'success.dark' },
                                            p: 3
                                        }}
                                        onClick={handleAnswer}
                                    >
                                        <CallIcon sx={{ fontSize: 30 }} />
                                    </IconButton>
                                    <IconButton 
                                        sx={{ 
                                            bgcolor: 'error.main',
                                            color: 'white',
                                            '&:hover': { bgcolor: 'error.dark' },
                                            p: 3
                                        }}
                                        onClick={handleDecline}
                                    >
                                        <CallEndIcon sx={{ fontSize: 30 }} />
                                    </IconButton>
                                </>
                            ) : (
                                <>
                                    {callStatus === 'connected' && (
                                        <>
                                            <IconButton 
                                                onClick={() => setIsMuted(!isMuted)}
                                                color={isMuted ? 'error' : 'default'}
                                            >
                                                {isMuted ? <MicOffIcon /> : <MicOnIcon />}
                                            </IconButton>
                                            <IconButton 
                                                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                                color={isSpeakerOn ? 'primary' : 'default'}
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
                )}
            </Box>

            {/* Add Incoming Call Dialog */}
            <Dialog
                open={Boolean(showIncomingDialog && callDirection === 'inbound' && callStatus === 'ringing')}
                maxWidth="xs"
                fullWidth
                disableEscapeKeyDown
            >
                <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Avatar 
                        sx={{ 
                            width: 80, 
                            height: 80, 
                            bgcolor: 'primary.main',
                            mx: 'auto',
                            mb: 2
                        }}
                    >
                        <PhoneIcon sx={{ fontSize: 40 }} />
                    </Avatar>
                    <Typography variant="h6" gutterBottom>
                        Incoming Call
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {incomingCall?.from || phoneNumber}
                    </Typography>
                </Box>

                {showAcceptDeclineButtons && (
                    <Box sx={{ 
                        display: 'flex', 
                        gap: 2, 
                        justifyContent: 'center',
                        pb: 3
                    }}>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CallIcon />}
                            onClick={handleAcceptCall}
                        >
                            Accept
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<CallEndIcon />}
                            onClick={handleDeclineCall}
                        >
                            Decline
                        </Button>
                    </Box>
                )}
            </Dialog>
        </Box>
    );
};

export default Call; 