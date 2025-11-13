import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePersonalityInsights } from "@/hooks/usePersonalityInsights";
import { ArrowLeft, FileText, Calendar } from "lucide-react";

interface ReportSummary {
  id: string;
  createdAt: string;
  title: string;
  tags: string[];
}

const PersonalityReportsList = () => {
  const navigate = useNavigate();
  const { listReports, loading, error } = usePersonalityInsights();
  const [reports, setReports] = useState<ReportSummary[]>([]);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await listReports();
        setReports(data);
      } catch (err) {
        console.error("Failed to load reports:", err);
      }
    };
    loadReports();
  }, [listReports]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/self-insight")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Personality Insights
          </Button>

          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Avenir, sans-serif", color: "#FF6B35" }}>
            My Personality Reports
          </h1>
          <p className="text-muted-foreground">
            View and manage your past personality assessment reports.
          </p>
        </div>

        {error && (
          <Card className="p-4 mb-6 border-red-200 bg-red-50">
            <p className="text-sm text-red-800">{error}</p>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
            <p className="text-muted-foreground mb-6">
              Complete your first personality assessment to generate a report.
            </p>
            <Link to="/self-insight/assessment">
              <Button style={{ backgroundColor: "#FF6B35" }}>
                Start Assessment
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="p-6 border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/self-insight/reports/${report.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{report.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(report.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {report.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/self-insight/reports/${report.id}`);
                    }}
                  >
                    View Report
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PersonalityReportsList;

