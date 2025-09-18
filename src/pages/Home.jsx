import React from 'react';
import { Box, Container, Typography, Button, Card, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PlayArrow, Assessment, Settings } from '@mui/icons-material';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          AI Interview Evaluator
        </Typography>
        
        <Typography variant="h5" color="text.secondary" sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}>
          Practice your interview skills with AI-powered speech analysis, 
          gaze tracking, and real-time feedback to improve your performance.
        </Typography>

        <Grid container spacing={4} sx={{ mt: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <PlayArrow sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Start Interview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, flexGrow: 1 }}>
                Begin a new interview session with real-time speech recognition 
                and gaze tracking analysis.
              </Typography>
              <Button 
                variant="contained" 
                size="large"
                onClick={() => navigate('/setup')}
              >
                Start Now
              </Button>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Assessment sx={{ fontSize: 48, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                View Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, flexGrow: 1 }}>
                Analyze your past performance with detailed metrics 
                and improvement recommendations.
              </Typography>
              <Button 
                variant="outlined" 
                size="large"
                onClick={() => navigate('/report')}
              >
                View Reports
              </Button>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Settings sx={{ fontSize: 48, color: 'info.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Practice Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, flexGrow: 1 }}>
                Customize your interview experience with different question types,
                difficulty levels, and focus areas.
              </Typography>
              <Button 
                variant="outlined" 
                size="large"
                onClick={() => navigate('/setup')}
              >
                Configure
              </Button>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 8, p: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Features
          </Typography>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                🎤 Speech Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time transcription and speech quality analysis
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                👁️ Gaze Tracking
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Eye contact monitoring and attention metrics
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                📊 Performance Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Detailed analytics and improvement suggestions
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                🤖 AI Questions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dynamic question generation based on your focus area
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Container>
  );
}