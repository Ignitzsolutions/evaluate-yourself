import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PlayArrow,
  Assessment,
  Schedule,
  MoreVert,
  Delete,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import LogoutButton from '../components/LogoutButton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Mock data for dashboard
const mockUserStats = {
  totalSessions: 24,
  avgScore: 78,
  improvementRate: 12,
  totalHours: 8.5
};

const mockPerformanceData = [
  { date: '2025-09-10', score: 65, eyeContact: 58, confidence: 70 },
  { date: '2025-09-12', score: 72, eyeContact: 64, confidence: 75 },
  { date: '2025-09-14', score: 68, eyeContact: 61, confidence: 72 },
  { date: '2025-09-16', score: 81, eyeContact: 75, confidence: 83 },
  { date: '2025-09-18', score: 78, eyeContact: 72, confidence: 80 }
];

const mockRecentSessions = [
  {
    id: 1,
    date: '2025-09-18',
    type: 'Technical',
    duration: '25 min',
    score: 78,
    status: 'completed'
  },
  {
    id: 2,
    date: '2025-09-16',
    type: 'Behavioral',
    duration: '18 min',
    score: 81,
    status: 'completed'
  },
  {
    id: 3,
    date: '2025-09-14',
    type: 'Mixed',
    duration: '22 min',
    score: 68,
    status: 'completed'
  },
  {
    id: 4,
    date: '2025-09-12',
    type: 'Technical',
    duration: '30 min',
    score: 72,
    status: 'completed'
  }
];

const skillsData = [
  { name: 'Communication', value: 85, color: '#4CAF50' },
  { name: 'Technical Knowledge', value: 78, color: '#2196F3' },
  { name: 'Problem Solving', value: 82, color: '#FF9800' },
  { name: 'Confidence', value: 75, color: '#9C27B0' }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuClick = (event, session) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getTrendIcon = (rate) => {
    return rate > 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Interview Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your progress and improve your interview skills
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => navigate('/interview-cfig')}
            size="large"
          >
            New Interview
          </Button>
          <LogoutButton />
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Sessions
                  </Typography>
                  <Typography variant="h4">
                    {mockUserStats.totalSessions}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <Assessment />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Average Score
                  </Typography>
                  <Typography variant="h4">
                    {mockUserStats.avgScore}%
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Improvement
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4">
                      +{mockUserStats.improvementRate}%
                    </Typography>
                    {getTrendIcon(mockUserStats.improvementRate)}
                  </Box>
                </Box>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <TrendingUp />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Practice Hours
                  </Typography>
                  <Typography variant="h4">
                    {mockUserStats.totalHours}h
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Schedule />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Performance Chart */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Trends
              </Typography>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={mockPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2196F3"
                    strokeWidth={2}
                    name="Overall Score"
                  />
                  <Line
                    type="monotone"
                    dataKey="eyeContact"
                    stroke="#4CAF50"
                    strokeWidth={2}
                    name="Eye Contact"
                  />
                  <Line
                    type="monotone"
                    dataKey="confidence"
                    stroke="#FF9800"
                    strokeWidth={2}
                    name="Confidence"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Skills Breakdown */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: 400 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Skills Assessment
              </Typography>
              <Box sx={{ mt: 2 }}>
                {skillsData.map((skill, index) => (
                  <Box key={index} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {skill.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {skill.value}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={skill.value}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: skill.color
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Sessions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recent Sessions
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/report')}
                >
                  View All Reports
                </Button>
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Score</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockRecentSessions.map((session) => (
                      <TableRow key={session.id} hover>
                        <TableCell>{session.date}</TableCell>
                        <TableCell>
                          <Chip
                            label={session.type}
                            size="small"
                            color={session.type === 'Technical' ? 'primary' : 
                                   session.type === 'Behavioral' ? 'secondary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{session.duration}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${session.score}%`}
                            color={getScoreColor(session.score)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={session.status}
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            onClick={(e) => handleMenuClick(e, session)}
                            size="small"
                          >
                            <MoreVert />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { navigate('/report'); handleMenuClose(); }}>
          <ViewIcon sx={{ mr: 1 }} />
          View Report
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <Delete sx={{ mr: 1 }} />
          Delete Session
        </MenuItem>
      </Menu>
    </Container>
  );
}