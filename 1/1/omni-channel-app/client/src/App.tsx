import { useEffect, useState } from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';
import { Routes, Route, Navigate } from 'react-router-dom';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

const App = () => {
  const [selectedAccount, setSelectedAccount] = useState('');
  
  useEffect(() => {
    console.log('App is mounting');
    localStorage.removeItem('selectedAccount');
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<SignIn onSelect={setSelectedAccount} />} />
        <Route 
          path="/dashboard" 
          element={
            selectedAccount ? (
              <Dashboard currentNumber={selectedAccount} />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
};

export default App;
