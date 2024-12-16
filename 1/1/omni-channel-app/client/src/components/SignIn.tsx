import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Paper,
  Stack,
  CircularProgress,
  Fade
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface SignInProps {
  onSelect: (account: string) => void;
}

const SignIn = ({ onSelect }: SignInProps) => {
  console.log('SignIn is rendering');
  const [selectedAccount, setSelectedAccount] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Clear any existing session on component mount
    localStorage.removeItem('selectedAccount');
  }, []);

  const handleSignIn = (account: string) => {
    setSelectedAccount(account);
    onSelect(account);
    localStorage.setItem('selectedAccount', account);
    navigate('/dashboard');
  };

  return (
    <Fade in timeout={1000}>
      <Container maxWidth="sm" sx={{ height: '100vh', bgcolor: 'primary.main' }}>
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white'
        }}>
          <Typography 
            variant="h2" 
            component="h1" 
            align="center" 
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 4 }}
          >
            OmniChannel
          </Typography>
          
          <Typography 
            variant="h5" 
            align="center" 
            gutterBottom
            sx={{ mb: 6, opacity: 0.9 }}
          >
            Unified Communication Platform
          </Typography>

          <Paper 
            elevation={6} 
            sx={{ 
              p: 4, 
              width: '100%', 
              borderRadius: 2,
              bgcolor: 'background.paper'
            }}
          >
            <Typography 
              variant="h6" 
              align="center" 
              gutterBottom 
              color="text.primary"
            >
              Select Test Account
            </Typography>
            
            <Stack spacing={2} sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                fullWidth
                size="large"
                onClick={() => handleSignIn('+13613392529')}
                sx={{ py: 1.5 }}
              >
                Test Number 1 (+13613392529)
              </Button>
              <Button 
                variant="contained" 
                fullWidth
                size="large"
                onClick={() => handleSignIn('+13613227495')}
                sx={{ py: 1.5 }}
              >
                Test Number 2 (+13613227495)
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Container>
    </Fade>
  );
};

export default SignIn;