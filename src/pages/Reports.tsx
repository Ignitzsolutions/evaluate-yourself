import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Calendar, TrendingUp, Loader2 } from "lucide-react";
import { useInterviewReports } from "@/hooks/useInterviewReports";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const Reports = () => {
  const { reports, loading, error } = useInterviewReports();

  const userReports = reports.filter(r => !r.is_sample);
  const sampleReports = reports.filter(r => r.is_sample);

  const avgScore = userReports.length > 0
    ? Math.round(userReports.reduce((sum, r) => sum + r.score, 0) / userReports.length)
    : 0;

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

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-red-500">{error}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Interview Reports</h1>
          <p className="text-muted-foreground">Review your practice sessions and track your progress</p>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{avgScore}</div>
                <div className="text-sm text-muted-foreground">Average Score</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{userReports.length}</div>
                <div className="text-sm text-muted-foreground">Your Sessions</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {userReports.length > 1 ? "+" : ""}
                  {userReports.length > 1 ? Math.round((userReports[0]?.score || 0) - (userReports[userReports.length - 1]?.score || 0)) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Improvement</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Your Reports */}
        {userReports.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Reports</h2>
            <div className="space-y-4">
              {userReports.map((report) => (
                <Card key={report.id} className="p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{report.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                        <span>•</span>
                        <span>{report.type}</span>
                        <span>•</span>
                        <span>{report.mode}</span>
                        <span>•</span>
                        <span>{report.questions} question{report.questions > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{report.score}</div>
                        <div className="text-sm text-muted-foreground">Score</div>
                      </div>
                      <Link to={`/reports/${report.id}`}>
                        <Button>View Report</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Sample Reports */}
        {sampleReports.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Sample Reports</h2>
            <div className="space-y-4">
              {sampleReports.map((report) => (
                <Card key={report.id} className="p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{report.title}</h3>
                        <Badge variant="secondary">Sample</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                        <span>•</span>
                        <span>{report.type}</span>
                        <span>•</span>
                        <span>{report.mode}</span>
                        <span>•</span>
                        <span>{report.questions} question{report.questions > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{report.score}</div>
                        <div className="text-sm text-muted-foreground">Score</div>
                      </div>
                      <Link to={`/reports/${report.id}`}>
                        <Button>View Report</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {userReports.length === 0 && sampleReports.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No reports available yet. Complete an interview to see your reports here.</p>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
