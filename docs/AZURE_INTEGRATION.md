# Azure AI Services Integration Guide

This document provides comprehensive technical details on how the Evaluate-Yourself platform integrates with Azure AI services to deliver advanced interview evaluation capabilities.

## Service Configuration Requirements

### 1. Azure Speech Service

**Purpose:** Real-time speech-to-text transcription during interviews

**Integration Points:**
- `InterviewHUD.js` - Real-time transcription display
- `ReportPage.js` - Post-interview transcript analysis

**Configuration Requirements:**
```javascript
// Environment Variables
REACT_APP_AZURE_SPEECH_KEY=your-subscription-key
REACT_APP_AZURE_SPEECH_REGION=your-region // e.g., westus2, eastus

// Endpoint Format
https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
```

**Implementation Notes:**
- Uses Azure Speech SDK for browser (via NPM package)
- Continuous recognition mode for uninterrupted transcription
- Phrase lists can be configured for domain-specific terminology
- Requires microphone permission from the browser

### 2. Azure Face API

**Purpose:** Eye contact analysis, facial expression monitoring, attention tracking

**Integration Points:**
- `WebcamToGaze.js` - Webcam capture and frame analysis
- `InterviewHUD.js` - Real-time feedback on eye contact
- `ReportPage.js` - Attention metrics visualization

**Configuration Requirements:**
```javascript
// Environment Variables
REACT_APP_AZURE_FACE_KEY=your-subscription-key
REACT_APP_AZURE_FACE_ENDPOINT=https://{resource-name}.cognitiveservices.azure.com/

// API Path
/face/v1.0/detect?returnFaceId=false&returnFaceLandmarks=true&returnFaceAttributes=headPose,smile,eyeGaze
```

**Implementation Notes:**
- Frames are processed at 8-10 FPS (configurable)
- Backend proxy handles API calls to protect subscription key
- WebSocket connection provides real-time metrics to the frontend
- Eye contact determined by head pose and gaze direction vectors

### 3. Azure Text Analytics API

**Purpose:** Sentiment analysis, key phrase extraction from interview responses

**Integration Points:**
- `ReportPage.js` - Sentiment scoring and key phrase visualization

**Configuration Requirements:**
```javascript
// Environment Variables
REACT_APP_AZURE_TEXT_ANALYTICS_KEY=your-subscription-key
REACT_APP_AZURE_TEXT_ANALYTICS_ENDPOINT=https://{resource-name}.cognitiveservices.azure.com/

// API Paths
/text/analytics/v3.1/sentiment
/text/analytics/v3.1/keyPhrases
/text/analytics/v3.1/entities/recognition/general
```

**Implementation Notes:**
- Batch processing of transcript segments for efficiency
- Sentiment scores mapped to visual indicators in the report
- Key phrases identified for content relevance assessment
- Named entity recognition for context understanding

### 4. Azure Conversation Analysis API

**Purpose:** Interview structure analysis, topic segmentation, response quality assessment

**Integration Points:**
- `ReportPage.js` - Comprehensive conversation analysis

**Configuration Requirements:**
```javascript
// Environment Variables
REACT_APP_AZURE_LANGUAGE_KEY=your-subscription-key
REACT_APP_AZURE_LANGUAGE_ENDPOINT=https://{resource-name}.cognitiveservices.azure.com/

// API Path
/language/:analyze-conversations?api-version=2022-10-01-preview
```

**Implementation Notes:**
- Post-interview processing for detailed analysis
- Topic segmentation to identify discussion areas
- Summarization of key points from the interview
- Question-response mapping for interview flow analysis

## Security Implementation

### API Key Management

All Azure service keys are:
1. Stored in Azure Key Vault
2. Retrieved via secure backend services
3. Never exposed to the client-side code
4. Rotated regularly via automated processes

### Backend Proxy Configuration

A dedicated Node.js/Express backend handles all Azure AI service communication:

```javascript
// Example backend proxy endpoint for Face API
app.post('/api/analyze-face', authenticate, async (req, res) => {
  try {
    const { imageData } = req.body;
    
    const response = await axios({
      method: 'post',
      url: `${process.env.AZURE_FACE_ENDPOINT}/face/v1.0/detect`,
      params: {
        returnFaceId: false,
        returnFaceLandmarks: true,
        returnFaceAttributes: 'headPose,smile,eyeGaze'
      },
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': process.env.AZURE_FACE_KEY
      },
      data: Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Face API error:', error);
    res.status(500).json({ error: 'Face analysis failed' });
  }
});
```

### CORS Configuration

```javascript
// Backend CORS setup
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://evaluate-yourself.com' 
    : 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## WebSocket Implementation for Real-time Services

For real-time communication (speech recognition and eye tracking):

```javascript
// WebSocket server setup
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Authenticate connection
  // ...
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'video-frame') {
        // Process frame with Azure Face API
        const faceAnalysis = await analyzeFace(data.frame);
        
        // Send results back to client
        ws.send(JSON.stringify({
          type: 'face-analysis',
          data: {
            eyeContact: calculateEyeContact(faceAnalysis),
            blink: detectBlink(faceAnalysis),
            attention: scoreAttention(faceAnalysis)
          }
        }));
      }
    } catch (error) {
      console.error('WebSocket processing error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
```

## Performance Optimization

1. **Speech Service:**
   - Direct browser-to-service connection via SDK
   - Optimized for low latency transcription

2. **Face API:**
   - Frame sampling rate adjusts based on client performance
   - Image compression before transmission
   - Results caching for performance optimization

3. **Text Analytics & Conversation Analysis:**
   - Batch processing of content
   - Asynchronous processing to avoid UI blocking
   - Results caching to minimize redundant API calls

## Error Handling and Fallbacks

1. **Connectivity Issues:**
   - Offline mode with cached data when possible
   - Automatic reconnection attempts
   - Clear user feedback on service status

2. **Service Limitations:**
   - Graceful degradation when rate limits are reached
   - Queuing mechanisms for high-volume processing
   - Feature toggles to disable intensive features when needed

## Integration Testing

Comprehensive test suites verify Azure service integration:

1. **Unit Tests:**
   - Mock API responses for service client testing
   - Input validation and error handling verification

2. **Integration Tests:**
   - End-to-end tests with Azure service sandboxes
   - Performance and reliability benchmarks

3. **Load Tests:**
   - Simulated multi-user scenarios
   - Rate limit and throttling behavior verification

## Deployment Considerations

1. **Regional Configuration:**
   - Services deployed in same Azure region as application for minimal latency
   - Geo-redundancy options for high availability

2. **Monitoring:**
   - Azure Application Insights integration
   - Service health dashboards
   - Usage metrics and cost optimization

3. **Scaling:**
   - Auto-scaling based on concurrent user sessions
   - Reserved capacity for predictable workloads