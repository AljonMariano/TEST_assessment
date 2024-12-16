import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Typography,
    Box,
    CircularProgress,
    Alert,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material';
import { Phone as PhoneIcon, Sms as SmsIcon } from '@mui/icons-material';
import Call from './Call';

interface VerifyDialogProps {
    open: boolean;
    onClose: () => void;
    phoneNumber: string;
    fromNumber: string;
    onVerified: () => void;
}

const API_URL = 'http://localhost:5001';

const VerifyDialog: React.FC<VerifyDialogProps> = ({
    open,
    onClose,
    phoneNumber,
    fromNumber,
    onVerified
}) => {
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [codeSent, setCodeSent] = useState(false);
    const [verifyMethod, setVerifyMethod] = useState<'sms' | 'call'>('call');
    const [showCallDialog, setShowCallDialog] = useState(false);

    const handleMethodChange = (event: React.MouseEvent<HTMLElement>, newMethod: 'sms' | 'call') => {
        if (newMethod !== null) {
            setVerifyMethod(newMethod);
        }
    };

    const handleSendCode = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_URL}/api/sms/verify/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    from: fromNumber,
                    channel: verifyMethod
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send verification code');
            }

            setCodeSent(true);
            if (verifyMethod === 'call') {
                setShowCallDialog(true);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_URL}/api/sms/verify/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    from: fromNumber,
                    code: verificationCode
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to verify code');
            }

            if (data.valid) {
                onVerified();
                onClose();
            } else {
                setError('Invalid verification code');
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to verify code');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setVerificationCode('');
        setError(null);
        setCodeSent(false);
        setVerifyMethod('call');
        setShowCallDialog(false);
        onClose();
    };

    const handleCallDeclined = () => {
        setShowCallDialog(false);
        setCodeSent(false);
        setError('Call was declined');
    };

    return (
        <>
            <Dialog open={open && !showCallDialog} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogTitle>
                    Verify Phone Number
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        {!codeSent && (
                            <>
                                <Typography variant="body1" gutterBottom>
                                    Choose verification method for {phoneNumber}
                                </Typography>
                                <ToggleButtonGroup
                                    value={verifyMethod}
                                    exclusive
                                    onChange={handleMethodChange}
                                    aria-label="verification method"
                                    sx={{ mt: 2, mb: 2, width: '100%' }}
                                >
                                    <ToggleButton value="call" aria-label="voice call" sx={{ flex: 1 }}>
                                        <PhoneIcon sx={{ mr: 1 }} />
                                        Voice Call
                                    </ToggleButton>
                                    <ToggleButton value="sms" aria-label="sms" sx={{ flex: 1 }}>
                                        <SmsIcon sx={{ mr: 1 }} />
                                        SMS
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            </>
                        )}

                        {codeSent && !showCallDialog && (
                            <Typography variant="body1" gutterBottom>
                                {verifyMethod === 'call' 
                                    ? `You will receive a call at ${phoneNumber} with your verification code`
                                    : `Enter the verification code sent to ${phoneNumber}`
                                }
                            </Typography>
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {codeSent && !showCallDialog && (
                            <TextField
                                fullWidth
                                label="Verification Code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                margin="normal"
                                disabled={loading}
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    {codeSent && !showCallDialog ? (
                        <Button 
                            onClick={handleVerifyCode} 
                            variant="contained" 
                            disabled={!verificationCode || loading}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Verify Code'}
                        </Button>
                    ) : (
                        <Button 
                            onClick={handleSendCode} 
                            variant="contained" 
                            disabled={loading}
                            startIcon={verifyMethod === 'call' ? <PhoneIcon /> : <SmsIcon />}
                        >
                            {loading ? <CircularProgress size={24} /> : (verifyMethod === 'call' ? 'Call Me' : 'Send Code')}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            <Call
                open={showCallDialog}
                onClose={() => setShowCallDialog(false)}
                phoneNumber={phoneNumber}
                direction="incoming"
                onAnswer={() => setShowCallDialog(true)}
                onDecline={handleCallDeclined}
                isVerificationCall={true}
                currentNumber={phoneNumber}
            />
        </>
    );
};

export default VerifyDialog;