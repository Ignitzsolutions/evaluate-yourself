import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePersonalityInsights } from "@/hooks/usePersonalityInsights";
import { ArrowLeft, Download } from "lucide-react";

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

const PersonalityReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getReport, updateReflections, downloadPDF, loading, error } = usePersonalityInsights();
  const [report, setReport] = useState<PersonalityReport | null>(null);
  const [strengths, setStrengths] = useState("");
  const [development, setDevelopment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadReport = async () => {
      if (!id) return;
      try {
        const data = await getReport(id);
        setReport(data);
        setStrengths(data.reflections.strengths || "");
        setDevelopment(data.reflections.development || "");
      } catch (err) {
        console.error("Failed to load report:", err);
      }
    };
    loadReport();
  }, [id, getReport]);

  const handleSaveReflections = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateReflections(id, strengths, development);
      alert("Reflections saved successfully!");
    } catch (err) {
      console.error("Failed to save reflections:", err);
      alert("Failed to save reflections. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!id) return;
    try {
      await downloadPDF(id);
    } catch (err) {
      console.error("Failed to download PDF:", err);
      alert("Failed to download PDF. Please try again.");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "HIGH":
        return "bg-green-100 text-green-800";
      case "LOW":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading && !report) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-muted-foreground">Loading report...</p>
        </div>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-6 border-red-200 bg-red-50">
            <p className="text-red-800">{error || "Report not found"}</p>
            <Button
              variant="outline"
              onClick={() => navigate("/self-insight/reports")}
              className="mt-4"
            >
              Back to Reports
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  // Group traits by domain
  const traitsByDomain: Record<string, typeof report.trait_scores> = {};
  report.trait_scores.forEach((ts) => {
    if (!traitsByDomain[ts.domain]) {
      traitsByDomain[ts.domain] = [];
    }
    traitsByDomain[ts.domain].push(ts);
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/self-insight/reports")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>

          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Avenir, sans-serif", color: "#FF6B35" }}>
                {report.title}
              </h1>
              <p className="text-muted-foreground">Generated on {formatDate(report.created_at)}</p>
            </div>
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* Intro Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3" style={{ color: "#FF6B35" }}>
            Understanding this report
          </h2>
          <p className="text-muted-foreground">
            This report provides insights into your working style based on your responses to the personality assessment.
            It is not a pass/fail test, but rather a tool for self-reflection and understanding. Use these insights to
            better understand your strengths, development areas, and how you might adapt your work style.
          </p>
        </Card>

        {/* Your Personality */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF6B35" }}>
            Your Personality
          </h2>
          <div className="space-y-6">
            {Object.entries(traitsByDomain).map(([domain, traits]) => (
              <div key={domain}>
                <h3 className="text-lg font-medium mb-3">
                  {domain.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </h3>
                <div className="space-y-2">
                  {traits.map((ts) => (
                    <div key={ts.trait} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{ts.trait.replace("_", " ")}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (Score: {ts.score.toFixed(2)}/5.0)
                        </span>
                      </div>
                      <Badge className={getLevelColor(ts.level)}>{ts.level}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Your Development */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF6B35" }}>
            Your Development
          </h2>
          <div className="space-y-4">
            {report.development_areas.map((area, index) => (
              <div key={index}>
                <h3 className="font-medium mb-2">{area.trait.replace("_", " ")}</h3>
                <p className="text-sm text-muted-foreground mb-2">{area.description}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {area.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-muted-foreground">{suggestion}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        {/* Career Choices */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF6B35" }}>
            Your Career Choices
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">You may thrive in roles where:</h3>
              <ul className="space-y-2">
                {report.career_fit_thrives.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start">
                    <span className="mr-2">•</span>
                    <span>{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-3">You may need to work harder when:</h3>
              <ul className="space-y-2">
                {report.career_fit_challenges.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start">
                    <span className="mr-2">•</span>
                    <span>{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* Adapting Your Work Style */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF6B35" }}>
            Adapting Your Work Style
          </h2>
          <div className="space-y-4">
            {report.work_style_tips.map((tip, index) => (
              <div key={index}>
                <h3 className="font-medium mb-2">{tip.title}</h3>
                <p className="text-sm text-muted-foreground">{tip.description}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Your Reflections */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: "#FF6B35" }}>
            Your Reflections
          </h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="strengths" className="mb-2 block">
                My key strengths
              </Label>
              <Textarea
                id="strengths"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="Reflect on your key strengths based on this assessment..."
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="development" className="mb-2 block">
                My development priorities
              </Label>
              <Textarea
                id="development"
                value={development}
                onChange={(e) => setDevelopment(e.target.value)}
                placeholder="Reflect on areas you'd like to develop..."
                className="min-h-[100px]"
              />
            </div>
            <Button
              onClick={handleSaveReflections}
              disabled={saving}
              style={{ backgroundColor: "#FF6B35" }}
            >
              {saving ? "Saving..." : "Save Reflections"}
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default PersonalityReportDetail;

