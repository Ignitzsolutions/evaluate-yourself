import React, { useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
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

// Mock data - in real implementation, this would come from session storage or API
const mockSessionData = {
  totalDuration: 1245, // seconds
  questionsAnswered: 5,
  averageResponseTime: 34, // seconds
  totalWords: 425,
  speakingTime: 780, // seconds
  silenceTime: 465, // seconds
  eyeContactPercentage: 72,
  averageBlinkRate: 18,
  type: "technical"
};

const mockTimeSeriesData = [
  { time: 0, eyeContact: 65, confidence: 70, speaking: 1 },
  { time: 60, eyeContact: 78, confidence: 85, speaking: 1 },
  { time: 120, eyeContact: 45, confidence: 60, speaking: 0 },
  { time: 180, eyeContact: 82, confidence: 90, speaking: 1 },
  { time: 240, eyeContact: 70, confidence: 75, speaking: 1 },
  { time: 300, eyeContact: 55, confidence: 65, speaking: 0 },
  { time: 360, eyeContact: 88, confidence: 92, speaking: 1 },
  { time: 420, eyeContact: 75, confidence: 80, speaking: 1 },
  { time: 480, eyeContact: 60, confidence: 70, speaking: 0 },
  { time: 540, eyeContact: 85, confidence: 88, speaking: 1 },
];

const speechAnalysisData = [
  { name: "Clarity", score: 85 },
  { name: "Pace", score: 78 },
  { name: "Volume", score: 82 },
  { name: "Articulation", score: 90 },
];

const timeDistributionData = [
  { name: "Speaking", value: mockSessionData.speakingTime, color: "#4CAF50" },
  { name: "Silence", value: mockSessionData.silenceTime, color: "#FF9800" },
];

export default function ReportPage() {
  const navigate = useNavigate();
  
  // Rating and feedback state
  const [experienceRating, setExperienceRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const averageMetrics = useMemo(() => {
    const avgEyeContact = mockTimeSeriesData.reduce((sum, point) => sum + point.eyeContact, 0) / mockTimeSeriesData.length;
    const avgConfidence = mockTimeSeriesData.reduce((sum, point) => sum + point.confidence, 0) / mockTimeSeriesData.length;
    return { avgEyeContact: Math.round(avgEyeContact), avgConfidence: Math.round(avgConfidence) };
  }, []);

  const formatTime = (seconds) => {
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
            New Interview
          </Button>
          <LogoutButton />
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
            <Schedule sx={{ 
              fontSize: 40, 
              color: "#1976d2", 
              mb: 2 
            }} />
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 1 
              }}
            >
              {formatTime(mockSessionData.totalDuration)}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Total Duration
            </Typography>
          </Card>
        </Grid>
        
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
            <QuestionMark sx={{ 
              fontSize: 40, 
              color: "#d32f2f", 
              mb: 2 
            }} />
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 1 
              }}
            >
              {mockSessionData.questionsAnswered}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Questions Answered
            </Typography>
          </Card>
        </Grid>
        
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
            <Chat sx={{ 
              fontSize: 40, 
              color: "#388e3c", 
              mb: 2 
            }} />
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 1 
              }}
            >
              {mockSessionData.totalWords}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Total Words
            </Typography>
          </Card>
        </Grid>
        
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
            <Visibility sx={{ 
              fontSize: 40, 
              color: averageMetrics.avgEyeContact >= 80 ? "#4caf50" :
                     averageMetrics.avgEyeContact >= 60 ? "#ff9800" : "#f44336", 
              mb: 2 
            }} />
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 1 
              }}
            >
              {averageMetrics.avgEyeContact}%
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
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
              <LineChart data={mockTimeSeriesData}>
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
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Speech Analysis
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={speechAnalysisData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}/100`, "Score"]} />
                <Bar dataKey="score" fill="#2196F3" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
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
                {mockSessionData.averageResponseTime}s
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
                {Math.round((mockSessionData.totalWords / mockSessionData.speakingTime) * 60)} words/min
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
                {mockSessionData.averageBlinkRate} blinks/min
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

        {/* Recommendations */}
        <Grid item xs={12}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recommendations
            </Typography>
            
            <Grid container spacing={2}>
              {averageMetrics.avgEyeContact < 70 && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: "warning.light", borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                      🎯 Improve Eye Contact
                    </Typography>
                    <Typography variant="body2">
                      Try to maintain more consistent eye contact with the camera. 
                      Practice looking directly at the lens rather than the screen.
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {speechAnalysisData.find(d => d.name === "Pace")?.score < 75 && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: "info.light", borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                      🗣️ Speaking Pace
                    </Typography>
                    <Typography variant="body2">
                      Consider adjusting your speaking pace. Practice with a metronome 
                      or record yourself to find your optimal rhythm.
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              {mockSessionData.averageResponseTime > 30 && (
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