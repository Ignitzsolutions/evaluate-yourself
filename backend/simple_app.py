"""
Conversational AI Interviewer Backend (Simplified)
FastAPI server with conversational interview logic
No external dependencies beyond OpenAI and FastAPI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
import openai
import os
from azure.identity import (
    CredentialUnavailableError,
    DefaultAzureCredential
)

# Initialize FastAPI app
app = FastAPI(title="AI Conversational Interviewer", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-key-here")
openai.api_key = OPENAI_API_KEY

# Session storage
sessions: Dict[str, dict] = {}
azure_credential: Optional[DefaultAzureCredential] = None

# Interview question sets by type
INTERVIEW_CONTEXTS = {
    "technical": {
        "description": "Technical interview focusing on programming concepts and problem-solving",
        "topics": ["JavaScript/Python fundamentals", "Data structures", "Algorithms", "System design", "Best practices"],
        "intro": "Welcome to your technical interview! I'll be asking you about programming concepts, problem-solving approaches, and technical best practices.",
        "sample_questions": [
            "Can you explain how closures work in JavaScript?",
            "What's the difference between a stack and a queue?",
            "How would you optimize a slow database query?",
            "Describe the principles of object-oriented programming.",
            "What's your approach to debugging complex issues?"
        ]
    },
    "behavioral": {
        "description": "Behavioral interview focusing on soft skills and experience",
        "topics": ["Leadership", "Problem-solving", "Communication", "Teamwork", "Adaptability"],
        "intro": "Welcome to your behavioral interview! I'll be asking you about your experiences, how you handle challenges, and your approach to teamwork.",
        "sample_questions": [
            "Tell me about a challenging project you led.",
            "How do you handle tight deadlines?",
            "Describe a time you had to resolve a conflict.",
            "What motivates you in your work?",
            "How do you stay updated with industry trends?"
        ]
    },
    "mixed": {
        "description": "Mixed interview combining technical and behavioral questions",
        "topics": ["Technical skills", "Problem-solving", "Communication", "Experience", "Growth mindset"],
        "intro": "Welcome to your comprehensive interview! I'll be asking you both technical questions and behavioral questions to get a complete picture of your skills.",
        "sample_questions": [
            "Walk me through how you approach learning new technologies.",
            "Describe a technical challenge you overcame recently.",
            "How do you balance code quality with delivery speed?",
            "Tell me about a time you mentored someone.",
            "What's your process for code reviews?"
        ]
    }
}

AZURE_REALTIME_SCOPE = os.getenv(
    "AZURE_REALTIME_SCOPE",
    "https://gpt-interactive-talk.services.ai.azure.com/.default"
)


def get_azure_credential() -> DefaultAzureCredential:
    global azure_credential
    if azure_credential is None:
        azure_credential = DefaultAzureCredential()
    return azure_credential

class InterviewSession:
    def __init__(self, session_id: str, interview_type: str):
        self.session_id = session_id
        self.interview_type = interview_type
        self.context = INTERVIEW_CONTEXTS[interview_type]
        self.conversation_history = []
        self.current_phase = "introduction"  # "introduction", "questioning", "evaluation", "conclusion"
        self.question_count = 0
        self.max_questions = 5
        self.aggregate_scores = {}
        self.is_complete = False
        
        # Real-time session metrics - initialized to zero
        self.start_time = datetime.now()
        self.duration_seconds = 0
        self.questions_answered = 0
        self.total_words = 0
        self.eye_contact_score = 0  # Placeholder for future eye tracking integration
        self.evaluation_details = []
        
    def get_ai_introduction(self):
        """Generate the opening message"""
        intro_message = f"Hello! I'm your AI interviewer today. {self.context['intro']} This will be a conversational interview - feel free to ask for clarification if needed.\n\nLet's start: Can you briefly introduce yourself and tell me what interests you most about this field?"
        
        self.conversation_history.append({
            "speaker": "ai",
            "message": intro_message,
            "timestamp": datetime.now().isoformat(),
            "phase": "introduction"
        })
        
        self.current_phase = "questioning"
        return intro_message
    
    def process_user_response(self, user_message: str):
        """Process user response and generate AI follow-up"""
        
        # Update real-time metrics
        self.duration_seconds = int((datetime.now() - self.start_time).total_seconds())
        self.total_words += len(user_message.split())
        
        # Log user message
        self.conversation_history.append({
            "speaker": "user",
            "message": user_message,
            "timestamp": datetime.now().isoformat(),
            "evaluation": None,
            "word_count": len(user_message.split())
        })
        
        # Evaluate the response
        evaluation = self.evaluate_response(user_message)
        
        # Update the last user message with evaluation
        if self.conversation_history:
            self.conversation_history[-1]["evaluation"] = evaluation
            
        # Store detailed evaluation
        self.evaluation_details.append({
            "question_number": self.question_count + 1,
            "response": user_message,
            "word_count": len(user_message.split()),
            "evaluation": evaluation,
            "timestamp": datetime.now().isoformat()
        })
        
        # Generate AI response
        ai_response = self.generate_ai_response(user_message, evaluation)
        
        # Log AI response
        self.conversation_history.append({
            "speaker": "ai",
            "message": ai_response,
            "timestamp": datetime.now().isoformat(),
            "phase": self.current_phase
        })
        
        # Update question count and tracking
        if self.current_phase == "questioning":
            self.question_count += 1
            self.questions_answered += 1  # Track actual answered questions
            
        # Update eye contact score (placeholder - increment slightly for engagement)
        if len(user_message.split()) > 10:  # Longer responses suggest engagement
            self.eye_contact_score = min(100, self.eye_contact_score + 15)
        else:
            self.eye_contact_score = min(100, self.eye_contact_score + 5)
            
        if self.question_count >= self.max_questions:
            self.current_phase = "conclusion"
            self.is_complete = True
            # Final duration update
            self.duration_seconds = int((datetime.now() - self.start_time).total_seconds())
            
        return {
            "ai_message": ai_response,
            "evaluation": evaluation,
            "is_complete": self.is_complete,
            "session_metrics": {
                "duration_seconds": self.duration_seconds,
                "questions_answered": self.questions_answered,
                "total_words": self.total_words,
                "eye_contact_score": self.eye_contact_score
            }
        }
    
    def evaluate_response(self, user_message: str):
        """Evaluate user response using simple heuristics and optionally OpenAI"""
        
        try:
            # Use OpenAI for intelligent evaluation if API key is available
            evaluation_prompt = f"""You are an expert {self.interview_type} interviewer evaluator. 

