import { Analytics as AnalyticsIcon, PieChart, BarChart } from '@mui/icons-material';
import React, { useEffect, useMemo, useState } from 'react';
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
  Assessment,
  Schedule,
  MoreVert,
  Delete,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { authFetch } from '../utils/apiClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [summary, setSummary] = useState(null);
    const [trends, setTrends] = useState([]);
    const [skills, setSkills] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
  
    const handleMenuClick = (event, session) => {
      setSelectedSession(session);
      setAnchorEl(event.currentTarget);
    };
  
    const handleMenuClose = () => {
      setAnchorEl(null);
      setSelectedSession(null);
    };
  
    const getScoreColor = (score) => {
      if (score >= 80) return 'success';
      if (score >= 60) return 'warning';
      return 'error';
    };
  
    const getTrendIcon = (rate) => {
      return rate > 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />;
    };

    const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || '';

    useEffect(() => {
      let mounted = true;
      const load = async () => {
        try {
          const token = await getToken();
          const [summaryResp, trendsResp, skillsResp, reportsResp] = await Promise.all([
            authFetch(`${API_BASE_URL}/api/analytics/summary`, token),
            authFetch(`${API_BASE_URL}/api/analytics/trends`, token),
            authFetch(`${API_BASE_URL}/api/analytics/skills`, token),
            authFetch(`${API_BASE_URL}/api/interview/reports`, token),
          ]);

          if (!mounted) return;

          if (summaryResp.ok) setSummary(await summaryResp.json());
          if (trendsResp.ok) setTrends(await trendsResp.json());
          if (skillsResp.ok) setSkills(await skillsResp.json());
          if (reportsResp.ok) {
            const reportList = await reportsResp.json();
            setRecent(reportList.slice(0, 5));
          }
        } catch (e) {
          console.error('Analytics load failed:', e);
        } finally {
          if (mounted) setLoading(false);
        }
      };
      load();
      return () => { mounted = false; };
    }, [getToken, API_BASE_URL]);

    const skillsData = useMemo(() => {
      if (!skills) return [];
      return [
        { name: 'Communication', value: skills.communication || 0, color: '#4CAF50' },
        { name: 'Technical Knowledge', value: skills.technical || 0, color: '#2196F3' },
        { name: 'Problem Solving', value: skills.problem_solving || 0, color: '#FF9800' },
        { name: 'Confidence', value: skills.confidence || 0, color: '#9C27B0' },
      ];
    }, [skills]);

    const userStats = summary || { total_sessions: 0, avg_score: 0, improvement_pct: 0, practice_hours: 0 };
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


      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4, mt:4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Sessions
                  </Typography>
                  <Typography variant="h4">
                    {userStats.total_sessions}
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
                    {userStats.avg_score}%
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
                      {userStats.improvement_pct > 0 ? '+' : ''}{userStats.improvement_pct}%
                    </Typography>
                    {getTrendIcon(userStats.improvement_pct)}
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
                    {userStats.practice_hours}h
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
                <LineChart data={trends}>
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
                    {recent.map((session) => (
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
                        <TableCell>{session.duration || session.mode || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${session.score}%`}
                            color={getScoreColor(session.score)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={session.status || 'completed'}
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
        <MenuItem onClick={() => { 
          if (selectedSession?.id) navigate(`/report/${selectedSession.id}`);
          else navigate('/report');
          handleMenuClose(); 
        }}>
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
