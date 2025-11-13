import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/self-insight";

interface AssessmentAnswer {
  questionId: string;
  value: number;
}

interface ReportSummary {
  id: string;
  createdAt: string;
  title: string;
  tags: string[];
}

interface PersonalityReport {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  trait_scores: Array<{
    trait: string;
    domain: string;
    score: number;
    level: "LOW" | "AVERAGE" | "HIGH";
  }>;
  development_areas: Array<{
    trait: string;
    description: string;
    suggestions: string[];
  }>;
  career_fit_thrives: Array<{ description: string }>;
  career_fit_challenges: Array<{ description: string }>;
  work_style_tips: Array<{
    title: string;
    description: string;
  }>;
  reflections: {
    strengths: string;
    development: string;
  };
}

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export function usePersonalityInsights() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ClerkProvider is always rendered, so useAuth is safe
  const auth = useAuth();
  const getToken = auth?.getToken || (async () => null);

  const createAssessment = async (answers: AssessmentAnswer[]): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const result = await apiCall<{ reportId: string }>("/assessments", {
        method: "POST",
        body: JSON.stringify({ answers }),
      }, token);
      return result.reportId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create assessment";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listReports = async (): Promise<ReportSummary[]> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      return await apiCall<ReportSummary[]>("/reports", {}, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reports";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getReport = async (id: string): Promise<PersonalityReport> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      return await apiCall<PersonalityReport>(`/reports/${id}`, {}, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load report";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateReflections = async (
    id: string,
    strengths: string,
    development: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await apiCall(`/reports/${id}/reflections`, {
        method: "PATCH",
        body: JSON.stringify({ strengths, development }),
      }, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update reflections";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/reports/${id}/pdf`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `personality-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download PDF";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createAssessment,
    listReports,
    getReport,
    updateReflections,
    downloadPDF,
    loading,
    error,
  };
}

