import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";

const Resume = () => {
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const mockAnalysis = {
    strengths: [
      "Strong action verbs used throughout",
      "Quantifiable achievements highlighted",
      "Clear section organization",
      "Relevant technical skills listed",
    ],
    improvements: [
      "Add more specific metrics to your project descriptions",
      "Include keywords from the target job description",
      "Expand on leadership experience",
      "Consider adding a professional summary",
    ],
    keywords: {
      present: ["React", "TypeScript", "API", "Agile", "Team collaboration"],
      missing: ["CI/CD", "Cloud computing", "Microservices", "Docker"],
    },
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Resume & Portfolio Analysis</h1>
          <p className="text-muted-foreground">
            Get AI-powered feedback to optimize your application materials
          </p>
        </div>

        <Tabs defaultValue="resume" className="space-y-6">
          <TabsList>
            <TabsTrigger value="resume">Resume Analysis</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio Review</TabsTrigger>
          </TabsList>

          <TabsContent value="resume" className="space-y-6">
            {/* Upload Section */}
            <Card className="p-8 border border-border shadow-sm">
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-4">Upload Your Resume</h2>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-foreground mb-2">
                      Drop your resume here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">PDF format, max 5MB</p>
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-4">
                    Job Description (Optional)
                  </h2>
                  <Textarea
                    placeholder="Paste the job description to get targeted keyword suggestions..."
                    className="min-h-[160px]"
                  />
                  <Button className="mt-4 w-full" onClick={() => setAnalysisComplete(true)}>
                    Analyze Resume
                  </Button>
                </div>
              </div>
            </Card>

            {/* Analysis Results */}
            {analysisComplete && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <Card className="p-6 border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <h3 className="text-xl font-semibold">Strengths</h3>
                    </div>
                    <ul className="space-y-2">
                      {mockAnalysis.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          <span className="text-sm text-foreground">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  {/* Areas for Improvement */}
                  <Card className="p-6 border border-border shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-6 h-6 text-primary" />
                      <h3 className="text-xl font-semibold">Areas for Improvement</h3>
                    </div>
                    <ul className="space-y-2">
                      {mockAnalysis.improvements.map((improvement, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm text-foreground">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                {/* Keyword Analysis */}
                <Card className="p-6 border border-border shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-semibold">Keyword Analysis</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">
                        Present Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {mockAnalysis.keywords.present.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-3">
                        Missing Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {mockAnalysis.keywords.missing.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-orange-100 text-primary rounded-full text-sm"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="portfolio">
            <Card className="p-8 border border-border shadow-sm">
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Portfolio Review</h3>
                <p className="text-muted-foreground mb-6">
                  Coming soon: Upload your portfolio or provide a URL for comprehensive feedback
                </p>
                <Button disabled>Upload Portfolio</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Resume;
