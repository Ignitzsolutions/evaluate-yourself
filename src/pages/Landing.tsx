import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { 
  MessageSquare, Mic, Eye, BarChart3, FileCheck, Target, 
  Clock, DollarSign, HelpCircle, TrendingUp, Users, 
  CheckCircle, ArrowRight, ChevronRight, Play, User
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Landing = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  const handleProtectedAction = (path: string) => {
    if (!isLoaded) {
      // Wait for Clerk to load, then redirect
      navigate("/sign-in");
      return;
    }
    if (isSignedIn) {
      navigate(path);
    } else {
      // Store intended destination and redirect to sign-in
      navigate(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-18">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img 
                src="/logo.png" 
                alt="Evaluate Yourself" 
                className="h-14 w-auto"
              />
            </Link>
            
            <div className="flex items-center gap-4">
              <Link to="/sign-in">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/sign-up">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* PAGE 1 - THE PROBLEM */}
      
      {/* Hero Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl font-bold text-primary mb-6 leading-tight">
              Interview-Ready. Anytime. Anywhere.
            </h1>
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-primary rounded-lg">
                <span className="text-sm text-gray-700 font-medium">Backed by</span>
                <img 
                  src="/microsoft-startups-logo.png" 
                  alt="Microsoft for Startups" 
                  className="h-6 w-auto"
                />
              </div>
            </div>
            <p className="text-2xl text-muted-foreground mb-10 leading-relaxed">
              The first AI-powered mock interview platform that prepares you like a real hiring panel — 
              voice, gaze, behavior, and personalized analytics.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                size="lg" 
                className="text-lg px-8 h-14"
                onClick={() => handleProtectedAction("/dashboard")}
              >
                Start Practicing
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 h-14"
                onClick={() => handleProtectedAction("/reports")}
              >
                View Demo Report
              </Button>
            </div>
          </div>

          {/* Hero Visual - Complete Interview Experience */}
          <div className="mt-16 max-w-6xl mx-auto">
            <Card className="p-8 border-2 border-border shadow-2xl bg-card relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
              
              <div className="relative z-10 grid md:grid-cols-2 gap-8">
                {/* Left Side - Interview Scene */}
                <div className="space-y-6">
                  {/* AI Interviewer */}
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/30 flex items-center justify-center flex-shrink-0 animate-pulse">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">AI Interviewer</p>
                      <p className="text-sm text-foreground">"Tell me about your recent project..."</p>
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1 h-6 bg-primary rounded-full animate-[bounce_1s_ease-in-out_infinite]" />
                      <span className="w-1 h-8 bg-primary rounded-full animate-[bounce_1s_ease-in-out_infinite_0.1s]" />
                      <span className="w-1 h-6 bg-primary rounded-full animate-[bounce_1s_ease-in-out_infinite_0.2s]" />
                    </div>
                  </div>

                  {/* Your Response */}
                  <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <Mic className="w-8 h-8 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Your Response</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Live Transcript */}
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">LIVE TRANSCRIPT</p>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      "I recently led a team of five engineers to develop a real-time analytics dashboard..."
                    </p>
                  </div>
                </div>

                {/* Right Side - Analytics & Metrics */}
                <div className="space-y-6">
                  {/* Gaze Tracking */}
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="w-4 h-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">GAZE TRACKING</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Eye Contact</span>
                          <span className="font-medium text-primary">82%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: '82%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Attention</span>
                          <span className="font-medium text-green-600">Excellent</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 rounded-full" style={{ width: '90%' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-Time Feedback */}
                  <div className="p-4 bg-card border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      <p className="text-xs font-medium text-muted-foreground">REAL-TIME ANALYSIS</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <p className="text-2xl font-bold text-primary">8.5</p>
                        <p className="text-xs text-muted-foreground">Clarity</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <p className="text-2xl font-bold text-primary">9.0</p>
                        <p className="text-xs text-muted-foreground">Structure</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <p className="text-2xl font-bold text-primary">7.8</p>
                        <p className="text-xs text-muted-foreground">Confidence</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded">
                        <p className="text-2xl font-bold text-primary">8.2</p>
                        <p className="text-xs text-muted-foreground">Relevance</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Insight */}
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium mb-1">Strong STAR structure</p>
                        <p className="text-xs text-muted-foreground">Your response clearly outlines Situation, Task, Action, and Result.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Status Bar */}
              <div className="mt-6 pt-6 border-t border-border relative z-10">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Question 3 of 5</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                      <span>Recording</span>
                    </div>
                    <div className="text-muted-foreground">12:34 elapsed</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The Problem Candidates Face</h2>
            <p className="text-xl text-muted-foreground">Why interview preparation is broken</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <HelpCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Interviews are unpredictable</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Hiring panels vary dramatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Style, pace, difficulty shift per company</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>You don't know what to expect</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Real practice is expensive</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Mock interview coaches = ₹6,000–₹12,000/session</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Limited availability</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>No long-term progress tracking</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Feedback is vague</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>"Improve communication" is not actionable</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>No breakdown of structure or clarity</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Zero non-verbal performance insights</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Traditional Methods Fail */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Traditional Methods Fail</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-card border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Method</th>
                  <th className="px-6 py-4 text-left font-semibold">Pros</th>
                  <th className="px-6 py-4 text-left font-semibold">Cons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 font-medium">YouTube Prep</td>
                  <td className="px-6 py-4 text-muted-foreground">Easy to access</td>
                  <td className="px-6 py-4 text-muted-foreground">Not personalized to your profile or job</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">ChatGPT Q&A</td>
                  <td className="px-6 py-4 text-muted-foreground">Fast responses</td>
                  <td className="px-6 py-4 text-muted-foreground">No voice, no non-verbal feedback</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Friends Mocking</td>
                  <td className="px-6 py-4 text-muted-foreground">Helpful and free</td>
                  <td className="px-6 py-4 text-muted-foreground">Not structured, inconsistent feedback</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Interview Coaches</td>
                  <td className="px-6 py-4 text-muted-foreground">High quality</td>
                  <td className="px-6 py-4 text-muted-foreground">Expensive, hard to book, slow iterations</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Card className="mt-12 p-8 border-2 border-primary/20 bg-primary/5">
            <p className="text-xl text-center font-medium">
              Candidates need structured, data-driven, repeatable interview practice — not random guessing.
            </p>
          </Card>
        </div>
      </section>

      {/* PAGE 2 - THE SOLUTION */}
      
      {/* Introducing Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-primary mb-6">Introducing Evaluate-Yourself</h2>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto">
              A complete, private, AI-powered interview room built to help you improve fast.
            </p>
          </div>

          <Card className="p-8 border-2 border-border shadow-2xl max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Play className="w-16 h-16 text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Product Demo</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <span>Real-time voice interactions</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <span>Gaze tracking metrics</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <span>Live transcription</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <span>Comprehensive feedback</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Core Features */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Core Features</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 border border-border shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Mic className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Real-Time Voice Interviews</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Powered by Azure Realtime</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Natural interviewer personality</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Repeat / rephrase requests available</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Designed to feel like Google, Meta, Amazon rounds</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border border-border shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Gaze & Non-Verbal Intelligence</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Eye contact percentage tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Blink rate analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Focus consistency monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>"On-screen presence score"</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border border-border shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">AI Behavioral & Technical Feedback</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>STAR/CAR methodology breakdown</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Clarity + confidence + structure scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Identify strengths and blind spots</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Personalized improvement actions</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border border-border shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <FileCheck className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Resume + Portfolio Diagnostics</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>ATS keyword matching</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Structure and clarity scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Achievement-focused suggestions</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                  <span>Portfolio storytelling guidance</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">Three simple steps to interview mastery</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Pick Your Interview Style</h3>
              <p className="text-muted-foreground">
                Behavioral / Technical / Mixed. Choose between one-question drills or full structured interviews.
              </p>
            </Card>

            <Card className="p-8 text-center border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Practice with Real-Time AI</h3>
              <p className="text-muted-foreground">
                Speak or type. AI listens, asks follow-ups, and adapts to your responses in real-time.
              </p>
            </Card>

            <Card className="p-8 text-center border border-border shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Get a Professional Report</h3>
              <p className="text-muted-foreground">
                Receive multi-section insights: interview score, question-level analysis, gaze data, and improvement roadmap.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* PAGE 3 - PROOF & VALUE */}
      
      {/* Who Is This For */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Who Is This For?</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border border-border shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Early-Career Students</h3>
              <p className="text-sm text-muted-foreground">
                Learn communication fundamentals and build confidence.
              </p>
            </Card>

            <Card className="p-6 border border-border shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Working Professionals</h3>
              <p className="text-sm text-muted-foreground">
                Practice senior-level leadership and strategic communication.
              </p>
            </Card>

            <Card className="p-6 border border-border shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Career Switchers</h3>
              <p className="text-sm text-muted-foreground">
                Translate your old experience into new domain language.
              </p>
            </Card>

            <Card className="p-6 border border-border shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Job Seekers Worldwide</h3>
              <p className="text-sm text-muted-foreground">
                A private, judgment-free environment — anytime, anywhere.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Real Outcomes */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Real Outcomes</h2>
            <p className="text-xl text-muted-foreground">Measurable improvement in just a few sessions</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center border-2 border-primary/20 shadow-sm">
              <div className="text-5xl font-bold text-primary mb-2">60-80%</div>
              <p className="text-muted-foreground">Improvement in clarity after 3 sessions</p>
            </Card>

            <Card className="p-6 text-center border-2 border-primary/20 shadow-sm">
              <div className="text-5xl font-bold text-primary mb-2">40%</div>
              <p className="text-muted-foreground">Better eye contact consistency</p>
            </Card>

            <Card className="p-6 text-center border-2 border-primary/20 shadow-sm">
              <div className="text-5xl font-bold text-primary mb-2">4×</div>
              <p className="text-muted-foreground">More confidence before final interviews</p>
            </Card>

            <Card className="p-6 text-center border-2 border-primary/20 shadow-sm">
              <div className="text-5xl font-bold text-primary mb-2">2-3×</div>
              <p className="text-muted-foreground">Faster prep vs traditional methods</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Use Cases</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border border-border shadow-sm">
              <h3 className="text-2xl font-semibold mb-4">Interview Prep</h3>
              <p className="text-muted-foreground mb-6">
                Train for Google, Microsoft, Amazon, or startups with realistic mock interviews.
              </p>
              <Button variant="outline" className="w-full">Learn More</Button>
            </Card>

            <Card className="p-8 border border-border shadow-sm">
              <h3 className="text-2xl font-semibold mb-4">Career Planning</h3>
              <p className="text-muted-foreground mb-6">
                Understand your behavioral strengths and blind spots for long-term growth.
              </p>
              <Button variant="outline" className="w-full">Learn More</Button>
            </Card>

            <Card className="p-8 border border-border shadow-sm">
              <h3 className="text-2xl font-semibold mb-4">Communication Mastery</h3>
              <p className="text-muted-foreground mb-6">
                Improve clarity, conciseness, and confidence in professional settings.
              </p>
              <Button variant="outline" className="w-full">Learn More</Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-8 border border-border shadow-sm">
              <h3 className="text-2xl font-semibold mb-2">Free Tier</h3>
              <div className="text-4xl font-bold text-primary mb-6">₹0</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>1 one-question interview per day</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Basic feedback</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full">Get Started</Button>
            </Card>

            <Card className="p-8 border-2 border-primary shadow-lg relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Recommended
              </div>
              <h3 className="text-2xl font-semibold mb-2">Pro</h3>
              <div className="text-4xl font-bold text-primary mb-6">Contact Sales</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Unlimited interviews</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Full detailed reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Gaze analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Resume/Portfolio analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Career recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Priority improvements</span>
                </li>
              </ul>
              <Button className="w-full">Upgrade to Pro</Button>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                How accurate is AI feedback?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Our AI is trained on thousands of real interviews and uses advanced NLP to analyze your responses. 
                It provides structured feedback based on proven frameworks like STAR/CAR methodology.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Do you record video?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We use your camera only for gaze tracking analysis. Video is processed in real-time and not stored. 
                Only anonymized metrics (eye contact %, attention) are saved.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Is my data private?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. All your interview data is encrypted and private to you. We never share your responses or 
                personal information with third parties.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                Can I practice in different languages?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Currently, we support English, Spanish, French, and German. More languages are being added based on user demand.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card border border-border rounded-lg px-6">
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                How does gaze tracking work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                We use computer vision to analyze where you're looking during the interview. This helps measure 
                eye contact consistency, attention levels, and engagement — all critical non-verbal cues in interviews.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6 leading-tight">
            Become interview-ready.
          </h2>
          <p className="text-2xl text-muted-foreground mb-10">
            Start your first AI interview in minutes.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="text-lg px-8 h-14"
              onClick={() => handleProtectedAction("/dashboard")}
            >
              Start Practicing
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 h-14"
              onClick={() => handleProtectedAction("/reports")}
            >
              See Sample Report
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">
              Product by <span className="font-semibold text-foreground">Ignitz Solutions Private Limited</span>
            </p>
            <p className="text-sm">
              © {new Date().getFullYear()} Ignitz Solutions Private Limited. All rights reserved. Registered trademark.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
