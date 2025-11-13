import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { FileText, Upload, Target, MessageSquare, Code, Presentation, PenTool, TrendingUp, Brain } from "lucide-react";

const Dashboard = () => {
  const skills = [
    { id: 1, name: "Behavioral", icon: MessageSquare, color: "text-blue-600" },
    { id: 2, name: "Technical", icon: Code, color: "text-green-600" },
    { id: 3, name: "Communication", icon: Presentation, color: "text-purple-600" },
    { id: 4, name: "Problem Solving", icon: Target, color: "text-orange-600" },
    { id: 5, name: "Design", icon: PenTool, color: "text-pink-600" },
    { id: 6, name: "Leadership", icon: TrendingUp, color: "text-indigo-600" },
  ];

  const recentReports = [
    { id: 1, title: "Full Technical Interview", date: "2 days ago", score: 85 },
    { id: 2, title: "Behavioral Questions", date: "5 days ago", score: 92 },
    { id: 3, title: "One-Question Drill: STAR", date: "1 week ago", score: 78 },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Greeting & KPI */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">You've answered 47 questions this month</p>
        </div>

        {/* Stage 1: Portfolio & Resume Analysis */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Stage 1: Prepare Your Materials</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 border border-border shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Portfolio Analysis</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get AI-powered feedback on your portfolio structure and presentation
                  </p>
                  <Link to="/resume">
                    <Button variant="outline" size="sm">
                      Analyze Portfolio
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="p-6 border border-border shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Resume Analysis</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your resume for keyword optimization and formatting tips
                  </p>
                  <Link to="/resume">
                    <Button variant="outline" size="sm">
                      Upload Resume
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Reports</h2>
            <Link to="/reports">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {recentReports.map((report) => (
              <Card key={report.id} className="p-4 border border-border shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{report.title}</h3>
                    <p className="text-sm text-muted-foreground">{report.date}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{report.score}</div>
                      <div className="text-xs text-muted-foreground">Score</div>
                    </div>
                    <Link to={`/reports/${report.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Stage 2: Interview Prep */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Stage 2: Screening Interview Prep</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card className="p-6 border border-border shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#FF6B3520" }}>
                  <Brain className="w-6 h-6" style={{ color: "#FF6B35" }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">Understand your working style</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Take the Ignitz CognitiveFit™ Assessment to discover your personality insights and working style preferences.
                  </p>
                  <Link to="/self-insight">
                    <Button variant="outline" size="sm" style={{ borderColor: "#FF6B35", color: "#FF6B35" }}>
                      Start Assessment
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Stage 2: Skill-Based Practice */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Practice by Skill</h2>
            <Link to="/interview/configure">
              <Button>Start Full Interview</Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {skills.map((skill) => {
              const Icon = skill.icon;
              return (
                <Card key={skill.id} className="p-6 border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className={`w-5 h-5 ${skill.color}`} />
                    <h3 className="font-semibold">{skill.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Practice focused drills to improve your {skill.name.toLowerCase()} skills
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    Start Drill
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
