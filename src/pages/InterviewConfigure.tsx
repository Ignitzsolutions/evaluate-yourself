import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const InterviewConfigure = () => {
  const navigate = useNavigate();
  const [audioEnabled, setAudioEnabled] = useState(true);

  const handleStartInterview = () => {
    navigate("/interview/session");
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Configure Your Interview</h1>
          <p className="text-muted-foreground">Set up your practice session preferences</p>
        </div>

        <Card className="p-8 border border-border shadow-sm">
          <div className="space-y-6">
            {/* Interview Type */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Interview Type</Label>
              <Select defaultValue="mixed">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interview Mode */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Interview Mode</Label>
              <Select defaultValue="full">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Interview (5-8 questions)</SelectItem>
                  <SelectItem value="drill">One-Question Drill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discipline */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Discipline</Label>
              <Select defaultValue="engineering">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineering">Software Engineering</SelectItem>
                  <SelectItem value="design">Product Design</SelectItem>
                  <SelectItem value="product">Product Management</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Description (Optional) */}
            <div>
              <Label className="text-base font-semibold mb-2 block">
                Job Description (Optional)
              </Label>
              <Textarea
                placeholder="Paste the job description to tailor interview questions..."
                className="min-h-[120px]"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Providing a JD helps generate more relevant questions
              </p>
            </div>

            {/* Audio Settings */}
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Voice Interview</Label>
                  <p className="text-sm text-muted-foreground">Enable voice-based interaction</p>
                </div>
                <Switch checked={audioEnabled} onCheckedChange={setAudioEnabled} />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-xs">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Gaze tracking is enabled</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Camera-based non-verbal analysis is included in all interviews for comprehensive feedback
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <Button onClick={handleStartInterview} className="flex-1" size="lg">
                Start Interview
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")} size="lg">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default InterviewConfigure;
