// src/config/azureServices.js

/**
 * Azure AI Services configuration for the Evaluate Yourself platform
 * 
 * IMPORTANT: Values are loaded from environment variables (.env file)
 * In production, all values should be managed securely in Azure Key Vault.
 */

// Environment variable access with fallbacks for development
const getEnvVar = (key, fallback = '') => {
  return process.env[`REACT_APP_${key}`] || fallback;
};

/**
 * Azure Speech Service Configuration
 * 
 * Used for real-time speech-to-text transcription during interviews
 * @see https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/
 */
export const azureSpeechConfig = {
  // Azure Speech Service key from environment variables
  subscriptionKey: getEnvVar('AZURE_SPEECH_KEY'),
  
  // Azure region from environment variables (centralindia)
  region: getEnvVar('AZURE_SPEECH_REGION', 'centralindia'),
  
  // Default language (can be overridden in component props)
  language: 'en-US',
  
  // Endpoint from environment variables
  endpoint: getEnvVar('AZURE_SPEECH_ENDPOINT', 'https://centralindia.api.cognitive.microsoft.com/'),
  
  // Endpoint format for Speech SDK: https://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
  getEndpoint: (region = null) => 
    `https://${region || azureSpeechConfig.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
};

/**
 * Azure Face API Configuration
 * 
 * Used for eye contact analysis, facial expression monitoring, attention tracking
 * @see https://learn.microsoft.com/en-us/azure/cognitive-services/computer-vision/overview-identity
 */
export const azureFaceConfig = {
  // Azure Face API key from environment variables
  subscriptionKey: getEnvVar('AZURE_FACE_KEY'),
  
  // Azure Face API endpoint from environment variables
  endpoint: getEnvVar('AZURE_FACE_ENDPOINT'),
  
  // API paths for different face analysis capabilities
  paths: {
    detect: '/face/v1.0/detect',
    analyze: '/face/v1.0/detect'
  },
  
  // Parameters for face analysis
  params: {
    returnFaceId: 'false',
    returnFaceLandmarks: 'true',
    returnFaceAttributes: 'headPose,smile,eyeGaze'
  },
  
  // WebSocket proxy server for real-time processing
  // In production, this should be a secure WebSocket endpoint that proxies to Azure Face API
  wsEndpoint: getEnvVar('AZURE_FACE_WS_ENDPOINT', 'ws://localhost:8000/ws')
};

/**
 * Azure Text Analytics API Configuration
 * 
 * Used for sentiment analysis, key phrase extraction from interview responses
 * @see https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/
 */
export const azureTextAnalyticsConfig = {
  // Azure Text Analytics key from environment variables
  subscriptionKey: getEnvVar('AZURE_TEXT_ANALYTICS_KEY'),
  
  // Azure Text Analytics endpoint from environment variables
  endpoint: getEnvVar('AZURE_TEXT_ANALYTICS_ENDPOINT', 'https://projectelanguage.cognitiveservices.azure.com/'),
  
  // API version
  apiVersion: '2022-05-01',
  
  // API paths for different text analysis capabilities
  paths: {
    sentiment: '/text/analytics/v3.1/sentiment',
    keyPhrases: '/text/analytics/v3.1/keyPhrases',
    entities: '/text/analytics/v3.1/entities/recognition/general'
  }
};

/**
 * Azure Conversation Analysis API Configuration
 * 
 * Used for interview structure analysis, topic segmentation, response quality assessment
 * @see https://learn.microsoft.com/en-us/azure/cognitive-services/language-service/conversational-language-understanding/overview
 */
export const azureConversationConfig = {
  // Azure Language key from environment variables
  subscriptionKey: getEnvVar('AZURE_LANGUAGE_KEY'),
  
  // Azure Language endpoint from environment variables
  endpoint: getEnvVar('AZURE_LANGUAGE_ENDPOINT'),
  
  // API version
  apiVersion: '2022-10-01-preview',
  
  // API paths
  paths: {
    analyzeConversations: '/language/:analyze-conversations'
  }
};

/**
 * Azure Key Vault Configuration
 * 
 * Used for secure storage and rotation of API keys
 * In production, keys should be retrieved from Key Vault via a secure backend
 * @see https://learn.microsoft.com/en-us/azure/key-vault/
 */
export const azureKeyVaultConfig = {
  // Key Vault URL
  vaultUrl: getEnvVar('AZURE_KEY_VAULT_URL'),
  
  // Secret names
  secrets: {
    speechKey: 'speech-service-key',
    faceKey: 'face-api-key',
    textAnalyticsKey: 'text-analytics-key',
    languageKey: 'language-service-key'
  }
};

/**
 * Azure CORS and Security Configuration
 * 
 * CORS settings for secure communication between frontend and Azure services
 */
export const azureSecurityConfig = {
  // Allowed origins for CORS
  allowedOrigins: process.env.NODE_ENV === 'production' 
    ? ['https://evaluate-yourself.com'] 
    : ['http://localhost:3000'],
  
  // Backend proxy endpoints for secure API key handling
  // In production, all Azure API calls should go through these proxies
  proxyEndpoints: {
    speech: '/api/proxy/speech',
    face: '/api/proxy/face',
    textAnalytics: '/api/proxy/text-analytics',
    conversation: '/api/proxy/conversation'
  }
};