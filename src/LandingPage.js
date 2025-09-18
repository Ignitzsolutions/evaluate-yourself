import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
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
  useTheme,
  useMediaQuery,
  Tooltip
} from "@mui/material";
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import GroupIcon from '@mui/icons-material/Group';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PaletteIcon from '@mui/icons-material/Palette';

const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Analytics', icon: <BarChartOutlinedIcon />, path: '/analytics' },
    { text: 'Clients', icon: <GroupIcon />, path: '/clients' },
    { text: 'Tasks', icon: <AssignmentIcon />, path: '/tasks' },
    { text: 'Style Guide', icon: <PaletteIcon />, path: '/style-guide' },
  ];

  return (
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
          <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
          <Tooltip title="View Style Guide">
            <IconButton color="inherit" onClick={() => navigate('/style-guide')} aria-label="Open style guide">
              <PaletteIcon />
            </IconButton>
          </Tooltip>
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
              <Grid item xs={12} md={3}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <HomeIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Azure Speech Service
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" paragraph>
                    Real-time speech-to-text with continuous recognition via Azure Speech SDK.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                    Powers: Live transcription in InterviewHUD, speaking rate analysis
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BarChartOutlinedIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Azure Face API
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" paragraph>
                    Advanced facial landmarks, eye gaze tracking, and head pose analysis.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                    Powers: Eye contact feedback, attention metrics, blink detection
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AssignmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Azure Text Analytics
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" paragraph>
                    Sentiment analysis, key phrase extraction, and entity recognition.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                    Powers: Response sentiment scoring, keyword identification in ReportPage
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AssignmentIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                    <Typography variant="h6" component="h3">
                      Azure Conversation API
                    </Typography>
                  </Box>
                  <Typography color="text.secondary" paragraph>
                    Topic segmentation, summarization, and talking points extraction.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
                    Powers: Interview structure analysis and response quality in ReportPage
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Container>

          {/* Azure Integration Details Section */}
          <Container maxWidth="lg" sx={{ mt: 8, mb: 8 }}>
            <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ mb: 4 }}>
              Azure AI Services Integration
            </Typography>
            
            <Paper elevation={3} sx={{ p: 4, mb: 4, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                API Configuration Requirements
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Azure Speech Service</Typography>
                  <Typography variant="body2" paragraph>
                    • Endpoint: <code>https://{'{your-region}'}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1</code><br />
                    • Authentication: Subscription key<br />
                    • Configuration: Region, language code
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Azure Face API</Typography>
                  <Typography variant="body2" paragraph>
                    • Endpoint: <code>https://{'{your-resource-name}'}.cognitiveservices.azure.com/face/v1.0/detect</code><br />
                    • Authentication: Subscription key<br />
                    • Configuration: Face landmarks, head pose, gaze
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Azure Text Analytics API</Typography>
                  <Typography variant="body2" paragraph>
                    • Endpoint: <code>https://{'{your-resource-name}'}.cognitiveservices.azure.com/text/analytics/v3.1/sentiment</code><br />
                    • Authentication: Subscription key<br />
                    • Configuration: API version, response format
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">Azure Conversation Analysis API</Typography>
                  <Typography variant="body2" paragraph>
                    • Endpoint: <code>https://{'{your-resource-name}'}.cognitiveservices.azure.com/language/:analyze-conversations</code><br />
                    • Authentication: Subscription key<br />
                    • Configuration: API version, language
                  </Typography>
                </Grid>
              </Grid>
              
              <Typography variant="h6" gutterBottom>
                Security & Integration
              </Typography>
              
              <Typography variant="body2" paragraph>
                • All API credentials are stored securely in Azure Key Vault and accessed via environment variables<br />
                • Backend proxy implementation handles CORS and authentication to protect API keys from client exposure<br />
                • React frontend communicates with Azure services through a secure Node.js/Express backend API<br />
                • WebSocket connections for real-time services are authenticated and proxied via secure backend
              </Typography>
              
              <Typography variant="h6" gutterBottom>
                Implementation Notes
              </Typography>
              
              <Typography variant="body2">
                • Speech Service: Direct integration via official Azure SDK for continuous transcription<br />
                • Face API: Frame-by-frame analysis via backend proxy to maintain processing performance<br />
                • Text Analytics: Asynchronous processing of transcribed content to generate sentiment scores<br />
                • Conversation Analysis: Post-session processing for comprehensive interview assessment
              </Typography>
            </Paper>
          </Container>
          
          {/* Call to Action */}
          <Container maxWidth="lg" sx={{ mt: 8, mb: 4 }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 6, 
                borderRadius: 2, 
                textAlign: 'center',
                background: 'linear-gradient(to right, #1976d2, #0d47a1)'
              }}
            >
              <Typography variant="h4" component="h2" gutterBottom sx={{ color: 'white', mb: 3 }}>
                Ready to transform your interview process?
              </Typography>
              <Typography variant="body1" paragraph sx={{ color: 'white', mb: 4 }}>
                Our Azure AI-powered platform provides unparalleled insights into candidate performance.
              </Typography>
              <Button 
                variant="contained" 
                color="secondary" 
                size="large"
                onClick={() => navigate('/interview-hud')}
                sx={{ 
                  px: 4, 
                  py: 1.5, 
                  fontSize: '1.1rem',
                  backgroundColor: 'white',
                  color: '#1976d2',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  }
                }}
              >
                Try Interview HUD Demo
              </Button>
            </Paper>
          </Container>
        </Box>
    </Box>
  );
};

export default LandingPage;