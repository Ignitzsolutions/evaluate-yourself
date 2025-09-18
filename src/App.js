import React, { useState } from "react";
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Grid, 
  Paper, 
  TextField, 
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  CssBaseline,
  ThemeProvider,
  createTheme
} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: 'Lato, sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      const existingEmails = JSON.parse(localStorage.getItem("interestedEmails") || "[]");
      existingEmails.push({ email, date: new Date().toISOString() });
      localStorage.setItem("interestedEmails", JSON.stringify(existingEmails));
      setSubmitted(true);
      setEmail("");
    }
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Analytics', icon: <BarChartOutlinedIcon />, path: '/analytics' },
    { text: 'Clients', icon: <GroupIcon />, path: '/clients' },
    { text: 'Tasks', icon: <AssignmentIcon />, path: '/tasks' },
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {/* App Bar */}
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={toggleDrawer}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Evaluate Yourself
            </Typography>
            <Button color="inherit">Login</Button>
          </Toolbar>
        </AppBar>

        {/* Navigation Drawer */}
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={toggleDrawer}
          sx={{
            width: 240,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 240,
              boxSizing: 'border-box',
            },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {menuItems.map((item, index) => (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton 
                    selected={index === 0}
                    sx={{
                      '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                        '&:hover': {
                          backgroundColor: 'action.selected',
                        },
                      },
                    }}
                  >
                    <ListItemIcon>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
            <Divider />
          </Box>
        </Drawer>

        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Toolbar />
          
          {/* Hero Section */}
          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  height: '100%',
                  minHeight: 400 
                }}>
                  <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Evaluate Yourself
                  </Typography>
                  <Typography variant="h5" color="text.secondary" paragraph>
                    The Power of AI in Recruitment
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 3 }}>
                    Revolutionizing candidate assessment with intelligent, data-driven insights.
                  </Typography>
                  
                  <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Enter your email"
                      variant="outlined"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      size="large"
                      sx={{ px: 4 }}
                    >
                      Get Notified
                    </Button>
                  </Box>
                  
                  {submitted && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Thank you! We'll notify you when we launch.
                    </Alert>
                  )}
                  
                  <Button
                    variant="outlined"
                    color="primary"
                    size="large"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    🚀 Coming Soon
                  </Button>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 400
                }}>
                  <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
                    <Box
                      component="img"
                      src="/assets/skillevaluation.png"
                      alt="Skill Evaluation"
                      sx={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: 2,
                        display: 'block'
                      }}
                    />
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </Container>

          {/* Features Section */}
          <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
            <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ mb: 4 }}>
              Key Features
            </Typography>
            <Grid container spacing={4}>
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <HomeIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      AI-Powered Analysis
                    </Typography>
                  </Box>
                  <Typography color="text.secondary">
                    Leverage advanced AI algorithms to assess candidate potential and fit.
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BarChartOutlinedIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Data-Driven Insights
                    </Typography>
                  </Box>
                  <Typography color="text.secondary">
                    Get comprehensive reports with actionable insights for better hiring decisions.
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AssignmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Fast & Efficient
                    </Typography>
                  </Box>
                  <Typography color="text.secondary">
                    Streamline your recruitment process with automated evaluation tools.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;