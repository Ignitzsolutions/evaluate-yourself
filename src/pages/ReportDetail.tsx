import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useInterviewReport } from "@/hooks/useInterviewReports";
import { format } from "date-fns";

const ReportDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { report, loading, error } = useInterviewReport(id);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button variant="ghost" onClick={() => navigate("/reports")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
          <Card className="p-8 text-center">
            <p className="text-red-500">{error || "Report not found"}</p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/reports")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{report.title}</h1>
                {report.is_sample && <Badge variant="secondary">Sample</Badge>}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                <span>•</span>
                <span>{report.type}</span>
                <span>•</span>
                <span>{report.duration}</span>
              </div>
            </div>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="p-8 border border-border shadow-sm mb-8">
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">{report.overall_score}</div>
            <div className="text-lg text-muted-foreground">Overall Score</div>
          </div>
        </Card>

        {/* Detailed Scores */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Performance Breakdown</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(report.scores).map(([key, value]) => (
              <Card key={key} className="p-6 border border-border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground capitalize mb-1">
                      {key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()}
                    </div>
                    <div className="text-3xl font-bold text-primary">{value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Recommendations</h2>
          <Card className="p-6 border border-border shadow-sm">
            <ul className="space-y-3">
              {report.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">{index + 1}</span>
                  </div>
                  <p className="text-foreground">{rec}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Transcript */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Interview Transcript</h2>
          <Card className="p-6 border border-border shadow-sm">
            <div className="space-y-6">
              {report.transcript.map((message, index) => (
                <div key={index}>
                  <div className="font-semibold text-sm text-primary mb-1">
                    {message.speaker}
                  </div>
                  <p className="text-foreground">{message.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ReportDetail;
