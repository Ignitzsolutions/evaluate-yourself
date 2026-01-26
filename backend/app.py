from fastapi import FastAPI, HTTPException, Header, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, List
import os
import uuid
from datetime import datetime
from io import BytesIO
import jwt
import json
import requests
import websockets
import asyncio
import base64
import traceback
import numpy as np
import re
import sys
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
from azure.identity import (
    CredentialUnavailableError,
    DefaultAzureCredential
)
try:
    from dotenv import load_dotenv
    import pathlib
    # Load .env from project root first (user's main config)
    backend_dir = pathlib.Path(__file__).parent.resolve()
    root_env = backend_dir.parent / '.env'
    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=True)
    # Also try loading from backend directory as fallback
    env_path = backend_dir / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)  # Don't override root .env values
except ImportError:
    pass

from models.personality import CreateAssessmentRequest, UpdateReflectionsRequest, PersonalityReport
from models.interview import InterviewReport, InterviewReportSummary, CreateInterviewReportRequest, TranscriptMessage, ScoreBreakdown
from services.personality_scoring import generate_report
from services.interview_state import InterviewState, NextAction
from services.interview_evaluator import evaluate_response
from services.report_generator import generate_report as generate_interview_report
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER

app = FastAPI(title="AI Interview Backend", version="1.0.0")

try:
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
except Exception:
    pass

# Load environment variables
AZURE_REALTIME_SCOPE = os.getenv(
    "AZURE_REALTIME_SCOPE",
    "https://cognitiveservices.azure.com/.default"
)
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")  # e.g., https://{resource}.openai.azure.com
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-realtime")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-08-28")
# Note: API version from AZURE_OPENAI_API_VERSION env var (default: 2025-08-28)
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")

# OpenAI Realtime API variables (optional - for direct OpenAI API, not Azure)
OPENAI_REALTIME_API_KEY = os.getenv("OPENAI_REALTIME_API_KEY")
OPENAI_REALTIME_ENDPOINT = os.getenv("OPENAI_REALTIME_ENDPOINT", "wss://api.openai.com/v1/realtime")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-12-17")

# #region agent log
import json as json_module
from datetime import datetime
try:
    with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
        f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:72","message":"Environment variables loaded","data":{"AZURE_OPENAI_API_VERSION":AZURE_OPENAI_API_VERSION,"AZURE_OPENAI_DEPLOYMENT":AZURE_OPENAI_DEPLOYMENT,"AZURE_OPENAI_ENDPOINT":AZURE_OPENAI_ENDPOINT[:50] if AZURE_OPENAI_ENDPOINT else None,"has_api_key":bool(AZURE_OPENAI_API_KEY)},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + "\n")
except: pass
# #endregion
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION", "centralindia")

def extract_azure_endpoint_info(endpoint: str) -> tuple:
    """Extract resource name, domain, and region from Azure OpenAI endpoint.
    
    For Realtime API:
    - If endpoint is already *.openai.azure.com, use it as-is (no conversion)
    - If endpoint is *.cognitiveservices.azure.com, convert to openai.azure.com format
    """
    if not endpoint:
        raise ValueError("AZURE_OPENAI_ENDPOINT is not set")
    
    # Remove protocol and any path/query parameters
    from urllib.parse import urlparse
    parsed = urlparse(endpoint if endpoint.startswith(('http://', 'https://')) else f"https://{endpoint}")
    hostname = parsed.netloc or parsed.path.split('/')[0] if not parsed.netloc else parsed.netloc
    # Remove any remaining path/query if still present
    hostname = hostname.split('/')[0].split('?')[0]
    
    # Case 1: Already in openai.azure.com format - use as-is
    match = re.match(r"^([^.]+)\.openai\.azure\.com$", hostname)
    if match:
        resource_name = match.group(1)
        return resource_name, "openai.azure.com", None
    
    # Case 2: cognitiveservices.azure.com format - convert to openai.azure.com
    match = re.match(r"^(.+)\.cognitiveservices\.azure\.com$", hostname)
    if match:
        full_name = match.group(1)
        # Extract region for reference, but preserve full name for hostname
        parts = full_name.rsplit("-", 1)
        if len(parts) == 2:
            resource_name = full_name  # Keep full "ignit-mk7zvb02-swedencentral"
            region = parts[1]           # Extract region for reference/logging
            return resource_name, "openai.azure.com", region
        else:
            # No region suffix, use full name as-is
            return full_name, "openai.azure.com", None
    
    # Case 3: Unknown format
    raise ValueError(f"Unknown endpoint format: {hostname}. Must be *.openai.azure.com or *.cognitiveservices.azure.com")

# Environment variable validation on startup
def validate_environment():
    """Validate required environment variables and print warnings."""
    warnings = []
    errors = []
    
    # Check Azure OpenAI Realtime configuration
    if not AZURE_OPENAI_API_KEY or AZURE_OPENAI_API_KEY == "your-azure-openai-api-key-here":
        errors.append("❌ Azure OpenAI API key not configured. Voice interview will not work.")
    else:
        if not AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_ENDPOINT == "https://your-resource.openai.azure.com":
            errors.append("❌ AZURE_OPENAI_ENDPOINT not configured. Set it in backend/.env")
        elif 'openai.azure.com' not in AZURE_OPENAI_ENDPOINT and 'cognitiveservices.azure.com' not in AZURE_OPENAI_ENDPOINT:
            errors.append("❌ AZURE_OPENAI_ENDPOINT format invalid. Should be *.openai.azure.com or *.cognitiveservices.azure.com")
        else:
            # Check if using cognitiveservices format and warn about conversion
            if 'cognitiveservices.azure.com' in AZURE_OPENAI_ENDPOINT:
                warnings.append("⚠️  AZURE_OPENAI_ENDPOINT uses cognitiveservices.azure.com format. This will be automatically converted to openai.azure.com format for Realtime API calls.")
            
            # Extract endpoint info for logging
            try:
                resource_name, domain, region = extract_azure_endpoint_info(AZURE_OPENAI_ENDPOINT)
                derived_realtime_host = f"{resource_name}.openai.azure.com"
                
                print("✅ Azure OpenAI Realtime API configured")
                print(f"   Configured endpoint: {AZURE_OPENAI_ENDPOINT}")
                print(f"   Derived realtime host: {derived_realtime_host}")
                print(f"   Deployment: {AZURE_OPENAI_DEPLOYMENT}")
                print(f"   API version: {AZURE_OPENAI_API_VERSION}")
                if region:
                    print(f"   Region: {region}")
            except Exception as e:
                warnings.append(f"⚠️  Could not parse endpoint for logging: {e}")
                print("✅ Azure OpenAI Realtime API configured")
    
    # Check Azure Speech Services (optional)
    if AZURE_SPEECH_KEY and AZURE_SPEECH_KEY != "your-azure-speech-key-here":
        print("✅ Azure Speech Services configured")
    else:
        warnings.append("ℹ️  Azure Speech Services not configured (optional for enhanced transcription)")
    
    # Print warnings and errors
    if warnings:
        print("\n".join(warnings))
    if errors:
        print("\n" + "="*60)
        print("ENVIRONMENT CONFIGURATION ERRORS:")
        print("="*60)
        print("\n".join(errors))
        print("\nTo fix:")
        print("1. Copy backend/.env.example to backend/.env")
        print("2. Add your Azure OpenAI API key and endpoint")
        print("3. Restart the server")
        print("="*60 + "\n")

# Validate on import (will run when module loads)
validate_environment()

