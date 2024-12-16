import { Box, Grid, Paper, Typography } from '@mui/material';
import { 
  Chat as ChatIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Phone as PhoneIcon 
} from '@mui/icons-material';
import { useState } from 'react';
import Chat from './Chat';
import EmailClient from './EmailClient';
import SMS from './SMS';
import Call from './Call';

interface DashboardProps {
  currentNumber: string;
}

const modules = [
  { name: 'Chat', icon: ChatIcon, color: '#1976d2' },
  { name: 'Email', icon: EmailIcon, color: '#2e7d32' },
  { name: 'SMS', icon: SmsIcon, color: '#ed6c02' },
  { name: 'Call', icon: PhoneIcon, color: '#9c27b0' }
];

function Dashboard({ currentNumber }: DashboardProps) {
  const [activeModule, setActiveModule] = useState('Chat');
  const [showCall, setShowCall] = useState(false);

  const handleCallClick = () => {
    setActiveModule('Call');
    setShowCall(true);
  };

  const handleCallClose = () => {
    setShowCall(false);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid item xs={12} sm={6} md={3} key={module.name}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
                bgcolor: activeModule === module.name ? module.color : 'white',
                color: activeModule === module.name ? 'white' : 'black',
                '&:hover': {
                  bgcolor: module.color,
                  color: 'white',
                }
              }}
              onClick={() => module.name === 'Call' ? handleCallClick() : setActiveModule(module.name)}
            >
              <module.icon sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6">{module.name}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ 
        mt: 2, 
        height: 'calc(100vh - 200px)',
        overflow: 'hidden',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow: 1
      }}>
        {activeModule === 'Chat' && <Chat selectedAccount={currentNumber} />}
        {activeModule === 'Email' && <EmailClient />}
        {activeModule === 'SMS' && <SMS currentNumber={currentNumber} />}
        {activeModule === 'Call' && showCall && (
          <Call 
            open={true}
            onClose={handleCallClose}
            currentNumber={currentNumber}
            direction="outgoing"
          />
        )}
      </Box>
    </Box>
  );
}

export default Dashboard;