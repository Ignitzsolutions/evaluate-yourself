import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

interface InterviewReportSummary {
  id: string;
  title: string;
  date: string;
  type: string;
  mode: string;
  score: number;
  questions: number;
  is_sample: boolean;
}

interface TranscriptMessage {
  speaker: string;
  text: string;
  timestamp: string;
}

interface ScoreBreakdown {
  communication: number;
  clarity: number;
  structure: number;
  technical_depth?: number;
  relevance: number;
}

interface InterviewReport {
  id: string;
  title: string;
  date: string;
  type: string;
  mode: string;
  duration: string;
  overall_score: number;
  scores: ScoreBreakdown;
  transcript: TranscriptMessage[];
  recommendations: string[];
  questions: number;
  is_sample: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail = response.statusText;
      try {
        const error = await response.json();
        errorDetail = error.detail || error.message || errorDetail;
      } catch {
        // If response is not JSON, use status text
      }
      throw new Error(errorDetail || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Handle network errors, CORS errors, etc.
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Network error: Unable to connect to backend at ${API_BASE}. Please ensure the backend server is running.`);
    }
    throw error;
  }
}

export function useInterviewReports() {
  const [reports, setReports] = useState<InterviewReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        console.log("Fetching reports from:", `${API_BASE}/api/interview/reports`);
        // Try to fetch reports with or without token (sample reports should always be available)
        const data = await apiCall<InterviewReportSummary[]>("/api/interview/reports", {}, token || null);
        console.log("Reports fetched successfully:", data?.length || 0, "reports");
        setReports(data || []);
      } catch (err) {
        console.error("Error fetching reports:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch reports";
        
        // If it's a network error, try once more without token
        if (errorMessage.includes("Network error") || errorMessage.includes("Unable to connect")) {
          try {
            console.log("Retrying without authentication token...");
            const data = await apiCall<InterviewReportSummary[]>("/api/interview/reports", {}, null);
            console.log("Fallback fetch successful:", data?.length || 0, "reports");
            setReports(data || []);
            return;
          } catch (fallbackErr) {
            console.error("Fallback fetch also failed:", fallbackErr);
          }
        }
        
        setError(errorMessage);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [getToken]);

  return { reports, loading, error, refetch: () => {
    const fetchReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const data = await apiCall<InterviewReportSummary[]>("/api/interview/reports", {}, token);
        setReports(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch reports");
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }};
}

export function useInterviewReport(reportId: string | undefined) {
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required. Please sign in.");
          setLoading(false);
          return;
        }
        const data = await apiCall<InterviewReport>(`/api/interview/reports/${reportId}`, {}, token);
        setReport(data);
      } catch (err) {
        console.error("Error fetching report:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch report");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId, getToken]);

  return { report, loading, error };
}