Evaluate this candidate response on a scale of 1-100 for each criterion:

Question context: {self.interview_type} interview, question #{self.question_count + 1}
Interview type: {self.interview_type}
Candidate's response: {user_message}

Provide scores for:
1. Clarity (how clear and well-structured is the answer)
2. Confidence (does the candidate seem confident and decisive)
3. Relevance (how relevant is the answer to the question)
4. Depth (technical depth for technical questions, insight depth for behavioral)
5. Correctness (accuracy of information, logical reasoning, appropriate approach)

Also provide brief constructive feedback (2-3 sentences).

Return as JSON:
{{
  "clarity": 85,
  "confidence": 78,
  "relevance": 92,
  "depth": 80,
  "correctness": 88,
  "feedback": "Clear explanation with good examples. Could dive deeper into implementation details. Consider explaining the trade-offs of your approach."
}}"""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": evaluation_prompt}],
                max_tokens=200,
                temperature=0.3
            )
            
            evaluation_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                evaluation = json.loads(evaluation_text)
            except:
                evaluation = self.fallback_evaluation(user_message)
                
        except Exception as e:
            print(f"OpenAI evaluation failed: {e}")
            evaluation = self.fallback_evaluation(user_message)
        
        # Update aggregate scores
        self.update_aggregate_scores(evaluation)
        
        return evaluation
    
    def fallback_evaluation(self, user_message: str):
        """Simple fallback evaluation when OpenAI is not available"""
        word_count = len(user_message.split())
        
        # Basic heuristics for evaluation
        clarity_score = min(100, max(50, word_count * 2))
        confidence_score = 85 if "I think" not in user_message.lower() else 65
        relevance_score = 85 if any(keyword in user_message.lower() for keyword in ["because", "when", "how", "what", "why"]) else 70
        depth_score = min(100, max(60, word_count * 1.5))
        
        # Correctness heuristic - check for structured response and examples
        correctness_score = 75
        if any(indicator in user_message.lower() for indicator in ["for example", "such as", "specifically", "in my experience"]):
            correctness_score += 10
        if word_count > 30:  # Detailed responses tend to be more correct
            correctness_score += 10
            
        return {
            "clarity": clarity_score,
            "confidence": confidence_score,
            "relevance": relevance_score,
            "depth": depth_score,
            "correctness": min(100, correctness_score),
            "feedback": "Thank you for your response. Consider providing more specific examples and elaborating on your reasoning.",
            "question_index": self.question_count,
            "timestamp": datetime.now().isoformat()
        }
    
    def update_aggregate_scores(self, evaluation):
        """Update running aggregate scores"""
        scores = ["clarity", "confidence", "relevance", "depth", "correctness"]
        
        for score in scores:
            if score not in self.aggregate_scores:
                self.aggregate_scores[score] = []
            self.aggregate_scores[score].append(evaluation[score])
        
        # Calculate running averages
        for score in scores:
            avg_key = f"avg_{score}"
            self.aggregate_scores[avg_key] = sum(self.aggregate_scores[score]) / len(self.aggregate_scores[score])
        
        # Overall score
        avg_scores = [self.aggregate_scores.get(f"avg_{score}", 0) for score in scores]
        self.aggregate_scores["overall_score"] = sum(avg_scores) / len(avg_scores)
    
    def generate_ai_response(self, user_message: str, evaluation: dict):
        """Generate contextual AI response"""
        
        if self.current_phase == "conclusion":
            overall_score = self.aggregate_scores.get("overall_score", 0)
            return f"""Thank you for a great interview! You've shared some really valuable insights.

