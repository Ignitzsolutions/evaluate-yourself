import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../utils/apiClient";
import { 
  Box, 
  Card, 
  Typography, 
  Grid, 
  Button, 
  Rating, 
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from "@mui/material";
import { 
  Schedule,
  QuestionMark,
  Chat,
  Visibility,
  TrendingUp,
  Assessment,
  PlayArrow
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";



export default function ReportPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { sessionId } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  
  // Fetch report from backend
  useEffect(() => {
    if (sessionId) {
      const fetchReport = async () => {
        try {
          const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || '';
          
          // Build headers with auth if available
          const headers = {
            'Content-Type': 'application/json',
          };
          
          // Try to get auth token from localStorage (if using Clerk or similar)
          const authToken = localStorage.getItem('clerk_session') || localStorage.getItem('authToken');
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
          }
          
          const token = await getToken();
          const response = await authFetch(`${API_BASE_URL}/api/interview/reports/${sessionId}`, token, {
            headers: headers
          });
          
          if (response.ok) {
            const data = await response.json();
            setReport(data);
          } else if (response.status === 401) {
            // Auth failed but backend should still return report if it exists
            console.warn('Authentication failed, but report may still be accessible');
            // Try again without auth token
            const retryResponse = await fetch(`${API_BASE_URL}/api/interview/reports/${sessionId}`);
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              setReport(data);
            }
          } else {
            console.error("Error fetching report:", response.status, response.statusText);
          }
        } catch (error) {
          console.error("Error fetching report:", error);
        }
      };
      fetchReport();
    }
  }, [sessionId, user, getToken]);
  
  // Rating and feedback state
  const [experienceRating, setExperienceRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Compute average metrics from real time series if available
  const averageMetrics = useMemo(() => {
    if (!report || !report.time_series || report.time_series.length === 0) return { avgEyeContact: 0, avgConfidence: 0 };
    const avgEyeContact = report.time_series.reduce((sum, point) => sum + (point.eyeContact || 0), 0) / report.time_series.length;
    const avgConfidence = report.time_series.reduce((sum, point) => sum + (point.confidence || 0), 0) / report.time_series.length;
    return { avgEyeContact: Math.round(avgEyeContact), avgConfidence: Math.round(avgConfidence) };
  }, [report]);

  const formatTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAxis = (tickItem) => {
    return formatTime(tickItem);
  };

  const handleSubmitRating = () => {
    // In a real app, this would submit to an API
    console.log("Rating submitted:", { experienceRating, feedback });
    setShowSuccessPopup(true);
  };

  const handleClosePopup = () => {
    setShowSuccessPopup(false);
    navigate("/dashboard");
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4CAF50"; // Green
    if (score >= 60) return "#FF9800"; // Orange
    return "#F44336"; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    return "Needs Improvement";
  };

  // Helper: fallback if metrics not loaded
  const metrics = report?.metrics || {};
  const timeSeries = report?.time_series || [];
  // For pie chart
  const timeDistributionData = [
    { name: "Speaking", value: metrics.speaking_time || 0, color: "#4CAF50" },
    { name: "Silence", value: metrics.silence_time || 0, color: "#FF9800" },
  ];

  return (
    <Box sx={{ 
      p: 4, 
      maxWidth: 1200, 
      mx: "auto",
      minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      bgcolor: "#fafafa"
    }}>
      {/* Clean Header */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        mb: 5,
        pb: 3,
        borderBottom: "1px solid #e0e0e0"
      }}>
        <Box>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 700, 
              color: "#1a1a1a",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "-0.02em",
              mb: 1
            }}
          >
            Interview Analysis
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: "#666",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400
            }}
          >
            Comprehensive analysis of your interview performance
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            onClick={() => navigate("/")}
            startIcon={<PlayArrow />}
            sx={{
              bgcolor: "#1976d2",
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              px: 3,
              py: 1.5,
              boxShadow: "0 2px 8px rgba(25, 118, 210, 0.2)",
              "&:hover": {
                bgcolor: "#1565c0",
                boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)"
              }
            }}
          >
            Back to Home
          </Button>
        </Box>
      </Box>

      {/* Clean Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            p: 3, 
            textAlign: "center",
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            transition: "all 0.2s ease",
            "&:hover": {
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              transform: "translateY(-2px)"
            }
          }}>
            <Schedule sx={{ fontSize: 40, color: "#1976d2", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#1a1a1a", fontFamily: "'Inter', sans-serif", mb: 1 }}>
              {formatTime(metrics.total_duration)}
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              Total Duration
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 3, textAlign: "center", bgcolor: "white", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)", transition: "all 0.2s ease", "&:hover": { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)", transform: "translateY(-2px)" } }}>
            <QuestionMark sx={{ fontSize: 40, color: "#d32f2f", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#1a1a1a", fontFamily: "'Inter', sans-serif", mb: 1 }}>
              {metrics.questions_answered}
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              Questions Answered
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 3, textAlign: "center", bgcolor: "white", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)", transition: "all 0.2s ease", "&:hover": { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)", transform: "translateY(-2px)" } }}>
            <Chat sx={{ fontSize: 40, color: "#388e3c", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#1a1a1a", fontFamily: "'Inter', sans-serif", mb: 1 }}>
              {metrics.total_words}
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              Total Words
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ p: 3, textAlign: "center", bgcolor: "white", border: "1px solid #e0e0e0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)", transition: "all 0.2s ease", "&:hover": { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)", transform: "translateY(-2px)" } }}>
            <Visibility sx={{ fontSize: 40, color: averageMetrics.avgEyeContact >= 80 ? "#4caf50" : averageMetrics.avgEyeContact >= 60 ? "#ff9800" : "#f44336", mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: "#1a1a1a", fontFamily: "'Inter', sans-serif", mb: 1 }}>
              {averageMetrics.avgEyeContact}%
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              Eye Contact
            </Typography>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Performance Charts */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <TrendingUp sx={{ 
                fontSize: 24, 
                color: "#1976d2", 
                mr: 1 
              }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Performance Over Time
              </Typography>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTimeAxis}
                  label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  labelFormatter={(value) => `Time: ${formatTime(value)}`}
                  formatter={(value, name) => [`${value}%`, name]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="eyeContact" 
                  stroke="#2196F3" 
                  strokeWidth={2}
                  name="Eye Contact"
                />
                <Line 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  name="Confidence"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        {/* Time Distribution */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <Assessment sx={{ 
                fontSize: 24, 
                color: "#1976d2", 
                mr: 1 
              }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Time Distribution
              </Typography>
            </Box>
            <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={timeDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {timeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatTime(value)} />
                  </PieChart>
            </ResponsiveContainer>
          </Card>
        </Grid>

        {/* Speech Analysis */}
        <Grid item xs={12} lg={6}>
          {/* Speech Analysis section removed: no real data available. Add if backend provides speech analysis metrics. */}
        </Grid>

        {/* Detailed Metrics */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <Assessment sx={{ 
                fontSize: 24, 
                color: "#1976d2", 
                mr: 1 
              }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Detailed Metrics
              </Typography>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: "#666",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  mb: 1
                }}
              >
                Average Response Time
              </Typography>
              <Typography 
                variant="h6"
                sx={{ 
                  fontWeight: 700,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                {metrics.average_response_time ? `${metrics.average_response_time}s` : 'N/A'}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: "#666",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  mb: 1
                }}
              >
                Speaking Rate
              </Typography>
              <Typography 
                variant="h6"
                sx={{ 
                  fontWeight: 700,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                {metrics.speaking_time && metrics.total_words ? `${Math.round((metrics.total_words / metrics.speaking_time) * 60)} words/min` : 'N/A'}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: "#666",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  mb: 1
                }}
              >
                Average Blink Rate
              </Typography>
              <Typography 
                variant="h6"
                sx={{ 
                  fontWeight: 700,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                {metrics.average_blink_rate ? `${metrics.average_blink_rate} blinks/min` : 'N/A'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: "#666",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  mb: 1
                }}
              >
                Overall Performance
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ color: getScoreColor(averageMetrics.avgConfidence) }}
              >
                {getScoreLabel(averageMetrics.avgConfidence)}
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Eye Contact & Presence Section */}
        <Grid item xs={12}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
              <Visibility sx={{ 
                fontSize: 24, 
                color: "#1976d2", 
                mr: 1 
              }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Eye Contact & Presence
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: "center", p: 2 }}>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 700,
                      color: averageMetrics.avgEyeContact >= 70 ? "#4CAF50" : "#FF9800",
                      fontFamily: "'Inter', sans-serif",
                      mb: 1
                    }}
                  >
                    {metrics.eye_contact_pct ? `${metrics.eye_contact_pct}%` : 'N/A'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: "#666",
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    Average Eye Contact
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: "#999",
                      fontFamily: "'Inter', sans-serif",
                      display: "block",
                      mt: 1
                    }}
                  >
                    Target: {'>'}70%
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Box>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: "#666",
                      fontFamily: "'Inter', sans-serif",
                      mb: 2
                    }}
                  >
                    {averageMetrics.avgEyeContact >= 70 
                      ? "Good eye contact maintained throughout the interview. Continue this practice."
                      : "Eye contact was below the recommended threshold. Practice maintaining focus on the camera lens."}
                  </Typography>
                  
                  {averageMetrics.avgEyeContact < 70 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: 600,
                          color: "#1a1a1a",
                          fontFamily: "'Inter', sans-serif",
                          mb: 1
                        }}
                      >
                        Recommendations:
                      </Typography>
                      <ul style={{ margin: 0, paddingLeft: "20px", color: "#666" }}>
                        <li>Position your camera at eye level</li>
                        <li>Use notes sparingly to maintain eye contact</li>
                        <li>Practice maintaining focus on the camera lens</li>
                        <li>Minimize distractions in your environment</li>
                      </ul>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Card>
        </Grid>
        
        {/* AI Candidate Feedback */}
        {report?.ai_feedback && (
          <Grid item xs={12}>
            <Card sx={{ 
              p: 4,
              bgcolor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: "#1a1a1a",
                  fontFamily: "'Inter', sans-serif",
                  mb: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 1
                }}
              >
                🤖 AI Interview Coach Feedback
              </Typography>
              
              {/* Overall Summary */}
              <Box sx={{ mb: 4, p: 3, bgcolor: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                <Typography variant="body1" sx={{ color: "#0369a1", fontFamily: "'Inter', sans-serif", lineHeight: 1.7 }}>
                  {report.ai_feedback.overall_summary}
                </Typography>
              </Box>
              
              <Grid container spacing={3}>
                {/* Strengths */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#166534", mb: 2, fontFamily: "'Inter', sans-serif" }}>
                    ✅ Your Strengths
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {report.ai_feedback.strengths?.map((strength, idx) => (
                      <Box key={idx} sx={{ p: 2, bgcolor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                        <Typography variant="body2" sx={{ color: "#166534", fontFamily: "'Inter', sans-serif" }}>
                          {strength}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                
                {/* Areas for Improvement */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#9a3412", mb: 2, fontFamily: "'Inter', sans-serif" }}>
                    📈 Areas for Improvement
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {report.ai_feedback.areas_for_improvement?.map((area, idx) => (
                      <Box key={idx} sx={{ p: 2, bgcolor: "#fff7ed", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                        <Typography variant="body2" sx={{ color: "#9a3412", fontFamily: "'Inter', sans-serif" }}>
                          {area}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Grid>
                
                {/* Communication Feedback */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1e40af", mb: 2, fontFamily: "'Inter', sans-serif" }}>
                    🗣️ Communication Feedback
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: "#eff6ff", borderRadius: "6px", border: "1px solid #bfdbfe" }}>
                    <Typography variant="body2" sx={{ color: "#1e40af", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                      {report.ai_feedback.communication_feedback}
                    </Typography>
                  </Box>
                </Grid>
                
                {/* Content Feedback */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#7c2d12", mb: 2, fontFamily: "'Inter', sans-serif" }}>
                    📝 Content Feedback
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: "#fef3c7", borderRadius: "6px", border: "1px solid #fde68a" }}>
                    <Typography variant="body2" sx={{ color: "#7c2d12", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
                      {report.ai_feedback.content_feedback}
                    </Typography>
                  </Box>
                </Grid>
                
                {/* Tips for Next Interview */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#4c1d95", mb: 2, fontFamily: "'Inter', sans-serif" }}>
                    💡 Tips for Your Next Interview
                  </Typography>
                  <Grid container spacing={2}>
                    {report.ai_feedback.tips_for_next_interview?.map((tip, idx) => (
                      <Grid item xs={12} sm={6} md={3} key={idx}>
                        <Box sx={{ p: 2, bgcolor: "#faf5ff", borderRadius: "6px", border: "1px solid #e9d5ff", height: "100%" }}>
                          <Typography variant="body2" sx={{ color: "#4c1d95", fontFamily: "'Inter', sans-serif" }}>
                            {tip}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Card>
          </Grid>
        )}
        
        {/* Recommendations */}
        <Grid item xs={12}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 3
              }}
            >
              Recommendations
            </Typography>
            
            {report?.recommendations && report.recommendations.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {report.recommendations.map((rec, idx) => (
                  <Box 
                    key={idx}
                    sx={{ 
                      p: 2, 
                      bgcolor: "#f5f5f5",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px"
                    }}
                  >
                    <Typography 
                      variant="body2"
                      sx={{ 
                        color: "#374151",
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.6
                      }}
                    >
                      {rec}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Grid container spacing={2}>
                {averageMetrics.avgEyeContact < 70 && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: "#fff3cd", border: "1px solid #e0e0e0", borderRadius: "8px" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "#856404" }}>
                        Improve Eye Contact
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#856404" }}>
                        Try to maintain more consistent eye contact with the camera. 
                        Practice looking directly at the lens rather than the screen.
                      </Typography>
                    </Box>
                  </Grid>
                )}
              
              {/* Speaking Pace recommendation removed: no real data available. Add if backend provides speech analysis metrics. */}
              
              {metrics.average_response_time && metrics.average_response_time > 30 && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: "success.light", borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                      ⚡ Response Time
                    </Typography>
                    <Typography variant="body2">
                      Work on thinking aloud and structuring your responses quickly. 
                      Practice the STAR method for behavioral questions.
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              <Grid item xs={12} md={6}>
                <Box sx={{ p: 2, bgcolor: "primary.light", borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                    📚 Continue Practicing
                  </Typography>
                  <Typography variant="body2">
                    Regular practice with mock interviews will help improve your 
                    confidence and performance metrics over time.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Rating and Feedback Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card sx={{ 
            p: 4,
            bgcolor: "white",
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
          }}>
            <Typography 
              variant="h5" 
              sx={{ 
                mb: 3,
                fontWeight: 600,
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif"
              }}
            >
              Rate Your Experience
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2,
                    fontWeight: 500,
                    color: "#1a1a1a",
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  How was your interview experience?
                </Typography>
                <Rating
                  name="experience-rating"
                  value={experienceRating}
                  onChange={(event, newValue) => {
                    setExperienceRating(newValue);
                  }}
                  size="large"
                  sx={{ mb: 2 }}
                />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: "#666",
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  {experienceRating === 0 && "Click to rate your experience"}
                  {experienceRating === 1 && "Poor - Needs significant improvement"}
                  {experienceRating === 2 && "Fair - Some issues to address"}
                  {experienceRating === 3 && "Good - Satisfactory experience"}
                  {experienceRating === 4 && "Very Good - Minor improvements needed"}
                  {experienceRating === 5 && "Excellent - Outstanding experience!"}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 2,
                    fontWeight: 500,
                    color: "#1a1a1a",
                    fontFamily: "'Inter', sans-serif"
                  }}
                >
                  Additional Feedback (Optional)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Share your thoughts about the interview process, technical issues, or suggestions for improvement..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: "'Inter', sans-serif",
                      borderRadius: "8px"
                    }
                  }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmitRating}
                disabled={experienceRating === 0}
                sx={{ 
                  minWidth: 200,
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  py: 1.5
                }}
              >
                Submit Rating
              </Button>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Success Popup */}
      <Dialog
        open={showSuccessPopup}
        onClose={handleClosePopup}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
          <Typography variant="h4" color="success.main">
            🎉 Thank You!
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Your feedback has been submitted successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your rating helps us improve the interview experience for everyone.
            {experienceRating >= 4 && " We're thrilled you had a great experience!"}
            {experienceRating === 3 && " We appreciate your feedback and will work on improvements."}
            {experienceRating < 3 && " We're sorry your experience wasn't optimal. Your feedback will help us do better."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleClosePopup}
            sx={{ minWidth: 150 }}
          >
            Back to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}