import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, User, AlertCircle } from "lucide-react";
import { useOpenAIRealtime } from "@/hooks/useOpenAIRealtime";
import { useGazeTracking } from "@/hooks/useGazeTracking";
import { useNavigate } from "react-router-dom";

const InterviewSession = () => {
  const navigate = useNavigate();
  const [isVideoActive, setIsVideoActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const { session, isLoading, connect, disconnect } = useOpenAIRealtime();
  const { metrics: gazeMetrics } = useGazeTracking(videoRef.current, isVideoActive && session.isConnected);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [connect, disconnect]);

  const toggleVideo = async () => {
    if (!isVideoActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsVideoActive(true);
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
      }
    } else {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsVideoActive(false);
    }
  };

  const handleEndInterview = () => {
    disconnect();
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate("/reports");
  };

  const progress = session.totalQuestions > 0 
    ? (session.questionNumber / session.totalQuestions) * 100 
    : 0;

  const attentionColor = gazeMetrics.attention === "Good" 
    ? "text-green-600" 
    : gazeMetrics.attention === "Fair" 
    ? "text-yellow-600" 
    : "text-red-600";

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold">Technical Interview</h2>
                <p className="text-sm text-muted-foreground">
                  {session.questionNumber > 0 
                    ? `Question ${session.questionNumber} of ${session.totalQuestions}`
                    : "Connecting..."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleEndInterview}>
                End Interview
              </Button>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-black/95">
          <div className="h-full relative">
            <div className="h-full flex items-center justify-center relative">
              <div className="flex flex-col items-center gap-6">
                <div className={`w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border-4 flex items-center justify-center ${
                  session.isInterviewerSpeaking ? 'border-primary animate-pulse' : 'border-primary/30'
                }`}>
                  <User className="w-24 h-24 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-white text-xl font-medium mb-1">AI Interviewer</p>
                  {session.isInterviewerSpeaking && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-sm">Speaking...</span>
                    </div>
                  )}
                  {!session.isConnected && isLoading && (
                    <p className="text-sm text-muted-foreground">Connecting...</p>
                  )}
                  {session.error && (
                    <div className="flex flex-col items-center gap-2 text-red-500 text-sm mt-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>{session.error}</span>
                      </div>
                      {session.error.includes("permission") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            connect();
                          }}
                          className="mt-2"
                        >
                          Retry with Microphone
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isVideoActive && (
                <div className="absolute top-6 right-6 w-64">
                  <Card className="border border-border/50 shadow-lg overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-xs">
                        You
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {session.currentQuestion && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-20 pb-6 px-8">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                      <p className="text-white text-xl leading-relaxed">
                        {session.currentQuestion}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-6 left-6 flex gap-3">
                <Button
                  size="icon"
                  variant={session.isConnected ? "default" : "secondary"}
                  onClick={() => {
                    if (!session.isConnected) connect();
                  }}
                  className="h-12 w-12 rounded-full"
                  title="Toggle microphone"
                  disabled={isLoading}
                >
                  {session.isConnected ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
                <Button
                  size="icon"
                  variant={isVideoActive ? "default" : "secondary"}
                  onClick={toggleVideo}
                  className="h-12 w-12 rounded-full"
                  title="Toggle camera"
                >
                  {isVideoActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </div>

              {isVideoActive && session.isConnected && (
                <div className="absolute top-6 left-6">
                  <Card className="border border-border/50 shadow-lg bg-background/95 backdrop-blur-sm p-4">
                    <h3 className="font-semibold text-sm mb-3">Gaze Tracking</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Eye Contact</span>
                        <span className="font-medium">{gazeMetrics.eyeContact}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Attention</span>
                        <span className={`font-medium ${attentionColor}`}>{gazeMetrics.attention}</span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {session.messages.length > 0 && (
                <div className="absolute top-6 right-6 w-80 max-h-96 overflow-y-auto bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-3 text-sm">Conversation</h3>
                  <div className="space-y-3">
                    {session.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`text-sm ${
                          msg.type === "interviewer" ? "text-blue-300" : "text-green-300"
                        }`}
                      >
                        <div className="font-medium mb-1">
                          {msg.type === "interviewer" ? "Interviewer" : "You"}
                        </div>
                        <div className="text-white/80">{msg.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default InterviewSession;
