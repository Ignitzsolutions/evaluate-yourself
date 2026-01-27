import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
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
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from "@mui/material";
import { 
  Schedule,
  QuestionMark,
  Chat,
  Visibility,
  TrendingUp,
  Assessment,
  PlayArrow,
  ExpandMore,
  CheckCircle,
  Warning
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#4CAF50", "#FF9800", "#F44336", "#2196F3", "#9C27B0"];

export default function ReportPage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [experienceRating, setExperienceRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Fetch report from backend
  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use sessionId from URL params or fallback to sessionStorage
        const reportSessionId = sessionId || sessionStorage.getItem('interviewSessionId');
        
        if (!reportSessionId) {
          setError('No interview session found. Please complete an interview first.');
          setLoading(false);
          return;
        }

        const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';
        const token = await getToken();
        
        console.log('Fetching report for sessionId:', reportSessionId);
        const response = await fetch(`${API_BASE_URL}/api/interview/reports/${reportSessionId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Report data fetched:', data);
          setReport(data);
        } else if (response.status === 404) {
          setError('Report not found. The interview session may not have completed properly.');
        } else {
          setError(`Failed to load report: ${response.status}`);
        }
      } catch (error) {
        console.error("Error fetching report:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch whenever sessionId changes OR on initial load
    fetchReport();
  }, [sessionId, getToken]);

  // Helper functions
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

  const handleSubmitRating = () => {
    console.log("Rating submitted:", { experienceRating, feedback });
    setShowSuccessPopup(true);
  };

  const handleClosePopup = () => {
    setShowSuccessPopup(false);
    navigate("/dashboard");
  };

  // Build score breakdown chart data
  const scoreChartData = report?.scores ? [
    { name: "Communication", score: report.scores.communication || 0 },
    { name: "Clarity", score: report.scores.clarity || 0 },
    { name: "Structure", score: report.scores.structure || 0 },
    ...(report.scores.technical_depth ? [{ name: "Technical", score: report.scores.technical_depth }] : []),
    { name: "Relevance", score: report.scores.relevance || 0 }
  ] : [];

  // Extract Q&A pairs from transcript
  const qaData = useMemo(() => {
    if (!report?.transcript) return [];
    const pairs = [];
    for (let i = 0; i < report.transcript.length; i += 2) {
      if (i + 1 < report.transcript.length) {
        pairs.push({
          question: report.transcript[i]?.text || '',
          answer: report.transcript[i + 1]?.text || '',
          index: pairs.length + 1
        });
      }
    }
    return pairs;
  }, [report]);

  // Loading state
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        bgcolor: '#fafafa'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Loading your report...</Typography>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ 
        p: 4, 
        maxWidth: 1200, 
        mx: "auto",
        minHeight: "100vh",
        bgcolor: "#fafafa"
      }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // No report found
  if (!report) {
    return (
      <Box sx={{ 
        p: 4, 
        maxWidth: 1200, 
        mx: "auto",
        minHeight: "100vh",
        bgcolor: "#fafafa"
      }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Report not found
        </Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 4, 
      maxWidth: 1200, 
      mx: "auto",
      minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      bgcolor: "#fafafa"
    }}>
      {/* Header */}
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
            Interview Report
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: "#666",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400
            }}
          >
            {report.title}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => navigate("/dashboard")}
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
          Back to Dashboard
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {/* Overall Score */}
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
            <Typography 
              variant="h2" 
              sx={{ 
                fontWeight: 700, 
                color: getScoreColor(report.overall_score),
                fontFamily: "'Inter', sans-serif",
                mb: 1 
              }}
            >
              {report.overall_score}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Overall Score
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: getScoreColor(report.overall_score),
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                display: "block",
                mt: 1
              }}
            >
              {getScoreLabel(report.overall_score)}
            </Typography>
          </Card>
        </Grid>

        {/* Duration */}
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
              {report.duration}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Duration
            </Typography>
          </Card>
        </Grid>

        {/* Questions */}
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
              {report.questions}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Questions
            </Typography>
          </Card>
        </Grid>

        {/* Interview Type */}
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
            <Assessment sx={{ 
              fontSize: 40, 
              color: "#388e3c", 
              mb: 2 
            }} />
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 700, 
                color: "#1a1a1a",
                fontFamily: "'Inter', sans-serif",
                mb: 1,
                textTransform: "capitalize"
              }}
            >
              {report.type}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: "#666",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            >
              Interview Type
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Score Breakdown */}
      {scoreChartData.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid item xs={12}>
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
                  Score Breakdown
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={scoreChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}/100`} />
                  <Bar dataKey="score" fill="#2196F3" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Questions & Answers */}
      {qaData.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid item xs={12}>
            <Card sx={{ 
              p: 4,
              bgcolor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <Chat sx={{ 
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
                  Questions & Answers
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {qaData.map((pair, idx) => (
                  <Accordion key={idx} defaultExpanded={idx === 0}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: "flex", gap: 2, alignItems: "center", width: "100%" }}>
                        <Typography 
                          sx={{ 
                            fontWeight: 600,
                            color: "#1976d2",
                            minWidth: "30px"
                          }}
                        >
                          Q{pair.index}
                        </Typography>
                        <Typography 
                          sx={{ 
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1
                          }}
                        >
                          {pair.question.substring(0, 80)}...
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: "#f9f9f9" }}>
                      <Box>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 700,
                            color: "#1a1a1a",
                            mb: 1
                          }}
                        >
                          Question:
                        </Typography>
                        <Typography 
                          sx={{ 
                            color: "#666",
                            mb: 3,
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {pair.question}
                        </Typography>

                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            fontWeight: 700,
                            color: "#1a1a1a",
                            mb: 1
                          }}
                        >
                          Your Answer:
                        </Typography>
                        <Typography 
                          sx={{ 
                            color: "#666",
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap"
                          }}
                        >
                          {pair.answer}
                        </Typography>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid item xs={12}>
            <Card sx={{ 
              p: 4,
              bgcolor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                <CheckCircle sx={{ 
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
                  Recommendations
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {report.recommendations.map((rec, idx) => (
                  <Box 
                    key={idx}
                    sx={{ 
                      p: 3, 
                      bgcolor: "#f5f5f5",
                      border: "1px solid #e0e0e0",
                      borderRadius: "8px",
                      display: "flex",
                      gap: 2
                    }}
                  >
                    <Box sx={{ 
                      color: "#2196F3",
                      fontWeight: "bold",
                      minWidth: "24px"
                    }}>
                      ✓
                    </Box>
                    <Typography 
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
            </Card>
          </Grid>
        </Grid>
      )}

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