# Run validation on startup
@app.on_event("startup")
async def startup_event():
    validate_environment()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:5173",  # Vite default
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse)
def read_root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Evaluate Yourself - API</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 16px;
                padding: 48px;
                max-width: 600px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                text-align: center;
            }
            .logo {
                width: 120px;
                height: auto;
                margin: 0 auto 24px;
                display: block;
            }
            h1 {
                color: #1a1a1a;
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 12px;
            }
            .subtitle {
                color: #666;
                font-size: 18px;
                margin-bottom: 32px;
            }
            .status {
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 32px;
            }
            .info {
                background: #f9fafb;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
            }
            .info-item {
                display: flex;
                justify-content: space-between;
                padding: 12px 0;
                border-bottom: 1px solid #e5e7eb;
            }
            .info-item:last-child {
                border-bottom: none;
            }
            .info-label {
                color: #6b7280;
                font-weight: 500;
            }
            .info-value {
                color: #1a1a1a;
                font-weight: 600;
            }
            .endpoints {
                text-align: left;
                margin-top: 24px;
            }
            .endpoints h3 {
                color: #1a1a1a;
                font-size: 18px;
                margin-bottom: 12px;
            }
            .endpoint {
                background: #f3f4f6;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                color: #1a1a1a;
            }
            .method {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: 600;
                margin-right: 8px;
                font-size: 12px;
            }
            .method.get {
                background: #3b82f6;
                color: white;
            }
            .method.post {
                background: #10b981;
                color: white;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <img src="/static/logo.png" alt="Evaluate Yourself" class="logo" onerror="this.style.display='none'">
            <h1>Evaluate Yourself</h1>
            <p class="subtitle">AI-Powered Interview Practice Platform</p>
            <div class="status">✓ API Running</div>
            <div class="info">
                <div class="info-item">
                    <span class="info-label">Service</span>
                    <span class="info-value">AI Interview Backend</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Version</span>
                    <span class="info-value">1.0.0</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value">Operational</span>
                </div>
            </div>
            <div class="endpoints">
                <h3>Available Endpoints</h3>
                <div class="endpoint">
                    <span class="method get">GET</span>/api/interview/reports
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>/api/interview/reports/{id}
                </div>
                <div class="endpoint">
                    <span class="method post">POST</span>/api/interview/reports
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>/api/self-insight/reports
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>/api/token
                </div>
                <div class="endpoint">
                    <span class="method get">GET</span>/health
                </div>
            </div>
        </div>
    </body>
    </html>
    """

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/key")
def get_api_key():
    key = os.environ.get("AZURE_COGNITIVE_KEY") or os.environ.get("AZURE_API_KEY") or os.environ.get("COGNITIVE_SERVICE_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="API key not configured. Set AZURE_COGNITIVE_KEY in environment.")
    return {"key": key}

azure_credential: Optional[DefaultAzureCredential] = None

def get_azure_credential() -> DefaultAzureCredential:
    global azure_credential
    if azure_credential is None:
        azure_credential = DefaultAzureCredential()
    return azure_credential

# Interview session storage (in-memory, could be moved to Redis in production)
interview_sessions: Dict[str, InterviewState] = {}

# Pydantic models for WebRTC endpoint
class WebRTCRequest(BaseModel):
    sdpOffer: str
    sessionId: Optional[str] = None
    interviewType: Optional[str] = "mixed"
    difficulty: Optional[str] = "mid"
    role: Optional[str] = None
    company: Optional[str] = None
    jobLevel: Optional[str] = "mid"
    questionMix: Optional[str] = "balanced"
    questionMixRatio: Optional[float] = None
    interviewStyle: Optional[str] = "neutral"

def build_azure_realtime_url(resource_name: str, domain: str, path: str, region: Optional[str] = None) -> str:
    """Build Azure Realtime API URL."""
    base_url = f"https://{resource_name}.{domain}"
    if region and domain == "cognitiveservices.azure.com":
        # For cognitiveservices format, include region in base URL
        base_url = f"https://{resource_name}-{region}.{domain}"
    return f"{base_url}{path}?api-version={AZURE_OPENAI_API_VERSION}"

@app.post("/api/realtime/webrtc")
async def webrtc_proxy(request: WebRTCRequest):
    """WebRTC proxy endpoint for ephemeral token creation and SDP negotiation."""
    # #region agent log
    try:
        log_entry = json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:414","message":"WebRTC proxy called","data":{"deployment":AZURE_OPENAI_DEPLOYMENT,"api_version":AZURE_OPENAI_API_VERSION,"endpoint":AZURE_OPENAI_ENDPOINT[:100] if AZURE_OPENAI_ENDPOINT else None},"sessionId":"debug-session","runId":"run1","hypothesisId":"F"}) + "\n"
        with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
            f.write(log_entry)
            f.flush()
        print(f"DEBUG: WebRTC proxy called - logged to file")
    except Exception as log_err:
        print(f"DEBUG LOG ERROR: {log_err}")
    # #endregion
    try:
        # Validate Azure configuration
        if not AZURE_OPENAI_API_KEY or AZURE_OPENAI_API_KEY == "your-azure-openai-api-key-here":
            raise HTTPException(
                status_code=500,
                detail="Azure OpenAI API key not configured. Please set AZURE_OPENAI_API_KEY in backend/.env"
            )
        
        if not AZURE_OPENAI_ENDPOINT:
            raise HTTPException(
                status_code=500,
                detail="AZURE_OPENAI_ENDPOINT not configured. Please set it in backend/.env"
            )
        
        # Extract resource name, domain, and region
        try:
            resource_name, domain, region = extract_azure_endpoint_info(AZURE_OPENAI_ENDPOINT)
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:396","message":"Endpoint parsed","data":{"resource_name":resource_name,"domain":domain,"region":region,"original_endpoint":AZURE_OPENAI_ENDPOINT},"sessionId":"debug-session","runId":"run1","hypothesisId":"B"}) + "\n")
            except: pass
            # #endregion
        except ValueError as e:
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:398","message":"Endpoint parsing failed","data":{"error":str(e),"endpoint":AZURE_OPENAI_ENDPOINT},"sessionId":"debug-session","runId":"run1","hypothesisId":"B"}) + "\n")
            except Exception:
                pass
            # #endregion
            raise HTTPException(status_code=500, detail=str(e))
        
        # Build system prompt with new form fields
        system_prompt = _build_interviewer_system_prompt(
            interview_type=request.interviewType or "mixed",
            difficulty=request.difficulty or "mid",
            role=request.role,
            company=request.company,
            job_level=request.jobLevel or "mid",
            question_mix=request.questionMix or "balanced",
            interview_style=request.interviewStyle or "neutral"
        )
        
        # Build session request per Azure OpenAI Realtime API spec
        # Format: { expires_after: {...}, session: {...} }
        client_secrets_request = {
            "expires_after": {
                "anchor": "created_at",
                "seconds": 3600  # 1 hour
            },
            "session": {
                "type": "realtime",
                "model": AZURE_OPENAI_DEPLOYMENT,
                "audio": {
                    "output": {
                        "voice": "alloy"
                    }
                }
            }
        }
        
        # Add instructions if provided
        if system_prompt:
            client_secrets_request["session"]["instructions"] = system_prompt
        
        # #region agent log
        try:
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:427","message":"Request body constructed","data":{"has_instructions":bool(system_prompt),"model":AZURE_OPENAI_DEPLOYMENT,"session_type":"realtime","request_keys":list(client_secrets_request.keys())},"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}) + "\n")
        except: pass
        # #endregion
        
        # Step 1: Create ephemeral token
        # Azure Realtime API requires openai.azure.com format (extract_azure_endpoint_info now converts cognitiveservices to this)
        # Build endpoint: {resource-region}.openai.azure.com (preserves full resource-region identifier, e.g., ignit-mk7zvb02-swedencentral.openai.azure.com)
        base_endpoint = f"{resource_name}.openai.azure.com"
        
        # API version: Use value from AZURE_OPENAI_API_VERSION env var
        # For GA endpoints (2025-08-28), api-version may not be required in URL
        # Try without api-version first for GA, fallback to with api-version if needed
        api_version = AZURE_OPENAI_API_VERSION
        # For GA versions (non-preview), try without api-version parameter first
        if api_version and "-preview" not in api_version:
            token_url = f"https://{base_endpoint}/openai/v1/realtime/client_secrets"
        else:
            token_url = f"https://{base_endpoint}/openai/v1/realtime/client_secrets?api-version={api_version}"
        
        # #region agent log
        try:
            log_entry = json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:492","message":"Token request preparation","data":{"base_endpoint":base_endpoint,"resource_name":resource_name,"api_version":api_version,"token_url":token_url,"deployment":AZURE_OPENAI_DEPLOYMENT,"original_endpoint":AZURE_OPENAI_ENDPOINT},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + "\n"
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(log_entry)
                f.flush()
            print(f"DEBUG: Token request prep - base_endpoint={base_endpoint}, api_version={api_version}")
        except Exception as log_err:
            print(f"DEBUG LOG ERROR: {log_err}")
        # #endregion
        
        print(f"🔗 Creating ephemeral token: {token_url}")
        
        # #region agent log
        try:
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                request_body_safe = {k: (v[:100] + "..." if isinstance(v, str) and len(v) > 100 else v) for k, v in client_secrets_request.items()}
                f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:502","message":"Token request sent","data":{"url":token_url,"headers":{"api-key":"***","content-type":"application/json"},"request_body":request_body_safe,"deployment":AZURE_OPENAI_DEPLOYMENT},"sessionId":"debug-session","runId":"run1","hypothesisId":"B"}) + "\n")
                f.flush()
        except Exception as log_err:
            print(f"DEBUG LOG ERROR: {log_err}")
        # #endregion
        
        try:
            token_resp = requests.post(
                token_url,
                headers={
                    "api-key": AZURE_OPENAI_API_KEY,
                    "content-type": "application/json"
                },
                json=client_secrets_request,
                timeout=10.0
            )
            response_body = token_resp.text[:500] if token_resp.text else ""
            print(f"   Status: {token_resp.status_code} Body: {response_body[:200]}")
            
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    full_response_body = token_resp.text if token_resp.text else ""
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:515","message":"Token response received","data":{"status_code":token_resp.status_code,"response_body":full_response_body,"response_headers":dict(token_resp.headers)},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}) + "\n")
                    f.flush()
            except Exception as log_err:
                print(f"DEBUG LOG ERROR: {log_err}")
            # #endregion
            
            if token_resp.status_code == 200:
                print(f"✅ Token created successfully")
                token_resp.raise_for_status()
            elif token_resp.status_code == 400 and "API version not supported" in response_body:
                # #region agent log
                try:
                    with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                        f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:530","message":"API version not supported error","data":{"api_version":api_version,"base_endpoint":base_endpoint,"deployment":AZURE_OPENAI_DEPLOYMENT,"full_response":token_resp.text if token_resp.text else "","token_url":token_url},"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}) + "\n")
                except: pass
                # #endregion
                error_detail = (
                    f"API version {api_version} not supported. This usually indicates:\n"
                    f"1. Wrong endpoint hostname (should be *.openai.azure.com)\n"
                    f"2. Realtime API not enabled on this Azure resource\n"
                    f"3. Deployment '{AZURE_OPENAI_DEPLOYMENT}' is not Realtime-capable\n\n"
                    f"Endpoint used: https://{base_endpoint}/openai/v1/realtime/client_secrets\n"
                    f"Verify the endpoint in Azure Portal matches this hostname."
                )
                raise HTTPException(status_code=400, detail=error_detail)
            elif token_resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Authentication failed. Check API key matches the resource.")
            elif token_resp.status_code == 404:
                error_detail = (
                    f"Endpoint not found (404). Verify:\n"
                    f"1. Hostname is correct: {base_endpoint}\n"
                    f"2. Path is correct: /openai/v1/realtime/client_secrets\n"
                    f"3. Realtime API is enabled on this Azure resource"
                )
                raise HTTPException(status_code=404, detail=error_detail)
            else:
                error_detail = f"Token creation failed: {token_resp.status_code}. Response: {response_body[:200]}"
                raise HTTPException(status_code=token_resp.status_code, detail=error_detail)
                
        except requests.Timeout:
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:541","message":"Request timeout","data":{"token_url":token_url,"timeout":10.0},"sessionId":"debug-session","runId":"run1","hypothesisId":"E"}) + "\n")
            except: pass
            # #endregion
            raise HTTPException(status_code=504, detail="Connection timeout. Please try again.")
        except requests.HTTPError as e:
            error_body = e.response.text[:500] if e.response.text else ""
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:545","message":"HTTPError exception","data":{"status_code":e.response.status_code if e.response else None,"error_body":error_body,"token_url":token_url},"sessionId":"debug-session","runId":"run1","hypothesisId":"E"}) + "\n")
            except: pass
            # #endregion
            raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error: {error_body[:200]}")
        except Exception as ex:
            # #region agent log
            try:
                import traceback
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:550","message":"Unexpected exception in token creation","data":{"exception_type":type(ex).__name__,"exception_message":str(ex),"token_url":token_url,"base_endpoint":base_endpoint,"api_version":api_version,"traceback":traceback.format_exc()},"sessionId":"debug-session","runId":"run1","hypothesisId":"E"}) + "\n")
            except: pass
            # #endregion
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(ex)[:200]}")
        
        token_json = token_resp.json()
        print(f"🔑 Token response keys: {list(token_json.keys())}")  # Debug log
        print(f"🔑 Token response (sanitized): {json.dumps({k: (v[:50] + '...' if isinstance(v, str) and len(v) > 50 else v) for k, v in token_json.items()}, indent=2)}")  # Debug log
        
        # Azure Realtime API client_secrets endpoint returns "value" field
        # Response format: { "value": "ek_...", "expires_at": ..., "session": {...} }
        ephemeral_token = token_json.get("value")
        
        if not ephemeral_token:
            print(f"❌ Token response structure: {json.dumps(token_json, indent=2)[:500]}")
            raise HTTPException(
                status_code=500,
                detail=f"Ephemeral token missing in response. Response keys: {list(token_json.keys())}"
            )
        
        print(f"✅ Ephemeral token extracted (length: {len(ephemeral_token)})")  # Debug log
        
        # Step 2: SDP negotiation
        # Azure Realtime API: Use same API version as token creation (from env var)
        # Always use openai.azure.com format (same as token creation)
        # For GA versions (non-preview), api-version may not be required in URL
        calls_api_version = AZURE_OPENAI_API_VERSION
        if calls_api_version and "-preview" not in calls_api_version:
            calls_url = f"https://{base_endpoint}/openai/v1/realtime/calls"
        else:
            calls_url = f"https://{base_endpoint}/openai/v1/realtime/calls?api-version={calls_api_version}"
        
        print(f"🔗 Calls URL: {calls_url}")  # Debug log
        print(f"📤 SDP offer length: {len(request.sdpOffer)} chars")
        print(f"📤 SDP offer preview: {request.sdpOffer[:200]}...")
        
        try:
            sdp_resp = requests.post(
                calls_url,
                headers={
                    "Authorization": f"Bearer {ephemeral_token}",
                    "Content-Type": "application/sdp"
                },
                data=request.sdpOffer,
                timeout=15.0
            )
            print(f"📥 SDP response status: {sdp_resp.status_code}")  # Debug log
            sdp_resp.raise_for_status()
        except requests.Timeout:
            raise HTTPException(status_code=504, detail="SDP negotiation timeout. Please try again.")
        except requests.HTTPError as e:
            error_detail = f"SDP negotiation failed: {e.response.status_code}"
            if e.response.status_code == 401:
                error_detail = "Authentication failed with ephemeral token."
            elif e.response.status_code == 429:
                error_detail = "Rate limit exceeded. Please wait."
            # Log response code and first 200 chars of error body
            error_body = e.response.text[:200] if e.response.text else ""
            print(f"SDP negotiation failed: {e.response.status_code}, error: {error_body}")
            raise HTTPException(status_code=e.response.status_code, detail=error_detail)
        
        sdp_answer = sdp_resp.text
        
        return {"sdpAnswer": sdp_answer}
        
    except HTTPException as http_ex:
        # #region agent log
        try:
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:636","message":"HTTPException raised","data":{"status_code":http_ex.status_code,"detail":str(http_ex.detail)[:500]},"sessionId":"debug-session","runId":"run1","hypothesisId":"F"}) + "\n")
        except: pass
        # #endregion
        raise
    except Exception as e:
        # #region agent log
        try:
            import traceback
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:642","message":"Unexpected exception in WebRTC proxy","data":{"exception_type":type(e).__name__,"exception_message":str(e),"traceback":traceback.format_exc()},"sessionId":"debug-session","runId":"run1","hypothesisId":"F"}) + "\n")
        except: pass
        # #endregion
        print(f"Unexpected error in WebRTC proxy: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error. Please try again.")

@app.get("/api/token")
async def realtime_token():
    # Check if OpenAI API key is configured (for direct OpenAI API)
    if OPENAI_REALTIME_API_KEY and OPENAI_REALTIME_API_KEY != "your-openai-api-key-here":
        return {
            "api_key": OPENAI_REALTIME_API_KEY,
            "endpoint": OPENAI_REALTIME_ENDPOINT,
            "model": OPENAI_REALTIME_MODEL,
            "provider": "openai"
        }
    
    # Fallback to Azure OpenAI (using DefaultAzureCredential)
    try:
        credential = get_azure_credential()
        access_token = credential.get_token(AZURE_REALTIME_SCOPE)
        return {
            "token": access_token.token,
            "expires_on": access_token.expires_on,
            "scope": AZURE_REALTIME_SCOPE,
            "provider": "azure"
        }
    except CredentialUnavailableError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Azure credential unavailable: {exc}. Please ensure Azure CLI is installed and run 'az login'."
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to acquire realtime token: {exc}"
        ) from exc

@app.websocket("/api/realtime/ws")
async def realtime_websocket_proxy(websocket: WebSocket):
    await websocket.accept()
    
    # Check if OpenAI API key is configured (for direct OpenAI API)
    if not OPENAI_REALTIME_API_KEY or OPENAI_REALTIME_API_KEY == "your-openai-api-key-here":
        await websocket.close(
            code=1008, 
            reason="OpenAI API key not configured. This endpoint requires OPENAI_REALTIME_API_KEY environment variable. Use /api/realtime/webrtc for Azure OpenAI."
        )
        return
    
    model = OPENAI_REALTIME_MODEL
    ws_url = f"wss://api.openai.com/v1/realtime?model={model}"
    
    try:
        async with websockets.connect(
            ws_url,
            subprotocols=["realtime"],
            additional_headers={"Authorization": f"Bearer {OPENAI_REALTIME_API_KEY}"}
        ) as openai_ws:
            async def forward_to_openai():
                try:
                    while True:
                        try:
                            data = await websocket.receive_text()
                            await openai_ws.send(data)
                        except WebSocketDisconnect:
                            break
                        except Exception as e:
                            try:
                                data = await websocket.receive_bytes()
                                await openai_ws.send(data)
                            except WebSocketDisconnect:
                                break
                            except Exception:
                                break
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    print(f"Error forwarding to OpenAI: {e}")
            
            async def forward_to_client():
                try:
                    while True:
                        try:
                            data = await openai_ws.recv()
                            if isinstance(data, str):
                                await websocket.send_text(data)
                            else:
                                await websocket.send_bytes(data)
                        except websockets.exceptions.ConnectionClosed as e:
                            reason = str(e) if str(e) else "OpenAI connection closed"
                            await websocket.close(code=1006, reason=reason)
                            break
                        except Exception as e:
                            reason = f"Error receiving from OpenAI: {str(e)}" if str(e) else "Error receiving from OpenAI"
                            await websocket.close(code=1011, reason=reason)
                            break
                except Exception as e:
                    print(f"Error forwarding to client: {e}")
            
            try:
                await asyncio.gather(
                    forward_to_openai(),
                    forward_to_client(),
                    return_exceptions=True
                )
            except Exception as e:
                await websocket.close(code=1011, reason=f"Connection error: {str(e)}")
    except websockets.exceptions.InvalidURI as e:
        reason = f"Invalid OpenAI endpoint: {str(e)}" if str(e) else "Invalid OpenAI endpoint"
        await websocket.close(code=1008, reason=reason)
    except websockets.exceptions.InvalidHandshake as e:
        reason = f"OpenAI authentication failed: {str(e)}" if str(e) else "OpenAI authentication failed"
        await websocket.close(code=1008, reason=reason)
    except Exception as e:
        error_msg = str(e) if str(e) else "Connection failed. Please check your OpenAI API key and try again."
        await websocket.close(code=1011, reason=error_msg)

@app.websocket("/api/interview/realtime/{session_id}")
async def interview_realtime_websocket(websocket: WebSocket, session_id: str, authorization: Optional[str] = None):
    """WebSocket endpoint for voice-only interview using Azure OpenAI Realtime."""
    print(f"🔌 WebSocket connection attempt: session_id={session_id}, client={websocket.client}")
    
    try:
        await websocket.accept()
        print(f"✅ WebSocket connection accepted: session_id={session_id}")
        
        # Immediately send connection acknowledgment
        await websocket.send_text(json.dumps({
            "type": "connection.ack",
            "status": "connected",
            "message": "WebSocket connection established. Connecting to Azure Realtime..."
        }))
    except Exception as e:
        print(f"❌ WebSocket accept failed: {e}")
        return
    
    # Get user_id from auth if available
    user_id = "user_default"
    if authorization:
        try:
            decoded = verify_clerk_token(authorization.replace("Bearer ", ""))
            if decoded:
                user_id = decoded.get("sub") or decoded.get("user_id") or user_id
        except:
            pass
    
    # Get or create interview session state
    if session_id not in interview_sessions:
        # Initialize from query params or defaults
        interview_type = "mixed"
        difficulty = "mid"
        max_questions = 6
        
        # Try to get from query params
        query_params = dict(websocket.query_params)
        interview_type = query_params.get("type", interview_type)
        difficulty = query_params.get("difficulty", difficulty)
        max_questions = int(query_params.get("max_questions", max_questions))
        
        interview_sessions[session_id] = InterviewState(
            session_id=session_id,
            interview_type=interview_type,
            difficulty=difficulty,
            max_questions=max_questions
        )
    
    session_state = interview_sessions[session_id]
    
    # Build Azure OpenAI Realtime WebSocket URL
    if AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_API_KEY != "your-azure-openai-api-key-here":
        # Use Azure OpenAI
        endpoint = AZURE_OPENAI_ENDPOINT.rstrip("/")
        if not endpoint.startswith("http"):
            endpoint = f"https://{endpoint}"
        
        # Handle both endpoint patterns:
        # 1. Standard Azure OpenAI: https://{resource}.openai.azure.com
        # 2. Cognitive Services pattern: https://{region}.api.cognitive.microsoft.com
        # IMPORTANT: Use /openai/v1/realtime (not /openai/realtime) to match WebRTC pattern
        # Extract base hostname (same logic as WebRTC endpoint)
        try:
            resource_name, domain, region = extract_azure_endpoint_info(endpoint)
            base_endpoint = f"{resource_name}.openai.azure.com"
        except Exception as e:
            print(f"⚠️  Could not parse endpoint for WebSocket: {e}, using endpoint as-is")
            # Fallback: try to extract hostname manually
            from urllib.parse import urlparse
            parsed = urlparse(endpoint if endpoint.startswith(('http://', 'https://')) else f"https://{endpoint}")
            base_endpoint = parsed.netloc or endpoint.replace("https://", "").replace("http://", "").split("/")[0]
        
        # Build WebSocket URL using /openai/v1/realtime (consistent with WebRTC)
        # For GA versions (non-preview), api-version may not be required in URL
        if AZURE_OPENAI_API_VERSION and "-preview" not in AZURE_OPENAI_API_VERSION:
            ws_url = f"wss://{base_endpoint}/openai/v1/realtime?deployment={AZURE_OPENAI_DEPLOYMENT}"
        else:
            ws_url = f"wss://{base_endpoint}/openai/v1/realtime?deployment={AZURE_OPENAI_DEPLOYMENT}&api-version={AZURE_OPENAI_API_VERSION}"
        
        headers = {"api-key": AZURE_OPENAI_API_KEY}
    else:
        error_msg = (
            "Azure OpenAI API key not configured. "
            "Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in backend/.env file."
        )
        await websocket.close(code=1008, reason=error_msg)
        return
    
    try:
        # #region agent log
        import json as json_module
        import traceback
        try:
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:494","message":"Before websockets.connect","data":{"ws_url":ws_url,"headers_keys":list(headers.keys()) if headers else None,"headers_type":str(type(headers))},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + "\n")
        except: pass
        # #endregion
        # #region agent log
        try:
            with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:502","message":"Calling websockets.connect","data":{"ws_url":ws_url[:150],"headers_keys":list(headers.keys()) if headers else None,"subprotocols":["realtime"],"using_additional_headers":True},"sessionId":"debug-session","runId":"run1","hypothesisId":"D"}) + "\n")
        except: pass
        # #endregion
        print(f"🔗 Connecting to Azure OpenAI Realtime: {ws_url[:100]}...")
        
        # Send status update: starting Azure connection
        await websocket.send_text(json.dumps({
            "type": "azure.connecting",
            "status": "connecting",
            "message": "Connecting to Azure OpenAI Realtime..."
        }))
        
        # Add timeout for Azure connection
        try:
            azure_ws = await asyncio.wait_for(
                websockets.connect(
                    ws_url,
                    subprotocols=["realtime"],
                    additional_headers=headers
                ),
                timeout=10.0  # 10 second timeout for Azure connection
            )
            print(f"✅ Azure OpenAI Realtime WebSocket connected: session_id={session_id}")
            
            # Send status update: Azure connected
            await websocket.send_text(json.dumps({
                "type": "azure.connected",
                "status": "connected",
                "message": "Azure OpenAI Realtime connected. Initializing session..."
            }))
        except asyncio.TimeoutError:
            error_msg = "Azure OpenAI connection timeout after 10 seconds"
            print(f"❌ {error_msg}")
            print(f"❌ WebSocket URL: {ws_url}")
            print(f"❌ Headers: {list(headers.keys()) if headers else 'None'}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": {
                    "message": error_msg,
                    "code": "timeout",
                    "ws_url": ws_url,
                    "suggestion": "Check your Azure endpoint, deployment name, and API version"
                }
            }))
            # Keep connection open briefly to allow error message to be received
            await asyncio.sleep(1)
            return
        except websockets.exceptions.InvalidHandshake as e:
            error_msg = f"Azure OpenAI handshake failed: {str(e)}"
            print(f"❌ {error_msg}")
            print(f"❌ WebSocket URL: {ws_url}")
            print(f"❌ Headers: {list(headers.keys()) if headers else 'None'}")
            print(f"❌ This usually means: Wrong endpoint, wrong API key, or deployment not found")
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": {
                    "message": error_msg,
                    "code": "invalid_handshake",
                    "ws_url": ws_url,
                    "suggestion": "Verify AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT"
                }
            }))
            await asyncio.sleep(1)
            return
        except Exception as e:
            error_msg = f"Azure OpenAI connection failed: {str(e)}"
            print(f"❌ {error_msg}")
            print(f"❌ Error type: {type(e).__name__}")
            print(f"❌ WebSocket URL: {ws_url}")
            print(f"❌ Headers: {list(headers.keys()) if headers else 'None'}")
            import traceback
            print(f"❌ Traceback: {traceback.format_exc()}")
            await websocket.send_text(json.dumps({
                "type": "error",
                "error": {
                    "message": error_msg,
                    "code": type(e).__name__,
                    "ws_url": ws_url,
                    "full_error": str(e)
                }
            }))
            # Keep connection open briefly to allow error message to be received
            await asyncio.sleep(1)
            return
        
        try:
            async with azure_ws:
                # #region agent log
                try:
                    with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                        f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:503","message":"WebSocket connection successful","data":{},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}) + "\n")
                except: pass
                # #endregion
                
                # Session initialization
                system_prompt = _build_interviewer_system_prompt(session_state.interview_type, session_state.difficulty)
                
                # Step 1: Wait for session.created (Azure sends this automatically on connection)
                # Add timeout for first event
                try:
                    first_event_data = await asyncio.wait_for(azure_ws.recv(), timeout=5.0)
                    first_event = json.loads(first_event_data)
                except asyncio.TimeoutError:
                    print(f"❌ Timeout waiting for session.created from Azure")
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "error": "Azure OpenAI did not respond with session.created. Please check your Azure configuration."
                    }))
                    return
                
                if first_event.get("type") != "session.created":
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "error": f"Unexpected first event: {first_event.get('type')}"
                    }))
                    return
                
                # Forward session.created to client
                await websocket.send_text(json.dumps(first_event))
                print(f"✅ Azure session created")
                
                # Step 2: Send session.update with system prompt and audio configuration
                # CRITICAL: Use ONLY audio modality to prevent duplicate audio streams
                # IMPORTANT: Use audio.speed (not rate) - this is the correct field for OpenAI Realtime
                # CRITICAL: Strong English-only enforcement - MUST be first and most prominent
                english_only_instructions = """YOU MUST SPEAK ONLY IN ENGLISH. THIS IS MANDATORY.

LANGUAGE RULE #1: You are an English-only interviewer. You MUST respond ONLY in English.
LANGUAGE RULE #2: Never use Portuguese, Spanish, Hindi, French, German, Italian, Turkish, Chinese, Japanese, Korean, Arabic, or ANY other language.
LANGUAGE RULE #3: If the user speaks in another language, respond ONLY in English: "Please continue in English so I can evaluate your interview responses."
LANGUAGE RULE #4: Do NOT detect or respond to non-English languages - always respond in English.
LANGUAGE RULE #5: Never translate, never mirror user input language, never switch languages.
LANGUAGE RULE #6: Do NOT use greetings in other languages (no "Opa", "Hola", "Namaste", "Bonjour", "Ciao", etc.).
LANGUAGE RULE #7: ONLY English. ALWAYS English. NO EXCEPTIONS. NO OTHER LANGUAGE IS ALLOWED.

Speak slowly and clearly in English only. Maintain a calm, steady, interview-style pace. Avoid rushing.
Provide only one response per user turn. Never produce multiple responses.

""" + system_prompt
                
                session_update_payload = {
                    "type": "session.update",
                    "session": {
                        "type": "realtime",  # ✅ REQUIRED: Azure requires session.type
                        "modalities": ["audio"],  # ONLY audio - prevents text+audio duplicate streams
                        "input_audio_format": {"type": "pcm16", "sample_rate_hz": 24000},  # 24kHz input
                        "output_audio_format": {"type": "pcm16", "sample_rate_hz": 24000},  # 24kHz output - CRITICAL for correct playback speed
                        "voice": "alloy",
                        "audio": {
                            "voice": "alloy",
                            "speed": 0.6  # Slow, clear speech rate (0.6 = 60% of normal speed - clear and understandable)
                        },
                        "turn_detection": {
                            "type": "server_vad"
                        },
                        "instructions": english_only_instructions
                    }
                }
                
                # Log first 500 chars of instructions to verify English-only enforcement
                print(f"📝 Sending session.update with instructions (first 500 chars): {english_only_instructions[:500]}")
                
                await azure_ws.send(json.dumps(session_update_payload))
                
                # Step 3: Wait for session.updated confirmation
                try:
                    update_event = json.loads(await asyncio.wait_for(azure_ws.recv(), timeout=5.0))
                    if update_event.get("type") == "session.updated":
                        await websocket.send_text(json.dumps(update_event))
                        print(f"✅ Azure session updated")
                except asyncio.TimeoutError:
                    print(f"⚠️ Timeout waiting for session.updated, continuing anyway")
                
                # Step 4: Send initial greeting to start the interview
                await _send_initial_question(azure_ws, session_state)
                print(f"✅ Sent initial greeting")
                
                # Send ready status message
                await websocket.send_text(json.dumps({
                    "type": "ready",
                    "status": "ready",
                    "message": "Interview ready. You can start speaking."
                }))
                
                # Track current question/answer
                current_ai_text = []
                current_user_text = []
                waiting_for_response = False
                
                async def forward_to_azure():
                    """Forward client messages to Azure OpenAI."""
                    try:
                        while True:
                            try:
                                data = await websocket.receive_text()
                                msg = json.loads(data)
                                msg_type = msg.get("type")
                                
                                # Handle control messages
                                if msg_type == "input_audio_buffer.append":
                                    # Forward audio to Azure - log chunk size for debugging
                                    audio_data = msg.get("audio", "")
                                    if audio_data:
                                        audio_bytes = len(base64.b64decode(audio_data))
                                        if audio_bytes % 2 != 0:
                                            print(f"⚠️ Warning: Odd PCM chunk size: {audio_bytes} bytes")
                                    await azure_ws.send(data)
                                elif msg_type == "conversation.item.create":
                                    # User wants to start speaking - forward as-is
                                    await azure_ws.send(data)
                                elif msg_type == "response.create":
                                    # User wants AI to respond
                                    await azure_ws.send(data)
                                elif msg_type == "session.update":
                                    # Update session config
                                    await azure_ws.send(data)
                                elif msg_type == "end_interview":
                                    # User wants to end interview
                                    await _end_interview(azure_ws, session_state, websocket, user_id)
                                    break
                                elif msg_type == "gaze_metrics":
                                    # Store gaze metrics for current answer
                                    if session_state.current_answer and session_state.question_index is not None:
                                        session_state.add_gaze_metrics(
                                            session_state.question_index,
                                            msg.get("metrics", {})
                                        )
                                else:
                                    # Forward other messages
                                    await azure_ws.send(data)
                            except WebSocketDisconnect:
                                break
                            except Exception as e:
                                print(f"❌ Error forwarding to Azure: {e}")
                                import traceback
                                traceback.print_exc()
                                break
                    except WebSocketDisconnect:
                        pass
                    except Exception as e:
                        print(f"❌ Error in forward_to_azure: {e}")
                        import traceback
                        traceback.print_exc()
                
                async def forward_from_azure():
                    """Forward Azure messages to client and handle interview logic."""
                    nonlocal current_ai_text, current_user_text, waiting_for_response
                    try:
                        while True:
                            try:
                                data = await azure_ws.recv()
                                if isinstance(data, bytes):
                                    # Audio data - forward as-is
                                    await websocket.send_bytes(data)
                                else:
                                    # Text message
                                    event = json.loads(data)
                                    event_type = event.get("type")
                                    
                                    # Forward to client
                                    await websocket.send_text(data)
                                    
                                    # Log transcript-related messages
                                    if event_type in ["response.text.delta", "response.text.done", 
                                                      "conversation.item.input_audio_transcription.completed"]:
                                        print(f"📝 Transcript event: {event_type}")
                                        if "transcript" in event:
                                            transcript_text = str(event.get("transcript", ""))[:100]
                                            print(f"   Transcript text: {transcript_text}")
                                        if "delta" in event:
                                            delta_text = str(event.get("delta", ""))[:100]
                                            print(f"   Text delta: {delta_text}")
                                    
                                    # Handle interview logic
                                    if event_type == "response.text.delta":
                                        # AI is speaking - accumulate text
                                        delta = event.get("delta", "")
                                        if delta:
                                            current_ai_text.append(delta)
                                    
                                    elif event_type == "response.text.done":
                                        # AI finished speaking - this is a question
                                        full_text = "".join(current_ai_text)
                                        if full_text:
                                            session_state.add_question(full_text)
                                            current_ai_text = []
                                            waiting_for_response = True
                                    
                                    elif event_type == "input_audio_buffer.committed":
                                        # User audio committed - transcript may be in this event or separate
                                        transcript = event.get("transcript", "")
                                        if transcript and waiting_for_response:
                                            current_user_text.append(transcript)
                                    
                                    elif event_type == "conversation.item.input_audio_transcription.completed":
                                        # User transcript is complete - accumulate
                                        transcript = event.get("transcript", "")
                                        if transcript and waiting_for_response:
                                            current_user_text.append(transcript)
                                    
                                    elif event_type == "conversation.item.completed":
                                        # User finished speaking - evaluate the complete answer
                                        if current_user_text and waiting_for_response and session_state.current_question:
                                            full_answer = " ".join(current_user_text).strip()
                                            if full_answer and len(full_answer) > 10:  # Minimum answer length
                                                session_state.add_answer(full_answer)
                                                
                                                # Evaluate response
                                                evaluation = evaluate_response(
                                                    full_answer,
                                                    session_state.interview_type,
                                                    {"question": session_state.current_question}
                                                )
                                                session_state.add_evaluation(evaluation)
                                                
                                                # Determine next action
                                                next_action = session_state.get_next_action(evaluation)
                                                
                                                # Generate next question or end
                                                if session_state.should_end():
                                                    await _end_interview(azure_ws, session_state, websocket, user_id)
                                                else:
                                                    await _handle_next_action(azure_ws, session_state, next_action, evaluation)
                                            
                                            current_user_text = []
                                            waiting_for_response = False
                                    
                                    elif event_type == "error":
                                        await websocket.send_text(json.dumps({
                                            "type": "error",
                                            "error": event.get("error", {}).get("message", "Unknown error")
                                        }))
                            except websockets.exceptions.ConnectionClosed:
                                break
                            except Exception as e:
                                print(f"Error receiving from Azure: {e}")
                                break
                    except Exception as e:
                        print(f"Error in forward_from_azure: {e}")
                
                try:
                    await asyncio.gather(
                        forward_to_azure(),
                        forward_from_azure(),
                        return_exceptions=True
                    )
                except Exception as e:
                    await websocket.close(code=1011, reason=f"Connection error: {str(e)}")
        except websockets.exceptions.InvalidURI as e:
            # #region agent log
            import json as json_module
            import traceback
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:695","message":"InvalidURI exception","data":{"error":str(e),"error_type":"InvalidURI"},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}) + "\n")
            except: pass
            # #endregion
            await websocket.close(code=1008, reason=f"Invalid endpoint: {str(e)}")
        except websockets.exceptions.InvalidHandshake as e:
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:697","message":"InvalidHandshake exception","data":{"error":str(e),"error_type":"InvalidHandshake"},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}) + "\n")
            except: pass
            # #endregion
            await websocket.close(code=1008, reason=f"Authentication failed: {str(e)}")
        except Exception as e:
            # #region agent log
            import json as json_module
            import traceback
            try:
                error_trace = traceback.format_exc()
                error_str = str(e)
                # Log full error details
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json_module.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:699","message":"General exception in WebSocket connection","data":{"error":error_str,"error_type":type(e).__name__,"traceback":error_trace,"ws_url":ws_url[:100] if 'ws_url' in locals() else None,"headers":str(headers) if 'headers' in locals() else None},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}) + "\n")
                # Also print to console for immediate visibility
                print(f"ERROR in interview_realtime_websocket: {error_str}")
                print(f"Traceback: {error_trace}")
            except Exception as log_err:
                print(f"Failed to log error: {log_err}")
            # #endregion
            await websocket.close(code=1011, reason=f"Connection failed: {str(e)}")
    finally:
        # Clean up session if interview ended
        if session_id in interview_sessions and not interview_sessions[session_id].is_active:
            del interview_sessions[session_id]


def _build_interviewer_system_prompt(
    interview_type: str,
    difficulty: str,
    role: Optional[str] = None,
    company: Optional[str] = None,
    job_level: Optional[str] = None,
    question_mix: Optional[str] = None,
    interview_style: Optional[str] = None
) -> str:
    """Build system prompt for the interviewer agent."""
    # ⚠️ CRITICAL: ENGLISH-ONLY RULES MUST BE FIRST - HIGHEST PRIORITY
    base_prompt = """🚨🚨🚨 CRITICAL LANGUAGE REQUIREMENT - READ THIS FIRST 🚨🚨🚨

YOU MUST SPEAK ONLY IN ENGLISH. THIS IS THE ABSOLUTE HIGHEST PRIORITY RULE. NO EXCEPTIONS.

LANGUAGE RULE #1: You are an English-only interviewer. You MUST respond ONLY in English. This is non-negotiable.
LANGUAGE RULE #2: NEVER use Portuguese, Spanish, Hindi, French, German, Italian, Turkish, Chinese, Japanese, Korean, Arabic, or ANY other language.
LANGUAGE RULE #3: NEVER translate user input to another language.
LANGUAGE RULE #4: NEVER mirror the user's language if they speak in a non-English language.
LANGUAGE RULE #5: If the user speaks in another language, respond ONLY in English with: "Please continue in English so I can evaluate your interview responses."
LANGUAGE RULE #6: Do NOT detect or respond to non-English languages - always respond in English.
LANGUAGE RULE #7: Do NOT switch languages under any circumstances.
LANGUAGE RULE #8: Do NOT use greetings in other languages (no "Opa", "Hola", "Namaste", "Bonjour", "Ciao", "Olá", etc.).
LANGUAGE RULE #9: ONLY English. ALWAYS English. NO EXCEPTIONS. NO OTHER LANGUAGE IS ALLOWED.

REMEMBER: Every single word you speak must be in English. Every response must be in English. There are no exceptions to this rule. Your first words must be in English. Your greeting must be in English. Everything must be in English.

---

You are Sonia, a professional interviewer conducting a formal job interview. Your name is Sonia. This is NOT a casual conversation. You are evaluating a candidate for a position.
    
IMPORTANT: You must introduce yourself as Sonia at the start of the interview. Say: "Hello, I'm Sonia, and I'll be conducting your interview today." (IN ENGLISH ONLY)

CRITICAL: You are conducting an INTERVIEW, not having a friendly chat. Your role is to:
- Ask professional interview questions
- Assess the candidate's qualifications, experience, and fit
- Probe deeper into their answers
- Maintain professional boundaries
- Evaluate their communication skills, problem-solving abilities, and technical knowledge

You are an English-only interview coach. You respond with one clear, concise English response per user turn. Never speak multiple languages. Never produce more than one response. Never repeat the same answer.

You are a single interviewer agent conducting a professional interview.
You must produce strictly one response per user turn.
Never generate more than one answer for a single input.
Never overlap or interrupt yourself.

Maintain a calm, slow speaking pace suitable for interviews.
Avoid short greetings or filler sentences.
Do not reset, do not switch personas.

## Your Personality
- Professional and focused on the interview objectives
- Warm but business-appropriate - like a hiring manager, not a friend
- Encouraging but maintains professional distance
- Ask follow-up questions to assess depth ("Can you give me a specific example?", "How did you handle that situation?", "What was the outcome?")
- Do NOT engage in casual small talk or friendly banter

## Interview Rules
1. Ask ONE professional interview question at a time - never multiple questions
2. Produce ONE response per user turn - never multiple responses
3. Listen carefully and ask thoughtful follow-up questions based on their specific answers
4. Use their name if they introduce themselves
5. Acknowledge their answers professionally before moving on ("Thank you for that example. Can you tell me more about...")
6. Ask behavioral questions (STAR method: Situation, Task, Action, Result) or technical questions based on interview type
7. If they give a short answer, probe deeper with "Can you walk me through a specific example?" or "What was your role in that project?" or "How did you measure success?"
8. If they seem nervous, be encouraging but maintain professional tone
9. Focus on their work experience, skills, problem-solving abilities, and achievements
10. Do NOT engage in casual small talk - keep the conversation focused on interview topics

## What You're Assessing (but don't tell them):
- Communication clarity and confidence
- Problem-solving approach
- Self-awareness and growth mindset
- Technical depth (if applicable)
- Cultural fit and collaboration style

## Do NOT:
- Give feedback or scores during the interview
- Ask multiple questions at once
- Generate multiple responses for a single user turn
- Overlap or interrupt yourself
- Sound scripted or robotic
- Rush through questions
- Interrupt them
- Switch languages or translate
- Mirror user input language
- Use any language other than English
- Engage in casual conversation or small talk
- Use informal greetings like "Hey", "Hi there", "Great to hear from you"
- Ask casual questions like "How's it going?" or "What's on your mind?"
- Treat this like a friendly chat - maintain professional interview tone at all times

    """
    
    # Add role and company context if provided
    if role:
        base_prompt += f"\nYou are interviewing for a {role} position."
    if company:
        base_prompt += f" This interview is for {company}."
    
    # Add job level context
    if job_level:
        level_context = {
            "intern": "This is an intern-level position. Focus on learning ability, enthusiasm, and potential.",
            "junior": "This is a junior-level position. Focus on foundational skills, willingness to learn, and basic experience.",
            "mid": "This is a mid-level position. Focus on solid experience, problem-solving skills, and ability to work independently.",
            "senior": "This is a senior-level position. Focus on deep expertise, leadership, architecture decisions, and mentoring ability."
        }
        base_prompt += f"\n{level_context.get(job_level, '')}"
    
    # Add interview style
    if interview_style:
        style_context = {
            "friendly": "Maintain a warm, encouraging, and supportive tone. Make the candidate feel comfortable while still being professional.",
            "neutral": "Maintain a professional, balanced tone. Be fair and objective in your assessment.",
            "strict": "Maintain a formal, rigorous tone. Challenge the candidate appropriately and expect detailed, well-structured answers."
        }
        base_prompt += f"\n{style_context.get(interview_style, '')}"
    
    # Add question mix focus
    if question_mix:
        mix_context = {
            "technical": "Focus primarily on technical questions. Ask about programming concepts, system design, algorithms, and technical problem-solving.",
            "behavioral": "Focus primarily on behavioral questions. Ask about past experiences, teamwork, challenges, and how they handle situations.",
            "balanced": "Balance technical and behavioral questions. Mix both types naturally throughout the interview.",
            "custom": "Adapt your question mix based on the candidate's responses and the role requirements."
        }
        base_prompt += f"\n{mix_context.get(question_mix, '')}"
    
    base_prompt += "\n"
    
    if interview_type == "behavioral":
        base_prompt += """## Focus: Behavioral Interview
Ask about real experiences using the STAR framework (but don't mention STAR to them).

Good behavioral questions:
- "Tell me about a time when you faced a significant challenge at work. What happened?"
- "Describe a situation where you had to work with a difficult team member."
- "Walk me through a project you're most proud of. What was your role?"
- "Tell me about a mistake you made and what you learned from it."
- "Describe a time you had to make a decision with incomplete information."

Probe for specifics: their exact actions, the outcome, what they learned.
"""
    elif interview_type == "technical":
        base_prompt += f"""## Focus: Technical Interview ({difficulty} level)
Balance conceptual understanding with practical application.

Good technical questions for {difficulty} level:
- "How would you explain [concept] to a junior developer?"
- "Walk me through how you'd approach building [system]."
- "What's the difference between X and Y? When would you use each?"
- "Tell me about a technical challenge you solved recently."
- "How do you stay current with technology trends?"

Probe for depth: "Why did you choose that approach?" "What are the tradeoffs?"
"""
    else:  # mixed
        base_prompt += f"""## Focus: Mixed Interview ({difficulty} level)
Blend behavioral and technical questions naturally.

Start with background, then alternate:
1. "Tell me about yourself and what excites you about this field."
2. Follow up on something technical they mention
3. Ask about a challenging project (behavioral)
4. Probe technical aspects of that project
5. Ask about collaboration/teamwork
6. End with their career goals

Make it feel like a natural conversation, not a checklist.
"""
    
    return base_prompt


async def _send_initial_question(azure_ws, session_state: InterviewState):
    """Send the initial greeting/question to start the interview."""
    # Professional interview greeting
    if session_state.interview_type == "behavioral":
        greeting = "Hello, thank you for joining me today. I'm conducting a behavioral interview to learn more about your experiences and how you handle various situations. To begin, could you please introduce yourself and tell me about your current role and your most significant professional achievement?"
    elif session_state.interview_type == "technical":
        greeting = "Hello, welcome to the technical interview. I'll be asking you about your technical background and problem-solving approach. To start, could you please tell me about yourself, your technical experience, and describe a challenging technical problem you've solved recently?"
    else:
        greeting = "Hello, thank you for joining me today. This will be a mixed interview covering both behavioral and technical aspects. To begin, could you please introduce yourself and tell me about your background, current role, and what you consider your strongest technical skill?"
    
    await azure_ws.send(json.dumps({
        "type": "response.create",
        "response": {
            # ✅ REMOVED: modalities belong in session.update, not response.create
            "instructions": greeting
        }
    }))


async def _handle_next_action(azure_ws, session_state: InterviewState, action: NextAction, evaluation: Dict):
    """Handle the next action based on evaluation."""
    if action == NextAction.MOVE_ON:
        session_state.move_to_next_question()
        # Generate next question
        question = _generate_next_question(session_state)
        await azure_ws.send(json.dumps({
            "type": "response.create",
            "response": {
                # ✅ REMOVED: modalities belong in session.update, not response.create
                "instructions": question
            }
        }))
    elif action == NextAction.PROBE_DEEPER:
        follow_up = "Can you provide more specific details about that? What was the impact or outcome?"
        await azure_ws.send(json.dumps({
            "type": "response.create",
            "response": {
                # ✅ REMOVED: modalities belong in session.update, not response.create
                "instructions": follow_up
            }
        }))
    elif action == NextAction.CLARIFY:
        follow_up = "I want to make sure I understand. Could you clarify that point?"
        await azure_ws.send(json.dumps({
            "type": "response.create",
            "response": {
                # ✅ REMOVED: modalities belong in session.update, not response.create
                "instructions": follow_up
            }
        }))
    elif action == NextAction.REDIRECT:
        follow_up = "Let me refocus the question. " + _generate_next_question(session_state)
        await azure_ws.send(json.dumps({
            "type": "response.create",
            "response": {
                # ✅ REMOVED: modalities belong in session.update, not response.create
                "instructions": follow_up
            }
        }))
    elif action == NextAction.RAISE_BAR:
        session_state.move_to_next_question()
        question = _generate_next_question(session_state, harder=True)
        await azure_ws.send(json.dumps({
            "type": "response.create",
            "response": {
                # ✅ REMOVED: modalities belong in session.update, not response.create
                "instructions": question
            }
        }))


def _generate_next_question(session_state: InterviewState, harder: bool = False) -> str:
    """Generate the next question based on interview type and progress."""
    questions = {
        "behavioral": [
            "How do you handle tight deadlines?",
            "Describe a time when you had to learn a new technology quickly.",
            "How do you handle conflicts in a team?",
            "Tell me about a time you made a mistake and how you handled it.",
            "What motivates you in your work?",
        ],
        "technical": [
            "What is the time complexity of quicksort algorithm?",
            "How would you implement a binary search tree?",
            "Describe the concept of closures in programming.",
            "How would you design a scalable chat application?",
            "Explain the difference between REST and GraphQL.",
        ],
        "mixed": [
            "Describe your experience with version control systems.",
            "How do you approach debugging complex issues?",
            "Tell me about a time you optimized code performance.",
            "How do you stay updated with new technologies?",
            "Describe your testing methodology.",
        ]
    }
    
    q_list = questions.get(session_state.interview_type, questions["mixed"])
    idx = session_state.question_index % len(q_list)
    return q_list[idx]


async def _end_interview(azure_ws, session_state: InterviewState, client_ws: WebSocket, user_id: str):
    """End the interview and generate report."""
    session_state.end_interview()
    
    # Send closing message
    await azure_ws.send(json.dumps({
        "type": "response.create",
        "response": {
            # ✅ REMOVED: modalities belong in session.update, not response.create
            "instructions": "Thank you for your time. The interview is now complete. We'll prepare your feedback report."
        }
    }))
    
    # Calculate duration
    duration = (datetime.now() - session_state.start_time).total_seconds() / 60
    
    # Generate report
    try:
        report = generate_interview_report(
            session_state,
            session_state.interview_type,
            int(duration)
        )
        
        # Set user_id from session
        report.user_id = user_id
        
        # Store report
        interview_reports[report.id] = report
        
        # Send report ID to client
        await client_ws.send_text(json.dumps({
            "type": "interview.completed",
            "report_id": report.id
        }))
    except Exception as e:
        print(f"Error generating report: {e}")
        await client_ws.send_text(json.dumps({
            "type": "error",
            "error": "Failed to generate report. Please try again."
        }))

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

def get_clerk_jwks():
    clerk_publishable_key = os.getenv("CLERK_PUBLISHABLE_KEY", "")
    if not clerk_publishable_key:
        return None
    
    instance_id = None
    if "_" in clerk_publishable_key:
        parts = clerk_publishable_key.split("_")
        if len(parts) >= 3:
            instance_id = parts[2]
    
    if not instance_id:
        return None
    
    jwks_url = f"https://{instance_id}.clerk.accounts.dev/.well-known/jwks.json"
    try:
        response = requests.get(jwks_url, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception:
        return None

def verify_clerk_token(token: str) -> Optional[Dict]:
    if not CLERK_SECRET_KEY:
        return None
    
    try:
        try:
            decoded = jwt.decode(token, CLERK_SECRET_KEY, algorithms=["HS256"])
            return decoded
        except jwt.InvalidTokenError:
            pass
        
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        
        if kid:
            jwks = get_clerk_jwks()
            if jwks:
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        try:
                            from jwt.algorithms import RSAAlgorithm
                            public_key = RSAAlgorithm.from_jwk(json.dumps(key))
                            decoded = jwt.decode(token, public_key, algorithms=["RS256"])
                            return decoded
                        except Exception:
                            pass
        
        try:
            decoded = jwt.decode(token, CLERK_SECRET_KEY, algorithms=["RS256"])
            return decoded
        except jwt.InvalidTokenError:
            return None
            
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None

personality_reports: Dict[str, PersonalityReport] = {}
interview_reports: Dict[str, InterviewReport] = {}

def init_sample_reports():
    sample_reports = [
        InterviewReport(
            id="sample-1",
            user_id="sample",
            title="Full Technical Interview",
            date=datetime(2025, 11, 10),
            type="Mixed",
            mode="Full Interview",
            duration="32 minutes",
            overall_score=85,
            scores=ScoreBreakdown(
                communication=88,
                clarity=82,
                structure=90,
                technical_depth=83,
                relevance=85
            ),
            transcript=[
                TranscriptMessage(
                    speaker="Interviewer",
                    text="Tell me about a time when you had to work with a difficult team member.",
                    timestamp=datetime(2025, 11, 10, 10, 0, 0)
                ),
                TranscriptMessage(
                    speaker="You",
                    text="In my previous role, I worked with a colleague who was resistant to change. I scheduled one-on-one meetings to understand their concerns and found common ground. We eventually became strong collaborators on the project.",
                    timestamp=datetime(2025, 11, 10, 10, 1, 0)
                ),
            ],
            recommendations=[
                "Consider using more specific metrics when describing technical achievements",
                "Structure your answers using the STAR method more consistently",
                "Good job maintaining eye contact throughout the interview",
            ],
            questions=6,
            is_sample=True
        ),
        InterviewReport(
            id="sample-2",
            user_id="sample",
            title="Behavioral Questions",
            date=datetime(2025, 11, 7),
            type="Behavioral",
            mode="Full Interview",
            duration="28 minutes",
            overall_score=92,
            scores=ScoreBreakdown(
                communication=95,
                clarity=90,
                structure=93,
                relevance=90
            ),
            transcript=[
                TranscriptMessage(
                    speaker="Interviewer",
                    text="Describe a challenging project you led.",
                    timestamp=datetime(2025, 11, 7, 14, 0, 0)
                ),
                TranscriptMessage(
                    speaker="You",
                    text="I led a project to migrate our legacy system to a modern cloud architecture. The main challenge was ensuring zero downtime during the migration. I coordinated with multiple teams and created a detailed migration plan with rollback procedures.",
                    timestamp=datetime(2025, 11, 7, 14, 1, 0)
                ),
            ],
            recommendations=[
                "Excellent use of the STAR method",
                "Consider adding more quantifiable results",
                "Great communication and clarity",
            ],
            questions=5,
            is_sample=True
        ),
        InterviewReport(
            id="sample-3",
            user_id="sample",
            title="One-Question Drill: STAR",
            date=datetime(2025, 11, 5),
            type="Behavioral",
            mode="Drill",
            duration="8 minutes",
            overall_score=78,
            scores=ScoreBreakdown(
                communication=80,
                clarity=75,
                structure=82,
                relevance=75
            ),
            transcript=[
                TranscriptMessage(
                    speaker="Interviewer",
                    text="Tell me about a time you had to resolve a conflict.",
                    timestamp=datetime(2025, 11, 5, 11, 0, 0)
                ),
                TranscriptMessage(
                    speaker="You",
                    text="I once had a disagreement with a teammate about the approach to a feature. We sat down, discussed both perspectives, and found a middle ground that incorporated the best of both ideas.",
                    timestamp=datetime(2025, 11, 5, 11, 1, 0)
                ),
            ],
            recommendations=[
                "Add more specific details about the conflict resolution process",
                "Include the outcome and what you learned",
                "Practice structuring answers more clearly",
            ],
            questions=1,
            is_sample=True
        ),
        InterviewReport(
            id="sample-4",
            user_id="sample",
            title="System Design Interview",
            date=datetime(2025, 11, 3),
            type="Technical",
            mode="Full Interview",
            duration="45 minutes",
            overall_score=88,
            scores=ScoreBreakdown(
                communication=85,
                clarity=90,
                structure=92,
                technical_depth=90,
                relevance=85
            ),
            transcript=[
                TranscriptMessage(
                    speaker="Interviewer",
                    text="Design a scalable chat application.",
                    timestamp=datetime(2025, 11, 3, 15, 0, 0)
                ),
                TranscriptMessage(
                    speaker="You",
                    text="I would start by identifying the core requirements: real-time messaging, user authentication, message persistence, and scalability. I'd use WebSockets for real-time communication, a message queue for handling high load, and a distributed database for storage.",
                    timestamp=datetime(2025, 11, 3, 15, 2, 0)
                ),
            ],
            recommendations=[
                "Excellent technical depth",
                "Consider discussing trade-offs more explicitly",
                "Great use of system design principles",
            ],
            questions=4,
            is_sample=True
        ),
        InterviewReport(
            id="sample-5",
            user_id="sample",
            title="Communication Drill",
            date=datetime(2025, 10, 30),
            type="Mixed",
            mode="Drill",
            duration="12 minutes",
            overall_score=81,
            scores=ScoreBreakdown(
                communication=85,
                clarity=80,
                structure=82,
                relevance=77
            ),
            transcript=[
                TranscriptMessage(
                    speaker="Interviewer",
                    text="Explain a complex technical concept to a non-technical audience.",
                    timestamp=datetime(2025, 10, 30, 9, 0, 0)
                ),
                TranscriptMessage(
                    speaker="You",
                    text="I would use analogies and avoid jargon. For example, explaining APIs as a waiter in a restaurant who takes your order and brings it to the kitchen, then returns with your food.",
                    timestamp=datetime(2025, 10, 30, 9, 1, 0)
                ),
            ],
            recommendations=[
                "Good use of analogies",
                "Practice simplifying complex topics further",
                "Maintain eye contact when explaining",
            ],
            questions=1,
            is_sample=True
        ),
    ]
    
    for report in sample_reports:
        interview_reports[report.id] = report

init_sample_reports()

def get_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not CLERK_SECRET_KEY:
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
            decoded = verify_clerk_token(token)
            if decoded:
                user_id = decoded.get("sub") or decoded.get("user_id")
                if user_id:
                    return user_id
        return "user_default"
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "")
    decoded = verify_clerk_token(token)
    
    if decoded:
        user_id = decoded.get("sub") or decoded.get("user_id")
        if user_id:
            return user_id
    
    raise HTTPException(status_code=401, detail="Invalid or expired token")

@app.post("/api/self-insight/assessments")
async def create_assessment(request: CreateAssessmentRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    if len(request.answers) < 40:
        raise HTTPException(status_code=400, detail="At least 40 questions must be answered")
    
    answers_dict = [{"questionId": a.questionId, "value": a.value} for a in request.answers]
    report = generate_report(user_id, answers_dict)
    
    personality_reports[report.id] = report
    
    return {"reportId": report.id}

@app.get("/api/self-insight/reports")
async def list_reports(authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    user_reports = [r for r in personality_reports.values() if r.user_id == user_id]
    user_reports.sort(key=lambda x: x.created_at, reverse=True)
    
    summaries = []
    for report in user_reports:
        top_traits = sorted(report.trait_scores, key=lambda x: x.score, reverse=True)[:3]
        tags = [f"{'High' if ts.level == 'HIGH' else 'Low'} {ts.trait.replace('_', ' ')}" for ts in top_traits]
        
        summaries.append({
            "id": report.id,
            "createdAt": report.created_at.isoformat(),
            "title": report.title,
            "tags": tags
        })
    
    return summaries

@app.get("/api/self-insight/reports/{report_id}")
async def get_report(report_id: str, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    if report_id not in personality_reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = personality_reports[report_id]
    
    if report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return report

@app.patch("/api/self-insight/reports/{report_id}/reflections")
async def update_reflections(report_id: str, request: UpdateReflectionsRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    if report_id not in personality_reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = personality_reports[report_id]
    
    if report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    report.reflections.strengths = request.strengths
    report.reflections.development = request.development
    
    return {"success": True}

@app.get("/api/self-insight/reports/{report_id}/pdf")
async def get_report_pdf(report_id: str, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    if report_id not in personality_reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = personality_reports[report_id]
    
    if report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor='#FF6B35',
        spaceAfter=30,
        alignment=TA_CENTER
    )
    story.append(Paragraph(report.title, title_style))
    story.append(Spacer(1, 0.3*inch))
    
    date_style = ParagraphStyle(
        'DateStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor='#666666',
        alignment=TA_CENTER
    )
    story.append(Paragraph(f"Generated on {report.created_at.strftime('%B %d, %Y')}", date_style))
    story.append(Spacer(1, 0.4*inch))
    
    story.append(Paragraph("<b>Understanding this report</b>", styles['Heading2']))
    story.append(Spacer(1, 0.1*inch))
    intro_text = (
        "This report provides insights into your working style based on your responses to the personality assessment. "
        "It is not a pass/fail test, but rather a tool for self-reflection and understanding. "
        "Use these insights to better understand your strengths, development areas, and how you might adapt your work style."
    )
    story.append(Paragraph(intro_text, styles['Normal']))
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("<b>Your Personality</b>", styles['Heading2']))
    story.append(Spacer(1, 0.2*inch))
    
    domains = {}
    for ts in report.trait_scores:
        if ts.domain not in domains:
            domains[ts.domain] = []
        domains[ts.domain].append(ts)
    
    for domain, traits in domains.items():
        domain_name = domain.replace("_", " ").title()
        story.append(Paragraph(f"<b>{domain_name}</b>", styles['Heading3']))
        for ts in traits:
            level_text = f"<b>{ts.level}</b>"
            trait_text = f"{ts.trait.replace('_', ' ')}: {level_text} (Score: {ts.score:.2f}/5.0)"
            story.append(Paragraph(trait_text, styles['Normal']))
        story.append(Spacer(1, 0.1*inch))
    
    story.append(PageBreak())
    
    story.append(Paragraph("<b>Your Development</b>", styles['Heading2']))
    story.append(Spacer(1, 0.2*inch))
    for area in report.development_areas:
        story.append(Paragraph(f"<b>{area.trait.replace('_', ' ')}</b>", styles['Heading3']))
        story.append(Paragraph(area.description, styles['Normal']))
        story.append(Spacer(1, 0.1*inch))
        for suggestion in area.suggestions:
            story.append(Paragraph(f"• {suggestion}", styles['Normal']))
        story.append(Spacer(1, 0.15*inch))
    
    story.append(PageBreak())
    
    story.append(Paragraph("<b>Your Career Choices</b>", styles['Heading2']))
    story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("<b>You may thrive in roles where:</b>", styles['Heading3']))
    for item in report.career_fit_thrives:
        story.append(Paragraph(f"• {item.description}", styles['Normal']))
    
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph("<b>You may need to work harder when:</b>", styles['Heading3']))
    for item in report.career_fit_challenges:
        story.append(Paragraph(f"• {item.description}", styles['Normal']))
    
    story.append(PageBreak())
    
    story.append(Paragraph("<b>Adapting Your Work Style</b>", styles['Heading2']))
    story.append(Spacer(1, 0.2*inch))
    for tip in report.work_style_tips:
        story.append(Paragraph(f"<b>{tip.title}</b>", styles['Heading3']))
        story.append(Paragraph(tip.description, styles['Normal']))
        story.append(Spacer(1, 0.15*inch))
    
    if report.reflections.strengths or report.reflections.development:
        story.append(PageBreak())
        story.append(Paragraph("<b>Your Reflections</b>", styles['Heading2']))
        story.append(Spacer(1, 0.2*inch))
        
        if report.reflections.strengths:
            story.append(Paragraph("<b>My key strengths:</b>", styles['Heading3']))
            story.append(Paragraph(report.reflections.strengths, styles['Normal']))
            story.append(Spacer(1, 0.15*inch))
        
        if report.reflections.development:
            story.append(Paragraph("<b>My development priorities:</b>", styles['Heading3']))
            story.append(Paragraph(report.reflections.development, styles['Normal']))
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        BytesIO(buffer.read()),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="personality-report-{report_id}.pdf"'}
    )

@app.get("/api/interview/reports")
async def list_interview_reports(authorization: Optional[str] = Header(None)):
    user_id = None
    try:
        user_id = get_user_id(authorization)
    except HTTPException as e:
        # If authentication fails, still return sample reports
        # Log the error but don't fail the request
        print(f"Authentication failed for reports request: {e.detail}")
        user_id = None
    except Exception as e:
        # Catch any other exceptions
        print(f"Error getting user_id: {str(e)}")
        user_id = None
    
    # Always include sample reports, plus user's own reports if authenticated
    if user_id:
        user_reports = [r for r in interview_reports.values() if r.user_id == user_id or r.is_sample]
    else:
        # If not authenticated, only return sample reports
        user_reports = [r for r in interview_reports.values() if r.is_sample]
    
    user_reports.sort(key=lambda x: x.date, reverse=True)
    
    summaries = []
    for report in user_reports:
        summaries.append(InterviewReportSummary(
            id=report.id,
            title=report.title,
            date=report.date,
            type=report.type,
            mode=report.mode,
            score=report.overall_score,
            questions=report.questions,
            is_sample=report.is_sample
        ))
    
    return summaries

@app.get("/api/interview/reports/{report_id}")
async def get_interview_report(report_id: str, authorization: Optional[str] = Header(None)):
    # Handle authentication gracefully (like list endpoint)
    user_id = None
    try:
        user_id = get_user_id(authorization)
    except HTTPException as e:
        # If authentication fails, still allow access to sample reports
        print(f"Authentication failed for report request: {e.detail}")
        user_id = None
    except Exception as e:
        print(f"Error getting user_id: {str(e)}")
        user_id = None
    
    if report_id not in interview_reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = interview_reports[report_id]
    
    # Allow access if:
    # 1. It's a sample report (anyone can view)
    # 2. User is authenticated and owns the report
    # 3. No auth but report exists (for development/testing)
    if not report.is_sample and user_id and report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return report

@app.post("/api/interview/reports")
async def create_interview_report(request: CreateInterviewReportRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    report_id = str(uuid.uuid4())
    report = InterviewReport(
        id=report_id,
        user_id=user_id,
        title=request.title,
        date=datetime.now(),
        type=request.type,
        mode=request.mode,
        duration=request.duration,
        overall_score=request.overall_score,
        scores=request.scores,
        transcript=request.transcript,
        recommendations=request.recommendations,
        questions=request.questions,
        is_sample=False
    )
    
    interview_reports[report_id] = report
    
    return {"id": report_id}

@app.post("/api/interview/{session_id}/transcript")
async def save_interview_transcript(session_id: str, request: Dict):
    """Save interview transcript to file with session ID."""
    try:
        transcript = request.get("transcript", [])
        
        if not transcript:
            return {"message": "No transcript data provided", "session_id": session_id}
        
        # Create transcripts directory if it doesn't exist
        transcripts_dir = os.path.join(os.path.dirname(__file__), "transcripts")
        os.makedirs(transcripts_dir, exist_ok=True)
        
        # Generate filename with session ID and timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_base = f"transcript_{session_id}_{timestamp}"
        
        # Save as JSON (structured data)
        json_filename = os.path.join(transcripts_dir, f"{filename_base}.json")
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump({
                "session_id": session_id,
                "timestamp": datetime.now().isoformat(),
                "transcript": transcript
            }, f, indent=2, ensure_ascii=False)
        
        # Save as readable text file
        text_filename = os.path.join(transcripts_dir, f"{filename_base}.txt")
        with open(text_filename, 'w', encoding='utf-8') as f:
            f.write(f"Interview Transcript - Session ID: {session_id}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            for entry in transcript:
                speaker = entry.get("speaker", "Unknown")
                text = entry.get("text", "")
                timestamp_str = entry.get("timestamp", "")
                
                # Format timestamp if it's an ISO string
                if timestamp_str:
                    try:
                        if isinstance(timestamp_str, str):
                            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            timestamp_str = dt.strftime('%H:%M:%S')
                    except:
                        pass
                
                f.write(f"[{timestamp_str}] {speaker.upper()}:\n")
                f.write(f"{text}\n\n")
        
        print(f"✅ Transcript saved for session {session_id}")
        print(f"   JSON: {json_filename}")
        print(f"   Text: {text_filename}")
        
        return {
            "message": "Transcript saved successfully",
            "session_id": session_id,
            "files": {
                "json": json_filename,
                "text": text_filename
            }
        }
    
    except Exception as e:
        print(f"❌ Error saving transcript: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save transcript: {str(e)}")

# Gaze tracking WebSocket endpoint
class EMA:
    """Exponential Moving Average for smoothing metrics"""
    def __init__(self, alpha=0.3):
        self.alpha = alpha
        self.value = None
    
    def update(self, x):
        if self.value is None:
            self.value = x
        else:
            self.value = self.alpha * x + (1 - self.alpha) * self.value
        return self.value

def simple_eye_contact_detection(frame):
    """Simplified eye contact detection using OpenCV face detection"""
    if not CV2_AVAILABLE:
        # Return mock data if OpenCV not available
        return {
            "eyeContact": True,
            "blink": False,
            "conf": 0.8,
            "earLeft": 0.25,
            "earRight": 0.25
        }
    
    try:
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Load face detector
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) == 0:
            return {
                "eyeContact": False,
                "blink": False,
                "conf": 0.0,
                "earLeft": 0.0,
                "earRight": 0.0
            }
        
        # Take the largest face
        (x, y, w, h) = max(faces, key=lambda f: f[2] * f[3])
        
        # Simple eye region extraction
        eye_height = int(h * 0.25)
        left_eye_region = gray[y:y+eye_height, x:int(x+w*0.4)] if x < gray.shape[1] else gray[y:y+eye_height, x:]
        right_eye_region = gray[y:y+eye_height, int(x+w*0.6):x+w] if int(x+w*0.6) < gray.shape[1] else gray[y:y+eye_height, x:]
        
        # Simple brightness-based detection
        left_brightness = np.mean(left_eye_region) if left_eye_region.size > 0 else 0
        right_brightness = np.mean(right_eye_region) if right_eye_region.size > 0 else 0
        
        # Face position analysis
        face_center_x = x + w/2
        frame_center_x = frame.shape[1] / 2
        horizontal_offset = abs(face_center_x - frame_center_x) / (frame.shape[1] / 2) if frame.shape[1] > 0 else 1.0
        
        # Heuristics for eye contact
        eye_contact = horizontal_offset < 0.3 and w > 100
        confidence = min(1.0, w / 200.0)
        
        return {
            "eyeContact": bool(eye_contact),
            "blink": False,
            "conf": float(confidence),
            "earLeft": float(left_brightness / 255.0),
            "earRight": float(right_brightness / 255.0)
        }
    except Exception as e:
        # Fallback to mock data on error
        return {
            "eyeContact": True,
            "blink": False,
            "conf": 0.7,
            "earLeft": 0.25,
            "earRight": 0.25
        }

@app.websocket("/ws")
async def gaze_websocket(websocket: WebSocket):
    """WebSocket endpoint for gaze tracking"""
    await websocket.accept()
    contact_ema = EMA(0.2)
    eye_contact_pct = 0.0
    total_samples = 0
    in_contact = 0
    
    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)
            
            # Handle init message
            if data.get("type") == "init":
                await websocket.send_text(json.dumps({
                    "type": "init",
                    "status": "connected"
                }))
                continue
            
            # Process frame
            if data.get("type") != "frame":
                continue
            
            try:
                # Decode dataURL
                data_url = data.get("data", "")
                if "," not in data_url:
                    continue
                
                b64 = data_url.split(",")[1]
                buf = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
                frame = cv2.imdecode(buf, cv2.IMREAD_COLOR) if CV2_AVAILABLE else None
                
                if frame is None:
                    # Return mock data if frame decode fails
                    await websocket.send_text(json.dumps({
                        "t": int(datetime.now().timestamp() * 1000),
                        "earLeft": 0.25,
                        "earRight": 0.25,
                        "blink": False,
                        "eyeContact": True,
                        "eyeContactPct": 0.8,
                        "gazeVector": [0.0, 0.0],
                        "conf": 0.7
                    }))
                    continue
                
                # Get eye tracking metrics
                metrics = simple_eye_contact_detection(frame)
                
                # Update rolling statistics
                contact_now = metrics["eyeContact"]
                contact_s = contact_ema.update(1.0 if contact_now else 0.0)
                total_samples += 1
                if contact_now:
                    in_contact += 1
                eye_contact_pct = float(in_contact / max(1, total_samples))
                
                # Send metrics back
                await websocket.send_text(json.dumps({
                    "t": int(datetime.now().timestamp() * 1000),
                    "earLeft": round(metrics["earLeft"], 4),
                    "earRight": round(metrics["earRight"], 4),
                    "blink": metrics["blink"],
                    "eyeContact": bool(contact_s > 0.5),
                    "eyeContactPct": round(eye_contact_pct, 3),
                    "gazeVector": [0.0, 0.0],  # Not implemented in simple version
                    "conf": round(metrics["conf"], 3)
                }))
            except Exception as e:
                # Send error response
                await websocket.send_text(json.dumps({
                    "t": int(datetime.now().timestamp() * 1000),
                    "error": str(e),
                    "eyeContact": False,
                    "conf": 0.0
                }))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Gaze WebSocket error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
