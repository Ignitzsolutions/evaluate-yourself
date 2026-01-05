import React from 'react';
import { Container, Typography, Box, Paper, Grid, Card, CardContent } from '@mui/material';
import { Analytics as AnalyticsIcon, TrendingUp, PieChart, BarChart } from '@mui/icons-material';

export default function AnalyticsPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon color="primary" />
          Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Deep dive into your interview performance metrics
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <TrendingUp sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>Performance Trends</Typography>
              <Typography variant="body2" color="text.secondary">
                Track your progress over time
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <PieChart sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>Skill Breakdown</Typography>
              <Typography variant="body2" color="text.secondary">
                Analyze strengths and weaknesses
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <BarChart sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>Comparison</Typography>
              <Typography variant="body2" color="text.secondary">
                Compare your scores across sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Coming Soon
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Advanced analytics features are being developed to provide deeper insights into your interview performance.
        </Typography>
      </Paper>
    </Container>
  );
}
