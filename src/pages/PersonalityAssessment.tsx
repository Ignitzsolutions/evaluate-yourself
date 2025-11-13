import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { usePersonalityInsights } from "@/hooks/usePersonalityInsights";
import { PERSONALITY_QUESTIONS } from "@/data/personalityQuestions";
import { ArrowLeft, ArrowRight } from "lucide-react";

const QUESTIONS_PER_PAGE = 12;

const PersonalityAssessment = () => {
  const navigate = useNavigate();
  const { createAssessment, loading, error } = usePersonalityInsights();
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const totalPages = Math.ceil(PERSONALITY_QUESTIONS.length / QUESTIONS_PER_PAGE);
  const currentQuestions = PERSONALITY_QUESTIONS.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );
  const progress = ((currentPage + 1) / totalPages) * 100;
  const answeredCount = Object.keys(answers).length;
  const currentPageAnswered = currentQuestions.every((q) => answers[q.id] !== undefined);

  const handleAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (answeredCount < PERSONALITY_QUESTIONS.length) {
      alert("Please answer all questions before submitting.");
      return;
    }

    try {
      const answersArray = PERSONALITY_QUESTIONS.map((q) => ({
        questionId: q.id,
        value: answers[q.id],
      }));

      const reportId = await createAssessment(answersArray);
      navigate(`/self-insight/reports/${reportId}`);
    } catch (err) {
      console.error("Failed to submit assessment:", err);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/self-insight")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Personality Insights
          </Button>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Page {currentPage + 1} of {totalPages}
              </span>
              <span className="text-sm text-muted-foreground">
                {answeredCount} of {PERSONALITY_QUESTIONS.length} questions answered
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {error && (
          <Card className="p-4 mb-6 border-red-200 bg-red-50">
            <p className="text-sm text-red-800">{error}</p>
          </Card>
        )}

        <Card className="p-6 mb-6">
          <div className="space-y-8">
            {currentQuestions.map((question, index) => (
              <div key={question.id} className="space-y-3">
                <Label className="text-base font-medium">
                  {currentPage * QUESTIONS_PER_PAGE + index + 1}. {question.text}
                </Label>
                <RadioGroup
                  value={answers[question.id]?.toString()}
                  onValueChange={(value) => handleAnswer(question.id, parseInt(value))}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id={`${question.id}-1`} />
                    <Label htmlFor={`${question.id}-1`} className="font-normal cursor-pointer">
                      Strongly Disagree
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id={`${question.id}-2`} />
                    <Label htmlFor={`${question.id}-2`} className="font-normal cursor-pointer">
                      Disagree
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id={`${question.id}-3`} />
                    <Label htmlFor={`${question.id}-3`} className="font-normal cursor-pointer">
                      Neutral
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="4" id={`${question.id}-4`} />
                    <Label htmlFor={`${question.id}-4`} className="font-normal cursor-pointer">
                      Agree
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="5" id={`${question.id}-5`} />
                    <Label htmlFor={`${question.id}-5`} className="font-normal cursor-pointer">
                      Strongly Agree
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentPage === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentPage === totalPages - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!currentPageAnswered || loading}
              style={{ backgroundColor: "#FF6B35" }}
            >
              {loading ? "Submitting..." : "Submit Assessment"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!currentPageAnswered}
              style={{ backgroundColor: "#FF6B35" }}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PersonalityAssessment;

