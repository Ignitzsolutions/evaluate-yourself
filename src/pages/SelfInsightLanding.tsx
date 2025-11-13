import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Brain, FileText, ArrowRight } from "lucide-react";

const SelfInsightLanding = () => {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "Avenir, sans-serif", color: "#FF6B35" }}>
            Personality Insights
          </h1>
          <div className="space-y-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            <p>
              This is a reflection tool about your working style. It helps you understand how you approach work,
              communicate with others, handle pressure, and adapt to change.
            </p>
            <p>
              It is not a pass/fail test. Instead, it provides personalized insights to help you recognize your
              strengths, identify areas for growth, and discover work environments where you may thrive.
            </p>
            <p className="text-base">
              Use these insights to better understand yourself and adapt your work style for greater effectiveness
              and satisfaction.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 border border-border shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#FF6B3520" }}>
                <Brain className="w-6 h-6" style={{ color: "#FF6B35" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Start Assessment</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Answer 48 questions about your working style and preferences. The assessment takes about 10-15 minutes.
                </p>
                <Link to="/self-insight/assessment">
                  <Button className="w-full" style={{ backgroundColor: "#FF6B35" }}>
                    Start Personality Assessment
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#FF6B3520" }}>
                <FileText className="w-6 h-6" style={{ color: "#FF6B35" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">View Reports</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Access your past personality assessment reports and track your insights over time.
                </p>
                <Link to="/self-insight/reports">
                  <Button variant="outline" className="w-full">
                    View My Reports
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SelfInsightLanding;

