import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
} from '@mui/material';
import {
  Work as InterviewsIcon,
  Code,
  Psychology,
  Shuffle,
  PlayArrow,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const interviewTypes = [
  {
    id: 'technical',
    title: 'Technical Interview',
    description: 'Practice coding questions, system design, and technical concepts with AI feedback.',
    icon: <Code sx={{ fontSize: 48 }} />,
    color: 'primary',
    duration: '25-45 min',
    difficulty: 'Medium-Hard',
  },
  {
    id: 'behavioral',
    title: 'Behavioral Interview',
    description: 'Master the STAR method and practice answering common behavioral questions.',
    icon: <Psychology sx={{ fontSize: 48 }} />,
    color: 'secondary',
    duration: '15-30 min',
    difficulty: 'Medium',
  },
  {
    id: 'mixed',
    title: 'Mixed Interview',
    description: 'A comprehensive session combining both technical and behavioral questions.',
    icon: <Shuffle sx={{ fontSize: 48 }} />,
    color: 'success',
    duration: '30-60 min',
    difficulty: 'Varies',
  },
];

export default function InterviewsPage() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InterviewsIcon color="primary" />
          Interviews
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose an interview type to start practicing
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {interviewTypes.map((type) => (
          <Grid item xs={12} md={4} key={type.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ color: `${type.color}.main`, mb: 2 }}>
                  {type.icon}
                </Box>
                <Typography variant="h5" gutterBottom>
                  {type.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {type.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Chip label={type.duration} size="small" variant="outlined" />
                  <Chip label={type.difficulty} size="small" color={type.color} />
                </Box>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color={type.color}
                  startIcon={<PlayArrow />}
                  onClick={() => navigate('/interview-cfig')}
                  fullWidth
                >
                  Start {type.title.split(' ')[0]}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