Based on our conversation, I can see strengths in your approach to problem-solving and communication. Your overall performance shows a score of {overall_score:.0f}%.

The interview is now complete. You'll receive a detailed report with specific feedback on each topic we discussed. Best of luck with your next steps!"""
        
        try:
            # Use OpenAI to generate contextual response
            conversation_context = ""
            recent_messages = self.conversation_history[-4:]  # Last 2 exchanges
            for msg in recent_messages:
                speaker = msg["speaker"].upper()
                conversation_context += f"{speaker}: {msg['message']}\n"
            
            prompt = f"""You are an experienced {self.interview_type} interviewer having a natural conversation.

Context: {self.interview_type} interview, question #{self.question_count + 1} of {self.max_questions}
Recent conversation:
{conversation_context}

Candidate just said: {user_message}

Generate a natural, conversational follow-up response that:
1. Acknowledges their answer positively
2. Asks a thoughtful follow-up question related to {self.interview_type} topics
3. Feels like a natural conversation flow
4. Is encouraging and professional

Response (keep it conversational, 1-2 sentences + 1 question):"""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI response generation failed: {e}")
            return self.fallback_response()
    
    def fallback_response(self):
        """Fallback response when OpenAI is not available"""
        if self.question_count < len(self.context["sample_questions"]):
            return f"That's interesting. Let me ask you this: {self.context['sample_questions'][self.question_count]}"
        else:
            return "That's a great point. Can you elaborate on that approach and explain your reasoning?"

# Pydantic models
class StartInterviewRequest(BaseModel):
    interview_type: str

class ChatRequest(BaseModel):
    session_id: str
    user_message: str

class ChatResponse(BaseModel):
    ai_message: str
    evaluation: Optional[Dict] = None
    session_state: Dict
    is_complete: bool

# API Routes
@app.post("/api/start-interview")
async def start_interview(request: StartInterviewRequest):
    """Start a new conversational interview session"""
    session_id = str(uuid.uuid4())
    interview_type = request.interview_type
    
    if interview_type not in INTERVIEW_CONTEXTS:
        raise HTTPException(status_code=400, detail="Invalid interview type")
    
    # Create new session
    session = InterviewSession(session_id, interview_type)
    ai_message = session.get_ai_introduction()
    
    # Store session
    sessions[session_id] = session
    
    return {
        "session_id": session_id,
        "ai_message": ai_message,
        "session_state": {
            "phase": session.current_phase,
            "question_count": session.question_count,
            "max_questions": session.max_questions
        },
        "is_complete": False
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle conversational chat with the AI interviewer"""
    session_id = request.session_id
    user_message = request.user_message
    
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    # Process user message
    result = session.process_user_response(user_message)
    
    return ChatResponse(
        ai_message=result["ai_message"],
        evaluation=result["evaluation"],
        session_state={
            "phase": session.current_phase,
            "question_count": session.question_count,
            "max_questions": session.max_questions,
            "aggregate_scores": session.aggregate_scores,
            "metrics": result.get("session_metrics", {})
        },
        is_complete=result["is_complete"]
    )

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Get complete session data for report generation"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    
    # Ensure final duration is calculated
    if session.is_complete:
        session.duration_seconds = int((datetime.now() - session.start_time).total_seconds())
    
    # Format detailed questions for report
    questions = []
    for detail in session.evaluation_details:
        questions.append({
            "question": f"Question {detail['question_number']}",
            "response": detail["response"],
            "evaluation": detail["evaluation"],
            "timestamp": detail["timestamp"],
            "word_count": detail["word_count"]
        })
    
    # Calculate additional metrics
    avg_words_per_response = session.total_words / max(1, session.questions_answered)
    
    return {
        "sessionId": session_id,
        "type": session.interview_type,
        "conversation": session.conversation_history,
        "questions": questions,
        "aggregate": session.aggregate_scores,
        "isComplete": session.is_complete,
        "phase": session.current_phase,
        "metrics": {
            "duration_seconds": session.duration_seconds,
            "questions_answered": session.questions_answered,
            "total_words": session.total_words,
            "eye_contact_score": session.eye_contact_score,
            "avg_words_per_response": round(avg_words_per_response, 1),
            "start_time": session.start_time.isoformat(),
            "interview_type": session.interview_type
        },
        "evaluation_details": session.evaluation_details
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Conversational AI Interviewer is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
@app.get("/api/token")
async def azure_realtime_token():
    """Issue a short-lived Azure AD token for the realtime interview service."""
    try:
        credential = get_azure_credential()
        access_token = credential.get_token(AZURE_REALTIME_SCOPE)
        return {
            "token": access_token.token,
            "expires_on": access_token.expires_on
        }
    except CredentialUnavailableError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Azure credential unavailable: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to acquire Azure realtime token"
        ) from exc
