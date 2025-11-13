# AI Conversational Interviewer Setup Guide

## Overview
This guide explains how to set up and use the AI Conversational Interviewer feature that provides a ChatGPT Voice Mode-like experience where the AI drives the interview conversation.

## Key Features
- **Conversational AI**: AI acts as active interviewer, driving the conversation naturally
- **Real-time Evaluation**: Each response is evaluated with detailed scoring
- **Multiple Interview Types**: Technical, Behavioral, and Mixed interviews
- **Voice + Text Input**: Support for both speech recognition and text input
- **Natural Flow**: AI asks follow-up questions based on previous responses
- **Comprehensive Reports**: Detailed feedback and scoring breakdown

## Architecture

### Backend (`simple_app.py`)
- **FastAPI server** with conversational interview logic
- **InterviewSession class** manages conversation state and flow
- **OpenAI integration** for intelligent response generation and evaluation
- **Fallback mechanisms** when OpenAI API is unavailable
- **Real-time scoring** with aggregate performance tracking

### Frontend (`ConversationalInterviewPage.jsx`)
- **React component** with Material-UI design
- **Speech recognition** using Web Speech API
- **Text-to-speech** for AI responses
- **Real-time conversation display** with chat-like interface
- **Progress tracking** and phase indicators

## Setup Instructions

### 1. Backend Setup

#### Option A: Simple Backend (Recommended)
```bash
cd backend
pip install -r simple_requirements.txt
python simple_app.py
```

#### Option B: Full Backend with LangGraph
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 2. Environment Configuration

Create `.env` file in backend directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Note**: The system works without OpenAI API key using fallback mechanisms, but AI responses will be less intelligent.

### 3. Frontend Integration

The conversational interview is already integrated into the React app:
- Route: `/conversational-interview/:type`
- Component: `ConversationalInterviewPage.jsx`
- Access via Dashboard "Quick Actions" section

### 4. Usage Flow

1. **Start Interview**: Click "AI Conversation" button on dashboard
2. **AI Introduction**: AI welcomes and explains the interview format
3. **Conversation Loop**:
   - AI asks questions
   - User responds via voice or text
   - AI evaluates response
   - AI asks contextual follow-up questions
4. **Completion**: After 5 questions, AI concludes and provides summary
5. **Report**: View detailed report with scoring breakdown

## Interview Types

### Technical Interview
- Focus: Programming concepts, algorithms, system design
- Topics: JavaScript/Python, data structures, debugging, best practices
- Example questions: Closures, optimization, OOP principles

### Behavioral Interview  
- Focus: Soft skills, experience, teamwork
- Topics: Leadership, problem-solving, communication, adaptability
- Example questions: Challenging projects, deadlines, conflicts

### Mixed Interview
- Focus: Combination of technical and behavioral
- Topics: Technical skills + experience + growth mindset
- Example questions: Learning new technologies, mentoring, code reviews

## API Endpoints

### POST `/api/start-interview`
Start new conversational interview session
```json
{
  "interview_type": "technical|behavioral|mixed"
}
```

### POST `/api/chat`
Send user message and get AI response
```json
{
  "session_id": "uuid",
  "user_message": "User's response"
}
```

### GET `/api/session/{session_id}`
Get complete session data for report generation

### GET `/health`
Health check endpoint

## Conversation Flow Logic

### Phase Management
1. **Introduction**: AI welcomes and asks opening question
2. **Questioning**: AI asks follow-up questions based on responses
3. **Evaluation**: Each response scored on clarity, confidence, relevance, depth
4. **Conclusion**: AI summarizes performance and concludes interview

### AI Response Generation
- **Context-aware**: Uses conversation history for relevant follow-ups
- **Adaptive**: Adjusts questions based on interview type and user responses
- **Encouraging**: Maintains positive, professional tone
- **Fallback**: Works even without OpenAI API using predefined questions

### Scoring System
- **Real-time evaluation**: Each response scored immediately
- **Multiple criteria**: Clarity (structure), Confidence (decisiveness), Relevance (appropriateness), Depth (insight)
- **Aggregate tracking**: Running averages and overall performance score
- **Detailed feedback**: Constructive comments for improvement

## Browser Compatibility

### Speech Recognition
- **Chrome/Edge**: Full support via Web Speech API
- **Firefox/Safari**: Limited support, text input recommended
- **Fallback**: Always available text input for all browsers

### Text-to-Speech
- **All modern browsers**: Good support via Speech Synthesis API
- **Customizable**: Adjustable rate, pitch, volume

## Troubleshooting

### Common Issues

1. **Backend not starting**:
   - Check Python dependencies: `pip install -r simple_requirements.txt`
   - Verify port 8000 is available
   - Check console for error messages

2. **OpenAI API errors**:
   - Verify API key in `.env` file
   - Check API quota and billing
   - System will use fallbacks if API unavailable

3. **Speech recognition not working**:
   - Use Chrome or Edge browser
   - Allow microphone permissions
   - Use text input as alternative

4. **CORS errors**:
   - Ensure frontend runs on port 3000 or 3001
   - Check backend CORS configuration

### Development Tips

1. **Testing without OpenAI**: System works with fallback responses
2. **Debugging conversations**: Check browser console for API calls
3. **Session persistence**: Sessions stored in memory (restart clears data)
4. **Customizing questions**: Modify `INTERVIEW_CONTEXTS` in `simple_app.py`

## Performance Considerations

- **Session storage**: In-memory (consider Redis for production)
- **OpenAI rate limits**: Implement caching for repeated evaluations
- **Frontend optimization**: Consider React.memo for conversation history
- **Audio processing**: Use compressed audio formats for better performance

## Production Deployment

### Backend
- Use production ASGI server (Gunicorn + Uvicorn)
- Implement proper session storage (Redis/PostgreSQL)
- Add authentication and authorization
- Configure environment-specific settings

### Frontend
- Build optimized production bundle
- Configure HTTPS for speech recognition
- Implement proper error boundaries
- Add monitoring and analytics

## Future Enhancements

1. **Advanced AI Models**: GPT-4 integration for better responses
2. **Voice Cloning**: Custom interviewer voices
3. **Video Analysis**: Facial expression and body language evaluation
4. **Industry-Specific**: Tailored questions for different roles/industries
5. **Practice Mode**: Unlimited questions without evaluation
6. **Mentor Mode**: AI provides real-time coaching during interview

## Support

For issues or questions:
1. Check browser console for errors
2. Verify backend health at `http://localhost:8000/health`
3. Review this documentation for common solutions
4. Check backend logs for detailed error information

---

This conversational AI interviewer provides a natural, engaging interview experience that mimics real human interactions while providing valuable feedback and assessment.