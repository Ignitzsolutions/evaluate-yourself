from fastapi import FastAPI, HTTPException, Header, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, List, Any, Literal
import os
import uuid
from datetime import datetime, timedelta
from io import BytesIO
import jwt
import json
import requests
import websockets
import asyncio
import base64
import traceback
import time
try:
    import numpy as np
    NP_AVAILABLE = True
except ImportError:
    np = None
    NP_AVAILABLE = False
import re
import sys
from pathlib import Path
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
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
from services.interview_state_store import InterviewStateStore
from db.redis_client import get_redis_client
from services.interview_evaluator import evaluate_response
from services.report_generator import generate_report as generate_interview_report
from services.interview.adaptive_engine import decide_next_turn, normalize_difficulty
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, String

#database imports
from db.database import engine, DATABASE_URL
from db import models
from sqlalchemy.orm import Session
from db.models import User
from fastapi import Depends
# from sqlalchemy.orm import Session
from db.database import get_db
from db.users import get_or_create_user

# Clerk token verification imports
from jose import jwt as jose_jwt
from fastapi import HTTPException
import logging

# Prefer explicit URL; else derive from CLERK_PUBLISHABLE_KEY (pk_*_<base64> decodes to <instance>.clerk.accounts.dev)
def _clerk_jwks_url():
    url = os.getenv("CLERK_JWKS_URL", "").strip()
    if url:
        return url
    pk = os.getenv("CLERK_PUBLISHABLE_KEY", "").strip()
    if pk and "_" in pk:
        parts = pk.split("_", 2)
        if len(parts) >= 3 and parts[2]:
            try:
                import base64
                raw = base64.urlsafe_b64decode(parts[2] + "==")
                domain = raw.decode("utf-8").strip().rstrip("$")
                if domain:
                    return f"https://{domain}/.well-known/jwks.json"
            except Exception:
                pass
    return "https://api.clerk.dev/v1/jwks"

_jwks_cache = None

#region Clerk Token Verification
def get_clerk_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    urls = [_clerk_jwks_url()]
    secret = os.getenv("CLERK_SECRET_KEY", "").strip()
    if secret:
        urls.append("https://api.clerk.com/v1/jwks")
    for url in urls:
        try:
            headers = {"Authorization": f"Bearer {secret}"} if secret and "api.clerk.com" in url else {}
            resp = requests.get(url, timeout=5, headers=headers or None)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            if _jwks_cache and _jwks_cache.get("keys"):
                return _jwks_cache
        except requests.exceptions.RequestException as e:
            logging.warning("Clerk JWKS fetch failed for %s: %s", url, e)
            continue
    logging.exception("❌ Failed to fetch Clerk JWKS from any URL")
    raise HTTPException(status_code=503, detail="Unable to fetch Clerk public keys")

#endregion
def _verify_clerk_token_jwks(token: str) -> dict:
    """Verify Clerk JWT using Frontend API JWKS (correct URL from CLERK_PUBLISHABLE_KEY)."""
    try:
        jwks = get_clerk_jwks()

        try:
            unverified_header = jose_jwt.get_unverified_header(token)
        except Exception:
            logging.exception("❌ Invalid JWT header")
            raise HTTPException(status_code=401, detail="Invalid JWT header")

        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Missing kid in token header")

        key = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                key = jwk
                break

        if not key:
            logging.error("❌ No matching JWK found for kid=%s (JWKS URL: %s)", kid, _clerk_jwks_url())
            raise HTTPException(status_code=401, detail="Invalid token signing key")

        try:
            payload = jose_jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={
                    "verify_aud": False,
                    "verify_exp": True,
                },
            )
        except jose_jwt.ExpiredSignatureError:
            logging.warning("❌ Clerk token expired")
            raise HTTPException(status_code=401, detail="Token expired")
        except jose_jwt.JWTError as e:
            logging.exception("❌ Clerk token decode failed: %s", e)
            raise HTTPException(status_code=401, detail="Invalid token")

        return payload

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("❌ Unexpected error verifying Clerk token: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Internal error verifying authentication token"
        )
# Helper to extract user ID from Authorization header
def get_user_id_from_auth(authorization: Optional[str]) -> Optional[str]:
    """Extract Clerk user id from Authorization header.

    - Returns the Clerk user id string, or None if verification fails.
    - For local development, if the environment variable `DEV_USER_ID` is set,
      it will be returned when no valid token is presented (convenience only).
    """
    # Dev-time convenience: allow overriding user for local testing
    dev_user = os.getenv("DEV_USER_ID")

    if not authorization:
        if dev_user:
            logging.info("DEV_USER_ID active - returning dev user id for unauthenticated request")
            return dev_user
        return None

    try:
        token = authorization.replace("Bearer ", "")
        decoded = verify_clerk_token(token)

        # Defensive: verify_clerk_token may return None on verification failure
        if not decoded:
            logging.warning("Clerk token verification failed: token could not be decoded/validated")
            return None

        return decoded.get("sub") or decoded.get("user_id")

    except HTTPException:
        return None
    except Exception as e:
        # Provide a more actionable log message for common causes
        logging.exception("Unexpected auth error: %s", e)
        if "iat" in str(e) or "not yet valid" in str(e):
            logging.warning("Token 'iat' validation failed - check server clock/ntp sync on the backend host")
        if "public key" in str(e) or "JWKS" in str(e):
            logging.warning("Failed to fetch/parse Clerk JWKS - verify CLERK_JWKS_URL and CLERK_PUBLISHABLE_KEY env variables")
        # As a safe default, return None (unauthenticated)
        return None

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Interview Backend", version="1.0.0")

# Static asset setup
BACKEND_STATIC_DIR = Path(__file__).resolve().parent / "static"
if BACKEND_STATIC_DIR.exists():
    app.mount("/backend-static", StaticFiles(directory=str(BACKEND_STATIC_DIR)), name="backend-static")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "build"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"
FRONTEND_AVAILABLE = FRONTEND_INDEX.exists()

if FRONTEND_AVAILABLE:
    frontend_static_dir = FRONTEND_DIR / "static"
    if frontend_static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(frontend_static_dir)), name="static")

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
REALTIME_VOICE = os.getenv("REALTIME_VOICE", "alloy").strip() or "alloy"
TRIAL_MODE_ENABLED = os.getenv("TRIAL_MODE_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")
FREE_TRIAL_MINUTES = max(1, int(os.getenv("FREE_TRIAL_MINUTES", "5")))

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
                chat_deployment = (os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "") or "").strip()
                
                print("✅ Azure OpenAI Realtime API configured")
                print(f"   Configured endpoint: {AZURE_OPENAI_ENDPOINT}")
                print(f"   Derived realtime host: {derived_realtime_host}")
                print(f"   Deployment: {AZURE_OPENAI_DEPLOYMENT}")
                print(f"   API version: {AZURE_OPENAI_API_VERSION}")
                print(f"   Realtime voice: {REALTIME_VOICE}")
                if chat_deployment:
                    print(f"   Chat deployment: {chat_deployment}")
                else:
                    warnings.append("⚠️  AZURE_OPENAI_CHAT_DEPLOYMENT is not set. Candidate feedback will use deterministic fallback.")
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


def validate_production_requirements() -> None:
    """Fail fast in production if critical persistence config is missing."""
    if not is_production:
        return

    if not os.getenv("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL must be set in production.")
    if not DATABASE_URL.startswith("postgresql"):
        raise RuntimeError("Production requires PostgreSQL DATABASE_URL.")
    if not os.getenv("REDIS_URL"):
        raise RuntimeError("REDIS_URL must be set in production.")

# Validate on import (will run when module loads)
validate_environment()

# Run validation on startup
@app.on_event("startup")
async def startup_event():
    validate_environment()
    validate_production_requirements()
    # Log Clerk JWKS URL so /api/me auth issues are debuggable
    try:
        jwks_url = _clerk_jwks_url()
        has_pk = bool(os.getenv("CLERK_PUBLISHABLE_KEY", "").strip())
        print(f"🔐 Clerk JWKS URL: {jwks_url} (CLERK_PUBLISHABLE_KEY set: {has_pk})")
    except Exception as e:
        print(f"🔐 Clerk JWKS log skip: {e}")

# Configure CORS origins from ALLOWED_ORIGINS (comma-separated) environment variable.
# If ALLOWED_ORIGINS is not set, fall back to a safe local development default.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
_env_value = os.getenv("ENV", os.getenv("ENVIRONMENT", os.getenv("PYTHON_ENV", ""))).strip().lower()
is_production = _env_value == "production"
validate_production_requirements()

if allowed_origins_env:
    if allowed_origins_env == "*":
        if is_production:
            # Disallow wildcard in production — fail fast to avoid accidental open CORS
            raise RuntimeError("ALLOWED_ORIGINS='*' is not allowed in production. Set ALLOWED_ORIGINS to the list of authorized origins.")
        else:
            print("⚠️ WARNING: ALLOWED_ORIGINS='*' - this allows all origins. Use only for short-term debugging.")
            allow_origins = ["*"]
    else:
        allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
        print(f"🔐 ALLOWED_ORIGINS set: {allow_origins}")
else:
    # Default local dev origins (safe for local development only)
    if is_production:
        # In production we must not use permissive defaults — require explicit ALLOWED_ORIGINS
        raise RuntimeError("ALLOWED_ORIGINS is not set and the environment indicates production. Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.")
    allow_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",  # Vite default
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]
    print("ℹ️ ALLOWED_ORIGINS not set — using default local dev origins. Set ALLOWED_ORIGINS in production to a comma-separated list of allowed origins.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Register WebSocket Realtime Router (PHASE 3)
# ============================================================================
try:
    from api.realtime import router as realtime_router
    app.include_router(realtime_router, prefix="/ws", tags=["websocket"])
    logging.info("✅ WebSocket realtime router registered at /ws/interview/{session_id}")
except Exception as e:
    logging.warning(f"⚠️ Could not register realtime router: {e}")

#D

@app.get("/", include_in_schema=False)
def read_root():
    if FRONTEND_AVAILABLE:
        return FileResponse(FRONTEND_INDEX)
    return HTMLResponse("""
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
            <img src="/backend-static/logo.png" alt="Evaluate Yourself" class="logo" onerror="this.style.display='none'">
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
    """)

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

# Interview session storage (Redis-backed, with in-memory fallback for local only)
_interview_state_cache: Dict[str, InterviewState] = {}
_interview_state_store: Optional[InterviewStateStore] = None


def _get_interview_state_store() -> Optional[InterviewStateStore]:
    global _interview_state_store
    if _interview_state_store is None:
        try:
            _interview_state_store = InterviewStateStore(get_redis_client())
        except Exception as e:
            if is_production:
                raise RuntimeError(f"Redis unavailable for interview state in production: {e}") from e
            print(f"⚠️ Redis unavailable for interview state (dev fallback to memory): {e}")
            _interview_state_store = None
    return _interview_state_store


def load_interview_state(session_id: str) -> Optional[InterviewState]:
    store = _get_interview_state_store()
    if store:
        state = store.get(session_id)
        if state:
            return state
    if is_production:
        return None
    return _interview_state_cache.get(session_id)


def save_interview_state(state: InterviewState) -> None:
    store = _get_interview_state_store()
    saved = False
    if store:
        saved = store.set(state)
    if not saved and not is_production:
        _interview_state_cache[state.session_id] = state


def delete_interview_state(session_id: str) -> None:
    store = _get_interview_state_store()
    if store:
        store.delete(session_id)
    if not is_production:
        _interview_state_cache.pop(session_id, None)


class UserProfileUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userCategory: Literal["student", "professional"]
    primaryGoal: str
    targetRoles: List[str]
    industries: List[str]
    interviewTimeline: str
    prepIntensity: str
    learningStyle: str
    consentDataUse: bool

    # Student fields
    educationLevel: Optional[str] = None
    graduationTimeline: Optional[str] = None
    majorDomain: Optional[str] = None
    placementReadiness: Optional[str] = None

    # Professional fields
    currentRole: Optional[str] = None
    experienceBand: Optional[str] = None
    managementScope: Optional[str] = None
    domainExpertise: Optional[List[str]] = None
    targetCompanyType: Optional[str] = None
    careerTransitionIntent: Optional[str] = None
    noticePeriodBand: Optional[str] = None
    careerCompBand: Optional[Literal["Foundation", "Growth", "Advanced", "Leadership"]] = None
    interviewUrgency: Optional[str] = None


def _json_dumps_safe(value: Any) -> str:
    return json.dumps(value if value is not None else [])


def _json_loads_safe_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(v) for v in parsed]
    except Exception:
        pass
    return []


def _validate_profile_payload(payload: UserProfileUpsertRequest) -> None:
    if not payload.consentDataUse:
        raise HTTPException(status_code=400, detail="Explicit consent is required to continue.")

    if not payload.targetRoles:
        raise HTTPException(status_code=400, detail="At least one target role is required.")
    if not payload.industries:
        raise HTTPException(status_code=400, detail="At least one industry selection is required.")

    if payload.userCategory == "student":
        required_student = [
            ("educationLevel", payload.educationLevel),
            ("graduationTimeline", payload.graduationTimeline),
            ("majorDomain", payload.majorDomain),
            ("placementReadiness", payload.placementReadiness),
        ]
        missing = [name for name, value in required_student if not value]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required student fields: {', '.join(missing)}")
    elif payload.userCategory == "professional":
        required_prof = [
            ("currentRole", payload.currentRole),
            ("experienceBand", payload.experienceBand),
            ("managementScope", payload.managementScope),
            ("targetCompanyType", payload.targetCompanyType),
            ("careerTransitionIntent", payload.careerTransitionIntent),
            ("noticePeriodBand", payload.noticePeriodBand),
            ("careerCompBand", payload.careerCompBand),
            ("interviewUrgency", payload.interviewUrgency),
        ]
        missing = [name for name, value in required_prof if not value]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required professional fields: {', '.join(missing)}")
        if not payload.domainExpertise:
            raise HTTPException(status_code=400, detail="domainExpertise is required for professional profile.")


def _resolve_plan_tier_for_user(_clerk_user_id: str) -> str:
    # Current launch default: signed-in users start as trial unless billing integration says otherwise.
    return "trial" if TRIAL_MODE_ENABLED else "basic"


def _effective_duration_minutes(requested: Optional[int], plan_tier: str) -> int:
    requested_value = requested if requested and requested > 0 else FREE_TRIAL_MINUTES
    if plan_tier == "trial":
        return min(requested_value, FREE_TRIAL_MINUTES)
    return requested_value


def _runtime_session_key(session_id: str) -> str:
    return f"runtime_session:{session_id}"


def _save_runtime_session(
    session_id: str,
    clerk_user_id: str,
    requested_minutes: int,
    effective_minutes: int,
    interview_type: str,
    difficulty: str,
    plan_tier: str,
    role: Optional[str] = None,
    company: Optional[str] = None,
    question_mix: Optional[str] = None,
    interview_style: Optional[str] = None,
) -> Dict[str, Any]:
    runtime_payload = {
        "session_id": session_id,
        "clerk_user_id": clerk_user_id,
        "status": "ACTIVE",
        "started_at": datetime.utcnow().isoformat(),
        "duration_minutes_requested": requested_minutes,
        "duration_minutes_effective": effective_minutes,
        "interview_type": interview_type,
        "difficulty": difficulty,
        "role": role,
        "company": company,
        "question_mix": question_mix or "balanced",
        "interview_style": interview_style or "neutral",
        "plan_tier": plan_tier,
        "trial_mode": plan_tier == "trial",
    }
    ttl_seconds = max(300, effective_minutes * 60 + 600)
    try:
        redis_client = get_redis_client()
        redis_client.setex(_runtime_session_key(session_id), ttl_seconds, json.dumps(runtime_payload))
    except Exception as redis_err:
        if is_production:
            raise HTTPException(status_code=500, detail=f"Failed to persist runtime session: {redis_err}")
        print(f"⚠️ Runtime session not saved in Redis (dev): {redis_err}")
    return runtime_payload


def _load_runtime_session(session_id: str) -> Dict[str, Any]:
    try:
        redis_client = get_redis_client()
        raw = redis_client.get(_runtime_session_key(session_id))
        if not raw:
            return {}
        return json.loads(raw)
    except Exception:
        return {}


def _upsert_interview_session_row(
    db: Session,
    session_id: str,
    clerk_user_id: str,
    interview_type: str,
    difficulty: str,
    requested_minutes: int,
    effective_minutes: int,
    runtime_payload: Dict[str, Any],
) -> models.InterviewSession:
    row = db.query(models.InterviewSession).filter(models.InterviewSession.session_id == session_id).first()
    if not row:
        row = models.InterviewSession(
            session_id=session_id,
            clerk_user_id=clerk_user_id,
            status="ACTIVE",
            interview_type=interview_type,
            difficulty=difficulty,
            duration_minutes_requested=requested_minutes,
            duration_minutes_effective=effective_minutes,
            started_at=datetime.utcnow(),
            session_meta_json=json.dumps(runtime_payload),
        )
        db.add(row)
    else:
        row.clerk_user_id = clerk_user_id
        row.status = "ACTIVE"
        row.interview_type = interview_type
        row.difficulty = difficulty
        row.duration_minutes_requested = requested_minutes
        row.duration_minutes_effective = effective_minutes
        row.session_meta_json = json.dumps(runtime_payload)
    db.commit()
    db.refresh(row)
    return row

# Pydantic models for WebRTC endpoint
class WebRTCRequest(BaseModel):
    sdpOffer: str
    sessionId: Optional[str] = None
    interviewType: Optional[str] = "mixed"
    difficulty: Optional[str] = "mid"
    durationMinutes: Optional[int] = None
    role: Optional[str] = None
    company: Optional[str] = None
    jobLevel: Optional[str] = "mid"
    questionMix: Optional[str] = "balanced"
    questionMixRatio: Optional[float] = None
    interviewStyle: Optional[str] = "neutral"


class AdaptiveTurnRequest(BaseModel):
    last_user_turn: str
    transcript_window: Optional[List[Dict[str, Any]]] = None
    interviewType: Optional[str] = "mixed"
    difficulty: Optional[str] = "mid"
    role: Optional[str] = None
    company: Optional[str] = None
    questionMix: Optional[str] = "balanced"
    interviewStyle: Optional[str] = "neutral"
    durationMinutes: Optional[int] = None
    askedQuestionIds: Optional[List[str]] = None

def build_azure_realtime_url(resource_name: str, domain: str, path: str, region: Optional[str] = None) -> str:
    """Build Azure Realtime API URL."""
    base_url = f"https://{resource_name}.{domain}"
    if region and domain == "cognitiveservices.azure.com":
        # For cognitiveservices format, include region in base URL
        base_url = f"https://{resource_name}-{region}.{domain}"
    return f"{base_url}{path}?api-version={AZURE_OPENAI_API_VERSION}"

@app.post("/api/realtime/webrtc")
async def webrtc_proxy(
    request: WebRTCRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
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
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization is required.")
        current_user = get_current_user(authorization=authorization, db=db)
        if not current_user:
            raise HTTPException(status_code=401, detail="Invalid user session.")
        clerk_user_id = current_user.clerk_user_id

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
        
        plan_tier = _resolve_plan_tier_for_user(clerk_user_id)
        normalized_difficulty = normalize_difficulty(request.difficulty or "mid")
        requested_minutes = request.durationMinutes if request.durationMinutes and request.durationMinutes > 0 else FREE_TRIAL_MINUTES
        effective_minutes = _effective_duration_minutes(requested_minutes, plan_tier)
        session_id = request.sessionId or f"session_{uuid.uuid4().hex[:16]}"

        runtime_payload = _save_runtime_session(
            session_id=session_id,
            clerk_user_id=clerk_user_id,
            requested_minutes=requested_minutes,
            effective_minutes=effective_minutes,
            interview_type=request.interviewType or "mixed",
            difficulty=normalized_difficulty,
            plan_tier=plan_tier,
            role=request.role,
            company=request.company,
            question_mix=request.questionMix,
            interview_style=request.interviewStyle,
        )
        _upsert_interview_session_row(
            db=db,
            session_id=session_id,
            clerk_user_id=clerk_user_id,
            interview_type=request.interviewType or "mixed",
            difficulty=normalized_difficulty,
            requested_minutes=requested_minutes,
            effective_minutes=effective_minutes,
            runtime_payload=runtime_payload,
        )

        # Build system prompt with new form fields
        system_prompt = _build_interviewer_system_prompt(
            interview_type=request.interviewType or "mixed",
            difficulty=normalized_difficulty,
            duration_minutes=effective_minutes,
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
                "seconds": max(300, effective_minutes * 60 + 180)
            },
            "session": {
                "type": "realtime",
                "model": AZURE_OPENAI_DEPLOYMENT,
                "audio": {
                    "input": {
                        "format": {
                            "type": "audio/pcm",
                            "rate": 24000
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.55,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 500,
                            "create_response": True,
                            "interrupt_response": True
                        },
                        "transcription": {
                            "model": "gpt-4o-mini-transcribe",
                            "language": "en"
                        },
                    },
                    "output": {
                        "voice": REALTIME_VOICE
                    }
                },
            }
        }
        
        # Add instructions if provided (can be disabled to reduce token creation latency)
        include_inline_instructions = os.getenv("REALTIME_INLINE_INSTRUCTIONS", "1").strip() != "0"
        if system_prompt and include_inline_instructions:
            client_secrets_request["session"]["instructions"] = system_prompt
        print(
            "🎙️ Realtime session config:",
            json.dumps(
                {
                    "voice": REALTIME_VOICE,
                    "turn_detection": client_secrets_request["session"]["audio"]["input"]["turn_detection"],
                    "include_inline_instructions": include_inline_instructions,
                }
            ),
        )
        
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
            def _extract_activity_id(resp: Optional[requests.Response]) -> Optional[str]:
                if not resp:
                    return None
                try:
                    body = resp.json()
                    if isinstance(body, dict):
                        for key in ("activityId", "activity_id", "activityid"):
                            val = body.get(key)
                            if val:
                                return str(val)
                        err_obj = body.get("error")
                        if isinstance(err_obj, dict):
                            for key in ("activityId", "activity_id", "activityid"):
                                val = err_obj.get(key)
                                if val:
                                    return str(val)
                except Exception:
                    return None
                return None

            def _minimal_payload(include_instructions: bool) -> Dict[str, Any]:
                payload = {
                    "expires_after": client_secrets_request["expires_after"],
                    "session": {
                        "type": "realtime",
                        "model": AZURE_OPENAI_DEPLOYMENT,
                        "audio": {
                            "input": {
                                "format": {"type": "audio/pcm", "rate": 24000},
                                "turn_detection": {
                                    "type": "server_vad",
                                    "threshold": 0.55,
                                    "prefix_padding_ms": 300,
                                    "silence_duration_ms": 600,
                                    "create_response": True,
                                    "interrupt_response": True,
                                },
                            },
                            "output": {"voice": REALTIME_VOICE},
                        },
                    },
                }
                if include_instructions and system_prompt:
                    payload["session"]["instructions"] = system_prompt
                return payload

            payload_attempts: List[Dict[str, Any]] = [
                {"name": "full_payload", "profile": "full_vad_transcription_instructions", "payload": client_secrets_request},
                {"name": "minimal_payload", "profile": "minimal_vad_with_instructions", "payload": _minimal_payload(include_inline_instructions)},
                {"name": "minimal_no_instructions", "profile": "minimal_vad_no_instructions", "payload": _minimal_payload(False)},
            ]

            token_resp = None
            last_timeout = None
            last_activity_id = None
            last_error_detail = None

            for attempt_cfg in payload_attempts:
                attempt_name = attempt_cfg["name"]
                payload_profile = attempt_cfg["profile"]
                payload = attempt_cfg["payload"]

                # Avoid duplicate attempt bodies when instructions are already disabled.
                if attempt_name == "minimal_no_instructions" and payload_attempts[1]["payload"] == payload:
                    continue

                for transport_attempt in range(2):
                    try:
                        token_resp = requests.post(
                            token_url,
                            headers={
                                "api-key": AZURE_OPENAI_API_KEY,
                                "content-type": "application/json"
                            },
                            json=payload,
                            timeout=20.0
                        )
                        break
                    except requests.Timeout as timeout_err:
                        last_timeout = timeout_err
                        if transport_attempt == 1:
                            token_resp = None
                        else:
                            time.sleep(0.5)

                if token_resp is None:
                    print(json.dumps({
                        "event": "realtime_token_attempt",
                        "attempt_name": attempt_name,
                        "payload_profile": payload_profile,
                        "status_code": "timeout",
                        "activityId": None,
                    }))
                    continue

                response_body = token_resp.text[:500] if token_resp.text else ""
                activity_id = _extract_activity_id(token_resp)
                if activity_id:
                    last_activity_id = activity_id
                print(json.dumps({
                    "event": "realtime_token_attempt",
                    "attempt_name": attempt_name,
                    "payload_profile": payload_profile,
                    "status_code": token_resp.status_code,
                    "activityId": activity_id,
                }))
                print(f"   Status: {token_resp.status_code} Body: {response_body[:200]}")

                if token_resp.status_code == 200:
                    if attempt_name != "full_payload":
                        print(f"⚠️ Realtime token created with fallback payload ({attempt_name})")
                    break

                # Non-transient errors should fail fast.
                if token_resp.status_code in (401, 403, 404):
                    if token_resp.status_code == 401:
                        raise HTTPException(status_code=401, detail="Authentication failed. Check API key matches the Azure resource.")
                    if token_resp.status_code == 403:
                        raise HTTPException(status_code=403, detail="Forbidden by Azure OpenAI. Verify deployment permissions and API key scope.")
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            "Realtime endpoint not found (404). Verify hostname, path, and Realtime availability on this Azure resource."
                        ),
                    )

                if token_resp.status_code >= 500:
                    last_error_detail = response_body
                    continue

                # 4xx validation/user errors should return immediately.
                if token_resp.status_code == 400 and "API version not supported" in response_body:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"API version {api_version} not supported for Realtime on this resource. "
                            f"Endpoint used: https://{base_endpoint}/openai/v1/realtime/client_secrets"
                        ),
                    )

                raise HTTPException(
                    status_code=token_resp.status_code,
                    detail=f"Token creation failed ({token_resp.status_code}): {response_body[:200]}",
                )

            if token_resp is None and last_timeout:
                raise requests.Timeout() from last_timeout

            if not token_resp or token_resp.status_code != 200:
                retry_hint = "Retry in a few seconds. If this persists, verify Azure Realtime deployment health."
                activity_text = f" activityId={last_activity_id}." if last_activity_id else ""
                detail_text = f"{last_error_detail[:160]} " if last_error_detail else ""
                raise HTTPException(
                    status_code=502,
                    detail=f"Realtime token creation failed after retries.{activity_text} {detail_text}{retry_hint}".strip(),
                )
            
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    full_response_body = token_resp.text if token_resp.text else ""
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:515","message":"Token response received","data":{"status_code":token_resp.status_code,"response_body":full_response_body,"response_headers":dict(token_resp.headers)},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}) + "\n")
                    f.flush()
            except Exception as log_err:
                print(f"DEBUG LOG ERROR: {log_err}")
            # #endregion
            
            print(f"✅ Token created successfully")
            token_resp.raise_for_status()
                
        except requests.Timeout:
            # #region agent log
            try:
                with open('/Users/srujanreddy/Projects/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({"id":f"log_{int(datetime.now().timestamp()*1000)}","timestamp":int(datetime.now().timestamp()*1000),"location":"app.py:541","message":"Request timeout","data":{"token_url":token_url,"timeout":20.0},"sessionId":"debug-session","runId":"run1","hypothesisId":"E"}) + "\n")
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
            sdp_resp = None
            for attempt in range(3):
                try:
                    sdp_resp = requests.post(
                        calls_url,
                        headers={
                            "Authorization": f"Bearer {ephemeral_token}",
                            "Content-Type": "application/sdp"
                        },
                        data=request.sdpOffer,
                        timeout=20.0
                    )
                    break
                except requests.Timeout:
                    if attempt == 2:
                        raise
                    time.sleep(0.5 * (attempt + 1))
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
        
        return {
            "sdpAnswer": sdp_answer,
            "sessionId": session_id,
            "effectiveDurationMinutes": effective_minutes,
            "trialMode": plan_tier == "trial",
            "planTier": plan_tier,
            "voice": REALTIME_VOICE,
        }
        
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
    session_state = load_interview_state(session_id)
    if not session_state:
        # Initialize from query params or defaults
        interview_type = "mixed"
        difficulty = "mid"
        max_questions = 6
        
        # Try to get from query params
        query_params = dict(websocket.query_params)
        interview_type = query_params.get("type", interview_type)
        difficulty = query_params.get("difficulty", difficulty)
        max_questions = int(query_params.get("max_questions", max_questions))
        
        session_state = InterviewState(
            session_id=session_id,
            interview_type=interview_type,
            difficulty=difficulty,
            max_questions=max_questions
        )
        save_interview_state(session_state)
    
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
                english_only_instructions = """You are Sonia, conducting an English-only professional interview.

Language policy:
- Respond in English only.
- If the candidate clearly speaks non-English, ask once in English to continue in English, then continue the interview.
- Do not repeatedly warn about language during normal English conversation.

Interview behavior:
- Ask one question at a time.
- Give one response per candidate turn.
- Maintain a calm, professional interview tone.
- Keep responses concise and avoid repeating yourself.
""" + system_prompt
                
                session_update_payload = {
                    "type": "session.update",
                    "session": {
                        "type": "realtime",  # ✅ REQUIRED: Azure requires session.type
                        "modalities": ["audio"],  # ONLY audio - prevents text+audio duplicate streams
                        "input_audio_format": {"type": "pcm16", "sample_rate_hz": 24000},  # 24kHz input
                        "output_audio_format": {"type": "pcm16", "sample_rate_hz": 24000},  # 24kHz output - CRITICAL for correct playback speed
                        "voice": REALTIME_VOICE,
                        "audio": {
                            "voice": REALTIME_VOICE,
                            "speed": 1.0
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.55,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 500,
                            "create_response": True
                        },
                        "input_audio_transcription": {
                            "model": "gpt-4o-mini-transcribe",
                            "language": "en"
                        },
                        "instructions": english_only_instructions
                    }
                }
                
                # Log first 500 chars of instructions to verify English-only enforcement
                print(
                    f"📝 Sending session.update with voice={REALTIME_VOICE}, "
                    f"instructions(first 500): {english_only_instructions[:500]}"
                )
                
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
                                        print(f"[AUDIO DEBUG] Received audio chunk from frontend: {audio_bytes} bytes")
                                        if audio_bytes % 2 != 0:
                                            print(f"⚠️ Warning: Odd PCM chunk size: {audio_bytes} bytes")
                                    else:
                                        print("[AUDIO DEBUG] Received input_audio_buffer.append with NO audio data!")
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
                                        save_interview_state(session_state)
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

                                    # Patch: Attach transcript to outgoing user events (extract from content array if present)
                                    patched_event = dict(event)
                                    # For user message events, extract transcript from item.content[0].transcript if present
                                    if event_type in ["conversation.item.added", "conversation.item.done"]:
                                        item = event.get("item", {})
                                        if item.get("role") == "user":
                                            content = item.get("content", [])
                                            if content and isinstance(content, list):
                                                first = content[0]
                                                transcript = first.get("transcript") if isinstance(first, dict) else None
                                                if transcript:
                                                    patched_event["user_transcript"] = transcript

                                    # Also keep previous patch for other event types if needed
                                    if event_type in ["conversation.item.input_audio_transcription.completed", "conversation.item.completed", "input_audio_buffer.committed"]:
                                        transcript = event.get("transcript", None)
                                        if transcript:
                                            patched_event["user_transcript"] = transcript

                                    # Forward to client
                                    await websocket.send_text(json.dumps(patched_event))

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
                                            save_interview_state(session_state)
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
                                                save_interview_state(session_state)

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
        state = load_interview_state(session_id)
        if state and not state.is_active:
            delete_interview_state(session_id)


def _build_interviewer_system_prompt(
    interview_type: str,
    difficulty: str,
    duration_minutes: Optional[int] = None,
    role: Optional[str] = None,
    company: Optional[str] = None,
    job_level: Optional[str] = None,
    question_mix: Optional[str] = None,
    interview_style: Optional[str] = None
) -> str:
    """Build system prompt for the interviewer agent."""
    base_prompt = """You are Sonia, a professional interviewer conducting a formal job interview.

Core rules:
1. Speak only in English.
2. If the candidate clearly speaks non-English, ask once to continue in English, then proceed.
3. Ask one question at a time.
4. Produce one response per candidate turn.
5. Keep a calm, professional, Indian-English cadence that is globally clear.
6. Speak at a slightly slower pace than default and include short pauses between sentences.
7. Do not repeat language warnings during normal English conversation.

Interview style:
- Professional and focused, never casual chat.
- Briefly acknowledge candidate answers, then ask the next relevant question.
- Probe for specifics and outcomes.
- Do not provide scores or final feedback during the interview.

Opening line:
"Hello, I'm Sonia, and I'll be conducting your interview today."
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

    if duration_minutes:
        if duration_minutes <= 10:
            base_prompt += (
                f"\nInterview duration target: {duration_minutes} minutes. Keep questions crisp, "
                "limit deep multi-layer probing, and prioritize core signal collection quickly."
            )
        elif duration_minutes <= 20:
            base_prompt += (
                f"\nInterview duration target: {duration_minutes} minutes. Maintain a balanced pace: "
                "one focused follow-up for strong signals, then move forward."
            )
        else:
            base_prompt += (
                f"\nInterview duration target: {duration_minutes} minutes. You have room for deeper "
                "probing per topic while still covering technical and behavioral dimensions."
            )
    
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
        save_interview_state(session_state)
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
        save_interview_state(session_state)
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
    save_interview_state(session_state)
    
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

def _get_clerk_jwks_for_verify():
    """Use correct JWKS URL (derive from CLERK_PUBLISHABLE_KEY or CLERK_JWKS_URL)."""
    try:
        url = _clerk_jwks_url()
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logging.warning("Clerk JWKS fetch failed: url=%s err=%s", _clerk_jwks_url(), e)
        return None

def verify_clerk_token(token: str) -> Optional[Dict]:
    if not CLERK_SECRET_KEY:
        logging.warning("CLERK_SECRET_KEY not set")
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
            jwks = _get_clerk_jwks_for_verify()
            if jwks:
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        try:
                            from jwt.algorithms import RSAAlgorithm
                            public_key = RSAAlgorithm.from_jwk(json.dumps(key))
                            decoded = jwt.decode(token, public_key, algorithms=["RS256"])
                            return decoded
                        except Exception as e:
                            logging.warning("RS256 decode failed for kid=%s: %s", kid, e)
                            pass
        
        try:
            decoded = jwt.decode(token, CLERK_SECRET_KEY, algorithms=["RS256"])
            return decoded
        except jwt.InvalidTokenError:
            return None
            
    except jwt.ExpiredSignatureError:
        logging.warning("Clerk token expired")
        return None
    except jwt.InvalidTokenError as e:
        logging.warning("Clerk token invalid: %s", e)
        return None
    except Exception as e:
        logging.warning("Clerk verify error: %s", e)
        return None


# def get_or_create_user(db: Session, decoded: dict):
#     try:
#         clerk_user_id = decoded.get("sub")
#         email = decoded.get("email")

#         if not clerk_user_id:
#             raise HTTPException(status_code=400, detail="Missing Clerk user id")

#         user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()

#         if not user:
#             user = User(
#                 clerk_user_id=clerk_user_id,
#                 email=email,
#             )
#             db.add(user)
#             db.commit()
#             db.refresh(user)

#         return user

#     except HTTPException:
#         raise

#     except Exception as e:
#         logging.exception("❌ DB error in get_or_create_user")
#         raise HTTPException(
#             status_code=500,
#             detail="Failed to create or fetch user"
#         )

# Refactored version of get_or_create_user
def get_or_create_user_db(
    db: Session,
    clerk_user_id: str,
    email: str | None = None
):
    try:
        user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()

        if not user:
            user = User(
                clerk_user_id=clerk_user_id,
                email=email,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"🆕 Created new user in DB: {user.id} {user.email}")
        else:
            print(f"👤 Found existing user in DB: {user.id} {user.email}")

        return user

    except Exception as e:
        db.rollback()
        print("❌ Error in get_or_create_user_db:", e)
        raise HTTPException(status_code=500, detail="User database error")

# Dependency to get current user
def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
):
    """
    Verifies Clerk token and ensures user exists in local DB.
    Returns User ORM object or raises HTTPException 401.
    """
    if not authorization or not authorization.strip():
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    try:
        decoded = _verify_clerk_token_jwks(token)
        clerk_user_id = decoded.get("sub") or decoded.get("user_id")
        email = decoded.get("email")
        full_name = decoded.get("name") or decoded.get("full_name")

        if not clerk_user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing sub")

        user = get_or_create_user(
            db=db,
            clerk_user_id=clerk_user_id,
            email=email,
            full_name=full_name
        )
        return user

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("get_current_user failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
# def get_current_user(
#     authorization: Optional[str] = Header(None),
#     db: Session = Depends(get_db)
# ):
    
#     if not authorization or not authorization.startswith("Bearer "):
#         raise HTTPException(status_code=401, detail="Missing Authorization header")

#     token = authorization.replace("Bearer ", "").strip()
#     decoded = verify_clerk_token(token)

#     clerk_user_id = decoded.get("sub")
#     email = decoded.get("email")

#     if not clerk_user_id:
#         raise HTTPException(status_code=401, detail="Invalid Clerk token")

#     user = get_or_create_user_db(db, clerk_user_id, email)

#     print(f"✅ Auth user DB: {user.id} {user.email}")

#     return user

# # Dependency to get current user
# def get_current_user(
#     authorization: str = Header(None),
#     db: Session = Depends(get_db),
# ):
#     try:
#         if not authorization:
#             raise HTTPException(status_code=401, detail="Missing Authorization header")

#         if not authorization.startswith("Bearer "):
#             raise HTTPException(status_code=401, detail="Invalid Authorization format")

#         token = authorization.replace("Bearer ", "").strip()
#         if not token:
#             raise HTTPException(status_code=401, detail="Empty token")

#         decoded = verify_clerk_token(token)
#         user = get_or_create_user(db, decoded)

#         # TEMP DEBUG (remove later)
#         print("✅ Clerk sub:", decoded.get("sub"))
#         print("✅ SQLite user:", user.id, user.email)

#         return user

#     except HTTPException:
#         raise

#     except Exception as e:
#         logging.exception("❌ Unexpected error in get_current_user")
#         raise HTTPException(
#             status_code=500,
#             detail="Authentication processing failed"
#         )

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

# Endpoint to get current authenticated user info
@app.get("/api/me")
def get_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {
        "id": current_user.id,
        "clerk_user_id": current_user.clerk_user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at,
    }

# Alias for /api/me — same auth, syncs Clerk → DB and returns user
@app.get("/api/users/me")
def get_me_users(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "id": current_user.id,
        "clerk_user_id": current_user.clerk_user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
    }


def _profile_to_api(profile: models.UserProfile) -> Dict[str, Any]:
    return {
        "id": profile.id,
        "clerkUserId": profile.clerk_user_id,
        "userCategory": profile.user_category,
        "primaryGoal": profile.primary_goal,
        "targetRoles": _json_loads_safe_list(profile.target_roles),
        "industries": _json_loads_safe_list(profile.industries),
        "interviewTimeline": profile.interview_timeline,
        "prepIntensity": profile.prep_intensity,
        "learningStyle": profile.learning_style,
        "consentDataUse": bool(profile.consent_data_use),
        "educationLevel": profile.education_level,
        "graduationTimeline": profile.graduation_timeline,
        "majorDomain": profile.major_domain,
        "placementReadiness": profile.placement_readiness,
        "currentRole": profile.current_role,
        "experienceBand": profile.experience_band,
        "managementScope": profile.management_scope,
        "domainExpertise": _json_loads_safe_list(profile.domain_expertise),
        "targetCompanyType": profile.target_company_type,
        "careerTransitionIntent": profile.career_transition_intent,
        "noticePeriodBand": profile.notice_period_band,
        "careerCompBand": profile.career_comp_band,
        "interviewUrgency": profile.interview_urgency,
        "createdAt": profile.created_at,
        "updatedAt": profile.updated_at,
    }


@app.get("/api/profile/status")
def get_profile_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.clerk_user_id == current_user.clerk_user_id
    ).first()
    return {
        "completed": bool(profile),
        "user_category": profile.user_category if profile else None,
    }


@app.get("/api/profile/me")
def get_profile_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.clerk_user_id == current_user.clerk_user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _profile_to_api(profile)


@app.put("/api/profile/me")
def upsert_profile_me(
    payload: UserProfileUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_profile_payload(payload)
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.clerk_user_id == current_user.clerk_user_id
    ).first()

    if not profile:
        profile = models.UserProfile(
            clerk_user_id=current_user.clerk_user_id,
            user_category=payload.userCategory,
            primary_goal=payload.primaryGoal,
            target_roles=_json_dumps_safe(payload.targetRoles),
            industries=_json_dumps_safe(payload.industries),
            interview_timeline=payload.interviewTimeline,
            prep_intensity=payload.prepIntensity,
            learning_style=payload.learningStyle,
            consent_data_use=payload.consentDataUse,
            education_level=payload.educationLevel,
            graduation_timeline=payload.graduationTimeline,
            major_domain=payload.majorDomain,
            placement_readiness=payload.placementReadiness,
            current_role=payload.currentRole,
            experience_band=payload.experienceBand,
            management_scope=payload.managementScope,
            domain_expertise=_json_dumps_safe(payload.domainExpertise),
            target_company_type=payload.targetCompanyType,
            career_transition_intent=payload.careerTransitionIntent,
            notice_period_band=payload.noticePeriodBand,
            career_comp_band=payload.careerCompBand,
            interview_urgency=payload.interviewUrgency,
        )
        db.add(profile)
    else:
        profile.user_category = payload.userCategory
        profile.primary_goal = payload.primaryGoal
        profile.target_roles = _json_dumps_safe(payload.targetRoles)
        profile.industries = _json_dumps_safe(payload.industries)
        profile.interview_timeline = payload.interviewTimeline
        profile.prep_intensity = payload.prepIntensity
        profile.learning_style = payload.learningStyle
        profile.consent_data_use = payload.consentDataUse
        profile.education_level = payload.educationLevel
        profile.graduation_timeline = payload.graduationTimeline
        profile.major_domain = payload.majorDomain
        profile.placement_readiness = payload.placementReadiness
        profile.current_role = payload.currentRole
        profile.experience_band = payload.experienceBand
        profile.management_scope = payload.managementScope
        profile.domain_expertise = _json_dumps_safe(payload.domainExpertise)
        profile.target_company_type = payload.targetCompanyType
        profile.career_transition_intent = payload.careerTransitionIntent
        profile.notice_period_band = payload.noticePeriodBand
        profile.career_comp_band = payload.careerCompBand
        profile.interview_urgency = payload.interviewUrgency
        profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)
    return {"ok": True, "profile": _profile_to_api(profile)}

@app.post("/api/self-insight/assessments")
async def create_assessment(request: CreateAssessmentRequest, authorization: Optional[str] = Header(None)):
    user_id = get_user_id(authorization)
    
    if len(request.answers) < 40:
        raise HTTPException(status_code=400, detail="At least 40 questions must be answered")
    
    answers_dict = [{"questionId": a.questionId, "value": a.value} for a in request.answers]
    report = generate_report(user_id, answers_dict)
    
    personality_reports[report.id] = report
    
    return {"reportId": report.id}

# @app.get("/api/self-insight/reports")
# async def list_reports(authorization: Optional[str] = Header(None)):
#     user_id = get_user_id(authorization)
@app.get("/api/self-insight/reports")
async def list_reports(
    current_user: User = Depends(get_current_user)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Reports store clerk_user_id (from get_user_id), so filter by clerk_user_id
    user_id = current_user.clerk_user_id
    
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

# @app.get("/api/interview/reports")
# async def list_interview_reports(authorization: Optional[str] = Header(None)):
#     user_id = None
#     try:
#         user_id = get_user_id(authorization)
#     except HTTPException as e:
#         # If authentication fails, still return sample reports
#         # Log the error but don't fail the request
#         print(f"Authentication failed for reports request: {e.detail}")
#         user_id = None
#     except Exception as e:
#         # Catch any other exceptions
#         print(f"Error getting user_id: {str(e)}")
#         user_id = None
    
#     # Always include sample reports, plus user's own reports if authenticated
#     if user_id:
#         user_reports = [r for r in interview_reports.values() if r.user_id == user_id or r.is_sample]
#     else:
#         # If not authenticated, only return sample reports
#         user_reports = [r for r in interview_reports.values() if r.is_sample]
    
#     user_reports.sort(key=lambda x: x.date, reverse=True)
    
#     summaries = []
#     for report in user_reports:
#         summaries.append(InterviewReportSummary(
#             id=report.id,
#             title=report.title,
#             date=report.date,
#             type=report.type,
#             mode=report.mode,
#             score=report.overall_score,
#             questions=report.questions,
#             is_sample=report.is_sample
#         ))
    
#     return summaries

# Revised list_interview_reports to use database
# @app.get("/api/interview/reports")
# async def list_interview_reports(
#     authorization: Optional[str] = Header(None),
#     user = Depends(get_current_user), # Ensure user is fetched if authenticated
#     db: Session = Depends(get_db)
# ):
#     try:
#         user_id = get_user_id_from_auth(authorization)

#         if user_id:
#             reports = db.query(models.InterviewReport).filter(
#                 (models.InterviewReport.user_id == user_id) |
#                 (models.InterviewReport.is_sample == True)
#             ).all()
#         else:
#             reports = db.query(models.InterviewReport).filter(
#                 models.InterviewReport.is_sample == True
#             ).all()

#         return reports

#     except Exception as e:
#         logging.exception("Failed to list interview reports")
#         raise HTTPException(status_code=500, detail="Failed to fetch reports")

# Revised list_interview_reports to use current_user dependency
@app.get("/api/interview/reports")
async def list_interview_reports(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """List interview reports for the authenticated user only."""
    try:
        current_user = get_current_user(authorization=authorization, db=db)
        user_id = current_user.clerk_user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_reports = db.query(models.InterviewReport).filter(
        models.InterviewReport.user_id == user_id,
        models.InterviewReport.is_sample == False,  # noqa: E712
    ).order_by(models.InterviewReport.date.desc()).all()

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


@app.put("/api/interview/reports/{report_id}/feedback")
async def upsert_report_feedback(
    report_id: str,
    payload: Dict[str, Any],
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Persist post-interview user feedback into report metrics."""
    current_user = get_current_user(authorization=authorization, db=db)
    user_id = current_user.clerk_user_id

    report = db.query(models.InterviewReport).filter(
        models.InterviewReport.id == report_id
    ).first()
    if not report:
        report = db.query(models.InterviewReport).filter(
            models.InterviewReport.session_id == report_id
        ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    rating = payload.get("rating")
    if not isinstance(rating, (int, float)) or int(rating) < 1 or int(rating) > 5:
        raise HTTPException(status_code=400, detail="rating must be between 1 and 5")
    comment = payload.get("comment")
    if comment is not None:
        comment = str(comment).strip()
        if not comment:
            comment = None

    submitted_at = payload.get("submitted_at")
    if not submitted_at:
        submitted_at = datetime.utcnow().isoformat()

    metrics = {}
    try:
        metrics = json.loads(report.metrics) if report.metrics else {}
    except Exception:
        metrics = {}

    session_feedback = {
        "rating": int(rating),
        "comment": comment,
        "submitted_at": submitted_at,
    }
    metrics["session_feedback"] = session_feedback
    report.metrics = json.dumps(metrics)
    db.commit()

    return {
        "report_id": report.id,
        "session_feedback": session_feedback,
    }

def _parse_duration_minutes(duration_str: Optional[str], metrics: Optional[dict]) -> int:
    if metrics and isinstance(metrics, dict) and metrics.get("total_duration") is not None:
        try:
            return int(metrics.get("total_duration"))
        except Exception:
            pass
    if not duration_str:
        return 0
    try:
        # Expect formats like "20 minutes"
        parts = str(duration_str).split()
        return int(parts[0])
    except Exception:
        return 0

def _safe_json(value, default):
    try:
        if value is None:
            return default
        if isinstance(value, (dict, list)):
            return value
        return json.loads(value)
    except Exception:
        return default

@app.get("/api/analytics/summary")
async def analytics_summary(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Return summary analytics for the current user."""
    user_id = get_user_id_from_auth(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    reports = db.query(models.InterviewReport).filter(
        models.InterviewReport.user_id == user_id,
        models.InterviewReport.is_sample == False
    ).order_by(models.InterviewReport.date.asc()).all()

    total_sessions = len(reports)
    avg_score = 0
    improvement_pct = 0
    total_minutes = 0

    if reports:
        scores = [r.overall_score or 0 for r in reports]
        avg_score = int(sum(scores) / max(1, len(scores)))
        if len(scores) >= 2:
            prev = scores[-2] or 1
            improvement_pct = int(round(((scores[-1] - prev) / max(1, prev)) * 100))

        for r in reports:
            metrics = _safe_json(r.metrics, {})
            total_minutes += _parse_duration_minutes(r.duration, metrics)

    return {
        "total_sessions": total_sessions,
        "avg_score": avg_score,
        "improvement_pct": improvement_pct,
        "practice_hours": round(total_minutes / 60, 1)
    }

@app.get("/api/analytics/trends")
async def analytics_trends(
    authorization: Optional[str] = Header(None),
    range: str = "30d",
    db: Session = Depends(get_db)
):
    """Return trend data for charts."""
    user_id = get_user_id_from_auth(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Simple: return last 20 sessions ordered by date
    reports = db.query(models.InterviewReport).filter(
        models.InterviewReport.user_id == user_id,
        models.InterviewReport.is_sample == False
    ).order_by(models.InterviewReport.date.asc()).limit(20).all()

    data = []
    for r in reports:
        metrics = _safe_json(r.metrics, {})
        scores = _safe_json(r.scores, {})
        data.append({
            "date": r.date.strftime("%Y-%m-%d") if r.date else None,
            "score": r.overall_score or 0,
            "eyeContact": metrics.get("eye_contact_pct") or 0,
            "confidence": scores.get("communication") or scores.get("clarity") or r.overall_score or 0
        })
    return data

@app.get("/api/analytics/skills")
async def analytics_skills(
    authorization: Optional[str] = Header(None),
    range: str = "30d",
    db: Session = Depends(get_db)
):
    """Return skill breakdown averages."""
    user_id = get_user_id_from_auth(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    reports = db.query(models.InterviewReport).filter(
        models.InterviewReport.user_id == user_id,
        models.InterviewReport.is_sample == False
    ).all()

    if not reports:
        return {
            "communication": 0,
            "technical": 0,
            "problem_solving": 0,
            "confidence": 0
        }

    comm = tech = struct = conf = 0
    count = 0
    for r in reports:
        scores = _safe_json(r.scores, {})
        comm += scores.get("communication") or scores.get("clarity") or 0
        tech += scores.get("technical_depth") or 0
        struct += scores.get("structure") or scores.get("relevance") or 0
        conf += scores.get("communication") or 0
        count += 1

    return {
        "communication": int(comm / count),
        "technical": int(tech / count),
        "problem_solving": int(struct / count),
        "confidence": int(conf / count)
    }

# @app.get("/api/interview/reports/{report_id}")
# async def get_interview_report(report_id: str, authorization: Optional[str] = Header(None)):
#     # Handle authentication gracefully (like list endpoint)
#     user_id = None
#     try:
#         user_id = get_user_id(authorization)
#     except HTTPException as e:
#         # If authentication fails, still allow access to sample reports
#         print(f"Authentication failed for report request: {e.detail}")
#         user_id = None
#     except Exception as e:
#         print(f"Error getting user_id: {str(e)}")
#         user_id = None
    
#     if report_id not in interview_reports:
#         raise HTTPException(status_code=404, detail="Report not found")
    
#     report = interview_reports[report_id]
    
#     # Allow access if:
#     # 1. It's a sample report (anyone can view)
#     # 2. User is authenticated and owns the report
#     # 3. No auth but report exists (for development/testing)
#     if not report.is_sample and user_id and report.user_id != user_id:
#         raise HTTPException(status_code=403, detail="Access denied")
    
#     return report

# Revised get_interview_report to use database
@app.get("/api/interview/reports/{report_id}")
async def get_interview_report(
    report_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    try:
        user_id = get_user_id_from_auth(authorization)

        # Try to find report by ID first, then by session_id
        report = db.query(models.InterviewReport).filter(
            models.InterviewReport.id == report_id
        ).first()
        
        if not report:
            # Try finding by session_id
            report = db.query(models.InterviewReport).filter(
                models.InterviewReport.session_id == report_id
            ).first()

        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        # If this is not a sample report, check access permissions
        # Allow access if:
        # 1. It's a sample report
        # 2. User owns the report
        # 3. Report was created as "guest" (allows access via UUID as capability token)
        if not report.is_sample:
            is_guest_report = report.user_id == "guest"
            is_owner = user_id and report.user_id == user_id
            
            # Allow guest reports to be accessed by anyone with the UUID
            # (UUID serves as a capability token since it's unguessable)
            if not is_guest_report and not is_owner:
                if not user_id:
                    raise HTTPException(status_code=401, detail="Authentication required")
                raise HTTPException(status_code=403, detail="Access denied")

        # Convert metrics JSON string to dict for API response
        if hasattr(report, 'metrics') and report.metrics:
            import json
            try:
                metrics_dict = json.loads(report.metrics)
            except Exception:
                metrics_dict = {}
            report.metrics = metrics_dict
        
        # Convert recommendations JSON string to list for API response
        if hasattr(report, 'recommendations') and report.recommendations:
            import json
            try:
                if isinstance(report.recommendations, str):
                    report.recommendations = json.loads(report.recommendations)
            except Exception:
                report.recommendations = []
        
        # Convert scores JSON string to dict for API response
        if hasattr(report, 'scores') and report.scores:
            import json
            try:
                if isinstance(report.scores, str):
                    report.scores = json.loads(report.scores)
            except Exception:
                report.scores = {}
        
        # Convert transcript JSON string to list for API response
        if hasattr(report, 'transcript') and report.transcript:
            import json
            try:
                if isinstance(report.transcript, str):
                    report.transcript = json.loads(report.transcript)
            except Exception:
                report.transcript = []
        
        # Convert ai_feedback JSON string to dict for API response
        if hasattr(report, 'ai_feedback') and report.ai_feedback:
            import json
            try:
                if isinstance(report.ai_feedback, str):
                    report.ai_feedback = json.loads(report.ai_feedback)
            except Exception:
                report.ai_feedback = None
        
        return report

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("Failed to get interview report")
        raise HTTPException(status_code=500, detail="Failed to fetch report")

@app.get("/api/interview/reports/{report_id}/download")
async def download_interview_report(
    report_id: str,
    format: str = "pdf",
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Download interview report as PDF."""
    if format.lower() != "pdf":
        raise HTTPException(status_code=400, detail="Unsupported format. Use ?format=pdf")

    # Reuse report access checks
    report = await get_interview_report(report_id, authorization=authorization, db=db)

    # Normalize data
    scores = report.scores if isinstance(report.scores, dict) else {}
    metrics = report.metrics if isinstance(report.metrics, dict) else {}
    recommendations = report.recommendations if isinstance(report.recommendations, list) else []
    transcript = report.transcript if isinstance(report.transcript, list) else []
    capture_status = metrics.get("capture_status")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=20, alignment=TA_LEFT, spaceAfter=12)
    h_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=14, spaceAfter=8)
    body_style = styles["BodyText"]

    content = []
    content.append(Paragraph(report.title or "Interview Report", title_style))
    content.append(Paragraph("Evaluate Yourself", ParagraphStyle("Brand", parent=styles["Heading1"], fontSize=16, textColor=colors.HexColor("#1d4ed8"))))
    content.append(Paragraph(f"<b>Date:</b> {report.date}", body_style))
    content.append(Paragraph(f"<b>Type:</b> {report.type}", body_style))
    content.append(Paragraph(f"<b>Mode:</b> {report.mode}", body_style))
    content.append(Paragraph(f"<b>Duration:</b> {report.duration}", body_style))
    content.append(Spacer(1, 12))

    if capture_status == "INCOMPLETE_NO_CANDIDATE_AUDIO":
        content.append(Paragraph("Evaluation Status", h_style))
        content.append(Paragraph("<b>Evaluation incomplete:</b> candidate speech was not captured in this session.", body_style))
        content.append(Paragraph("Please retry after verifying microphone permission and transcription capture.", body_style))
    else:
        content.append(Paragraph("Summary Scores", h_style))
        overall = report.overall_score if report.overall_score is not None else 0
        content.append(Paragraph(f"<b>Overall Score:</b> {overall}", body_style))
        if scores:
            # Simple horizontal bar chart for top skills
            drawing = Drawing(480, 140)
            y = 110
            for k, v in scores.items():
                label = k.replace("_", " ").title()
                value = max(0, min(100, int(v))) if v is not None else 0
                drawing.add(String(0, y, label, fontSize=9, fillColor=colors.HexColor("#0f172a")))
                drawing.add(Rect(140, y - 4, 300, 8, fillColor=colors.HexColor("#e2e8f0"), strokeColor=None))
                drawing.add(Rect(140, y - 4, 3 * value, 8, fillColor=colors.HexColor("#2563eb"), strokeColor=None))
                drawing.add(String(450, y - 1, str(value), fontSize=9, fillColor=colors.HexColor("#0f172a")))
                y -= 18
            content.append(drawing)
    content.append(Spacer(1, 12))

    content.append(Paragraph("Metrics", h_style))
    if metrics:
        rows = [["Metric", "Value"]]
        for k, v in metrics.items():
            rows.append([k.replace("_", " ").title(), str(v)])
        table = Table(rows, colWidths=[200, 260])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        content.append(table)
    content.append(Spacer(1, 12))

    if recommendations:
        content.append(Paragraph("Recommendations", h_style))
        for rec in recommendations:
            content.append(Paragraph(f"• {rec}", body_style))
        content.append(Spacer(1, 12))

    # Transcript appendix (optional, short)
    if transcript:
        content.append(PageBreak())
        content.append(Paragraph("Transcript (Excerpt)", h_style))
        for entry in transcript[:40]:
            speaker = entry.get("speaker", "Speaker")
            text = entry.get("text", "")
            content.append(Paragraph(f"<b>{speaker}:</b> {text}", body_style))

    doc.build(content)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="interview-report-{report_id}.pdf"'}
    )

# @app.post("/api/interview/reports")
# async def create_interview_report(request: CreateInterviewReportRequest, authorization: Optional[str] = Header(None)):
#     user_id = get_user_id(authorization)
    
#     report_id = str(uuid.uuid4())
#     report = InterviewReport(
#         id=report_id,
#         user_id=user_id,
#         title=request.title,
#         date=datetime.now(),
#         type=request.type,
#         mode=request.mode,
#         duration=request.duration,
#         overall_score=request.overall_score,
#         scores=request.scores,
#         transcript=request.transcript,
#         recommendations=request.recommendations,
#         questions=request.questions,
#         is_sample=False
#     )
    
#     interview_reports[report_id] = report
    
#     return {"id": report_id}

# Revised create_interview_report to use database
@app.post("/api/interview/reports", status_code=201)
async def create_interview_report(
    request: CreateInterviewReportRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    try:
        # user_id = get_user_id_from_auth(authorization)
    
        # if not user_id:
        #     raise HTTPException(status_code=401, detail="Authentication required")
        current_user = get_current_user(authorization=authorization, db=db)

        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        user_id = current_user.clerk_user_id

        report = models.InterviewReport(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            user_id=user_id,
            title=request.title,
            date=datetime.now(),
            type=request.type,
            mode=request.mode,
            duration=request.duration,
            overall_score=request.overall_score,
            scores=json.dumps(request.scores),
            transcript=json.dumps(request.transcript),
            recommendations=json.dumps(request.recommendations),
            questions=json.dumps(request.questions),
            is_sample=False
        )

        db.add(report)
        db.commit()
        db.refresh(report)

        return {"id": report.id}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logging.exception("Failed to create interview report")
        raise HTTPException(status_code=500, detail="Failed to create report")


@app.get("/api/interview/sessions/{session_id}")
def get_interview_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(models.InterviewSession).filter(
        models.InterviewSession.session_id == session_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    if row.clerk_user_id != current_user.clerk_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    runtime_data = _load_runtime_session(session_id)
    session_meta = {}
    if row.session_meta_json:
        try:
            session_meta = json.loads(row.session_meta_json)
        except Exception:
            session_meta = {}

    return {
        "session_id": row.session_id,
        "status": row.status,
        "interview_type": row.interview_type,
        "difficulty": row.difficulty,
        "duration_minutes_requested": row.duration_minutes_requested,
        "duration_minutes_effective": row.duration_minutes_effective,
        "started_at": row.started_at,
        "ended_at": row.ended_at,
        "report_id": row.report_id,
        "runtime": runtime_data,
        "meta": session_meta,
    }


@app.post("/api/interview/{session_id}/adaptive-turn")
async def adaptive_turn(
    session_id: str,
    payload: AdaptiveTurnRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluate one candidate turn and return the next adaptive question."""
    row = db.query(models.InterviewSession).filter(
        models.InterviewSession.session_id == session_id
    ).first()
    if row and row.clerk_user_id != current_user.clerk_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    runtime_data = _load_runtime_session(session_id) or {}
    asked_ids_runtime = runtime_data.get("asked_question_ids", [])
    asked_ids_payload = payload.askedQuestionIds or []
    asked_ids = list(dict.fromkeys([*(asked_ids_runtime or []), *asked_ids_payload]))

    transcript_window = payload.transcript_window or []
    decision = decide_next_turn(
        last_user_turn=payload.last_user_turn,
        recent_transcript=transcript_window,
        interview_type=payload.interviewType or (row.interview_type if row else "mixed"),
        difficulty=payload.difficulty or (row.difficulty if row else "mid"),
        role=payload.role or runtime_data.get("role"),
        company=payload.company or runtime_data.get("company"),
        question_mix=payload.questionMix or "balanced",
        interview_style=payload.interviewStyle or "neutral",
        duration_minutes=payload.durationMinutes,
        asked_question_ids=asked_ids,
    )

    question_id = decision.get("question_id")
    if question_id and not str(question_id).startswith("followup_") and question_id != "fallback_generic":
        asked_ids.append(str(question_id))

    turn_eval_history = runtime_data.get("turn_eval_history", [])
    if not isinstance(turn_eval_history, list):
        turn_eval_history = []
    turn_eval_history.append(
        {
            "timestamp": datetime.utcnow().isoformat(),
            "turn_scores": decision.get("turn_scores", {}),
            "reason": decision.get("reason"),
            "followup_type": decision.get("followup_type"),
            "difficulty_next": decision.get("difficulty_next"),
            "question_id": question_id,
        }
    )
    turn_eval_history = turn_eval_history[-30:]

    runtime_data["asked_question_ids"] = asked_ids
    runtime_data["turn_eval_history"] = turn_eval_history
    runtime_data["adaptive_last"] = decision

    ttl_seconds = max(300, int((payload.durationMinutes or FREE_TRIAL_MINUTES) * 60) + 600)
    try:
        redis_client = get_redis_client()
        redis_client.setex(_runtime_session_key(session_id), ttl_seconds, json.dumps(runtime_data))
    except Exception as redis_err:
        if is_production:
            raise HTTPException(status_code=500, detail=f"Failed to persist adaptive runtime state: {redis_err}")
        print(f"⚠️ Adaptive runtime state not saved in Redis (dev): {redis_err}")

    if row:
        session_meta = {}
        if row.session_meta_json:
            try:
                session_meta = json.loads(row.session_meta_json)
            except Exception:
                session_meta = {}
        session_meta["asked_question_ids"] = asked_ids
        session_meta["turn_eval_history"] = turn_eval_history
        row.session_meta_json = json.dumps(session_meta)
        db.commit()

    return {
        "next_question": decision.get("next_question"),
        "question_id": question_id,
        "reason": decision.get("reason"),
        "turn_scores": decision.get("turn_scores", {}),
        "difficulty_next": decision.get("difficulty_next"),
        "followup_type": decision.get("followup_type"),
        "adaptive_path": decision.get("adaptive_path", {}),
    }

@app.post("/api/interview/{session_id}/transcript")
async def save_interview_transcript(
    session_id: str, 
    request: Dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Save interview transcript to file and generate report in database."""
    try:
        # Handle both legacy and canonical transcript formats
        transcript_input = request.get("transcript", [])
        
        # Optionally accept other session data (questions, metrics, etc.)
        questions = request.get("questions", [])  # Can be list or integer
        questions_answered = request.get("questions_answered")  # Explicit count
        metrics = request.get("metrics", {})
        turn_evaluations = request.get("turn_evaluations", [])
        session_feedback = request.get("session_feedback")
        capture_stats = request.get("capture_stats")
        meta_payload = request.get("meta", {}) if isinstance(request.get("meta", {}), dict) else {}
        interview_type = request.get("interview_type", "mixed")
        duration_minutes = request.get("duration_minutes", 0)
        if not session_feedback and isinstance(metrics, dict):
            session_feedback = metrics.get("session_feedback")
        if not turn_evaluations and isinstance(metrics, dict):
            turn_evaluations = metrics.get("turn_evaluations", [])
        if not capture_stats and isinstance(metrics, dict):
            capture_stats = metrics.get("capture_stats")
        if not capture_stats and isinstance(meta_payload, dict):
            capture_stats = meta_payload.get("capture_stats")

        # Parse canonical transcript format (mode, qa_pairs, unpaired, raw_messages)
        # or legacy format (list of {question, answer})
        transcript = []
        raw_messages = []
        
        if isinstance(transcript_input, dict):
            # Canonical format: {mode, qa_pairs, unpaired, raw_messages}
            mode = transcript_input.get("mode", "structured")
            qa_pairs = transcript_input.get("qa_pairs", [])
            unpaired = transcript_input.get("unpaired", [])
            raw_messages = transcript_input.get("raw_messages", [])
            
            print(f"📦 Canonical transcript received: mode={mode}, qa_pairs={len(qa_pairs)}, unpaired={len(unpaired)}, raw={len(raw_messages)}")
            
            # Use qa_pairs as the primary transcript
            transcript = qa_pairs
            
            # If no qa_pairs but we have raw_messages, try to build pairs
            if not transcript and raw_messages:
                print(f"⚠️ No QA pairs, building from {len(raw_messages)} raw messages")
                pending_question = None
                for msg in raw_messages:
                    if msg.get("speaker") == "ai":
                        pending_question = msg.get("text")
                    elif msg.get("speaker") == "user" and pending_question:
                        transcript.append({
                            "question": pending_question,
                            "answer": msg.get("text"),
                            "timestamp": msg.get("timestamp")
                        })
                        pending_question = None
        
        elif isinstance(transcript_input, list):
            # Legacy format: list of {question, answer}
            transcript = transcript_input
            print(f"📦 Legacy transcript format: {len(transcript)} QA pairs")
        
        else:
            print(f"❌ Unexpected transcript type: {type(transcript_input)}")
            return {"message": "Invalid transcript format", "session_id": session_id}

        if not transcript and not raw_messages:
            return {"message": "No transcript data provided", "session_id": session_id}

        # Build timeline-friendly ordered messages from canonical raw stream when available.
        ordered_messages = []
        if raw_messages:
            for msg in raw_messages:
                text = (msg.get("text") or "").strip()
                if not text:
                    continue
                ordered_messages.append({
                    "speaker": (msg.get("speaker") or "unknown").lower(),
                    "text": text,
                    "timestamp": msg.get("timestamp") or datetime.now().isoformat()
                })
            ordered_messages.sort(key=lambda m: m.get("timestamp") or "")
        else:
            for entry in transcript:
                ts = entry.get("timestamp") or datetime.now().isoformat()
                question = (entry.get("question") or "").strip()
                answer = (entry.get("answer") or "").strip()
                if question:
                    ordered_messages.append({"speaker": "ai", "text": question, "timestamp": ts})
                if answer:
                    ordered_messages.append({"speaker": "user", "text": answer, "timestamp": ts})

        effective_questions_answered = 0
        if questions_answered is not None:
            try:
                effective_questions_answered = max(0, int(questions_answered))
            except Exception:
                effective_questions_answered = len(transcript)
        else:
            effective_questions_answered = len(transcript)

        user_words_derived = sum(
            len((m.get("text") or "").split())
            for m in ordered_messages
            if (m.get("speaker") or "").lower() in ["user", "candidate"]
        )
        ai_words_derived = sum(
            len((m.get("text") or "").split())
            for m in ordered_messages
            if (m.get("speaker") or "").lower() in ["ai", "interviewer", "sonia"]
        )
        if user_words_derived == 0 and isinstance(transcript, list):
            user_words_derived = sum(
                len(str((entry or {}).get("answer", "")).split())
                for entry in transcript
                if isinstance(entry, dict)
            )
        if ai_words_derived == 0 and isinstance(transcript, list):
            ai_words_derived = sum(
                len(str((entry or {}).get("question", "")).split())
                for entry in transcript
                if isinstance(entry, dict)
            )
        candidate_turn_count = sum(
            1
            for m in ordered_messages
            if (m.get("speaker") or "").lower() in ["user", "candidate"] and (m.get("text") or "").strip()
        )
        if candidate_turn_count == 0 and isinstance(transcript, list):
            candidate_turn_count = sum(
                1
                for entry in transcript
                if isinstance(entry, dict) and str((entry or {}).get("answer", "")).strip()
            )
        candidate_word_count = user_words_derived
        interviewer_word_count = ai_words_derived
        total_duration_derived = 0
        try:
            total_duration_derived = int(duration_minutes) if duration_minutes else 0
        except Exception:
            total_duration_derived = 0
        if total_duration_derived <= 0 and isinstance(metrics, dict):
            try:
                total_duration_derived = int(metrics.get("total_duration", 0))
            except Exception:
                total_duration_derived = 0
        if total_duration_derived <= 0:
            total_duration_derived = 1

        # Approximate response latency from ordered timeline.
        response_times = []
        last_ai_ts = None
        for msg in ordered_messages:
            speaker = (msg.get("speaker") or "").lower()
            ts_raw = msg.get("timestamp")
            try:
                ts_val = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            except Exception:
                ts_val = None
            if not ts_val:
                continue
            if speaker in ["ai", "interviewer", "sonia"]:
                last_ai_ts = ts_val
            elif speaker in ["user", "candidate"] and last_ai_ts:
                delta = (ts_val - last_ai_ts).total_seconds()
                if delta >= 0:
                    response_times.append(delta)
                last_ai_ts = None

        avg_response_time_derived = round(sum(response_times) / len(response_times), 2) if response_times else 0.0
        eye_contact_pct_derived = None
        if isinstance(metrics, dict):
            eye_contact_pct_derived = metrics.get("eye_contact_pct")

        capture_status = "COMPLETE"
        if candidate_turn_count <= 0:
            capture_status = "INCOMPLETE_NO_CANDIDATE_AUDIO"

        clean_turn_evaluations = []
        if isinstance(turn_evaluations, list):
            for item in turn_evaluations:
                if isinstance(item, dict):
                    clean_turn_evaluations.append(item)

        evaluation_source = "client_turn_evaluations"
        confidence = "high"
        if capture_status == "INCOMPLETE_NO_CANDIDATE_AUDIO":
            clean_turn_evaluations = []
            evaluation_source = "none_no_candidate_audio"
            confidence = "low"
        elif not clean_turn_evaluations:
            # Deterministic server-side fallback so reports remain explainable
            # even if client-side adaptive evaluation events are missed.
            candidate_turns = []
            if isinstance(transcript, list) and transcript:
                candidate_turns = [
                    (entry.get("answer") or "").strip()
                    for entry in transcript
                    if isinstance(entry, dict) and (entry.get("answer") or "").strip()
                ]
            if not candidate_turns:
                candidate_turns = [
                    (m.get("text") or "").strip()
                    for m in ordered_messages
                    if (m.get("speaker") or "").lower() in ["user", "candidate"] and (m.get("text") or "").strip()
                ]

            for answer in candidate_turns:
                try:
                    eval_result = evaluate_response(answer, interview_type)
                except Exception:
                    continue
                clean_turn_evaluations.append(
                    {
                        "clarity": int(eval_result.get("clarity_score", 3) or 3),
                        "depth": int(eval_result.get("depth_score", 3) or 3),
                        "relevance": int(eval_result.get("relevance_score", 3) or 3),
                        "confidence": str(eval_result.get("confidence_signal", "med")),
                        "star_completeness": eval_result.get("star_completeness", {}) if isinstance(eval_result.get("star_completeness"), dict) else {},
                        "technical_correctness": eval_result.get("technical_correctness"),
                        "rationale": "; ".join(eval_result.get("notes", [])[:2]) if isinstance(eval_result.get("notes"), list) else "",
                    }
                )
            if clean_turn_evaluations:
                evaluation_source = "server_fallback_heuristic"
                confidence = "medium"
            else:
                evaluation_source = "no_turn_evaluations_from_candidate_text"
                confidence = "low"
                if candidate_turn_count <= 0:
                    evaluation_source = "none_no_candidate_audio"
                    capture_status = "INCOMPLETE_NO_CANDIDATE_AUDIO"

        turn_eval_summary = None
        if clean_turn_evaluations:
            clarity_vals = [e.get("clarity") for e in clean_turn_evaluations if isinstance(e.get("clarity"), (int, float))]
            depth_vals = [e.get("depth") for e in clean_turn_evaluations if isinstance(e.get("depth"), (int, float))]
            relevance_vals = [e.get("relevance") for e in clean_turn_evaluations if isinstance(e.get("relevance"), (int, float))]

            def _avg(values):
                return round(sum(values) / len(values), 2) if values else None

            turn_eval_summary = {
                "turn_count": len(clean_turn_evaluations),
                "avg_clarity": _avg(clarity_vals),
                "avg_depth": _avg(depth_vals),
                "avg_relevance": _avg(relevance_vals),
            }

        derived_metrics = {
            "questions_answered": effective_questions_answered,
            "total_words": user_words_derived,
            "ai_total_words": ai_words_derived,
            "candidate_word_count": candidate_word_count,
            "interviewer_word_count": interviewer_word_count,
            "total_duration": total_duration_derived,
            "avg_response_time_seconds": avg_response_time_derived,
            "words_per_minute": round(user_words_derived / max(total_duration_derived, 1)),
            "eye_contact_pct": eye_contact_pct_derived,
            "session_feedback": session_feedback,
            "turn_evaluations": clean_turn_evaluations,
            "turn_eval_summary": turn_eval_summary,
            "capture_status": capture_status,
            "candidate_turn_count": candidate_turn_count,
            "capture_stats": capture_stats if isinstance(capture_stats, dict) else None,
            "evaluation_explainability": {
                "source": evaluation_source,
                "formula": "overall = avg(clarity, depth, relevance) * 20",
                "turns_evaluated": len(clean_turn_evaluations),
                "confidence": confidence,
                "candidate_word_count": candidate_word_count,
                "interviewer_word_count": interviewer_word_count,
            },
        }
        runtime_session_data = _load_runtime_session(session_id)
        if runtime_session_data:
            derived_metrics["runtime_session"] = runtime_session_data
            if "adaptive_last" in runtime_session_data:
                derived_metrics["adaptive_path"] = runtime_session_data.get("adaptive_last")
        if capture_status == "INCOMPLETE_NO_CANDIDATE_AUDIO":
            print(f"⚠️ Capture incomplete for session {session_id}: no candidate turns detected")

        # Resolve authenticated user. Production disallows guest transcript writes.
        user_id = None
        current_user = None
        if authorization:
            try:
                current_user = get_current_user(authorization=authorization, db=db)
                if current_user:
                    user_id = current_user.clerk_user_id
            except Exception as auth_err:
                if is_production:
                    raise HTTPException(status_code=401, detail=f"Unauthorized transcript save: {auth_err}")
                print(f"⚠️ Auth optional for transcript save (dev): {auth_err}")

        if not user_id:
            if is_production:
                raise HTTPException(status_code=401, detail="Authorization is required to save transcripts.")
            user_id = "guest"

        # Update or reconstruct the in-memory session state
        from services.interview_state import InterviewState
        session_state = load_interview_state(session_id)
        if not session_state:
            # Reconstruct minimal session state if missing
            session_state = InterviewState(
                session_id=session_id,
                interview_type=interview_type,
                difficulty="mid",
                max_questions=len(questions) if questions else 6
            )
            save_interview_state(session_state)

       # ✅ Update session state with posted Q/A transcript (correct format)
        session_state.transcript_history = []

        for idx, entry in enumerate(transcript):
            question = entry.get("question")
            answer = entry.get("answer")

            # Skip invalid rows
            if not question and not answer:
                continue

            session_state.transcript_history.append({
                "question": question or "",
                "answer": answer or "",
                "question_index": idx,
                "timestamp": entry.get("timestamp", datetime.now().isoformat())
            })

        # ✅ ensure question_index reflects answers count
        session_state.question_index = len(session_state.transcript_history)

        print(f"📊 Transcript Q/A pairs loaded: {session_state.question_index}")

        
        # Set question_index based on questions_answered or questions count
        if questions_answered is not None:
            session_state.question_index = int(questions_answered)
        elif isinstance(questions, int):
            session_state.question_index = questions
        elif isinstance(questions, list) and len(questions) > 0:
            session_state.question_index = len(questions)
        else:
            # Estimate from transcript (count interviewer messages as questions)
            interviewer_messages = [t for t in transcript if t.get("speaker", "").lower() in ["interviewer", "ai", "sonia"]]
            session_state.question_index = len(interviewer_messages)
        
        # Optionally update metrics if provided
        if metrics:
            for k, v in metrics.items():
                setattr(session_state, k, v)
        if clean_turn_evaluations:
            session_state.evaluation_results = clean_turn_evaluations

        save_interview_state(session_state)

        # Save transcript as before (unchanged)
        transcripts_dir = os.path.join(os.path.dirname(__file__), "transcripts")
        os.makedirs(transcripts_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename_base = f"transcript_{session_id}_{timestamp}"
        
        # Save complete canonical payload for audit
        json_filename = os.path.join(transcripts_dir, f"{filename_base}.json")
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump({
                "session_id": session_id,
                "timestamp": datetime.now().isoformat(),
                "transcript": transcript,  # QA pairs
                "raw_messages": raw_messages if raw_messages else None,  # Raw messages if available
                "format": "canonical" if isinstance(transcript_input, dict) else "legacy"
            }, f, indent=2, ensure_ascii=False)
        
        # Save human-readable text version
        text_filename = os.path.join(transcripts_dir, f"{filename_base}.txt")
        with open(text_filename, 'w', encoding='utf-8') as f:
            f.write(f"Interview Transcript - Session ID: {session_id}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            # Write QA pairs
            for idx, entry in enumerate(transcript, 1):
                question = entry.get("question", "")
                answer = entry.get("answer", "")
                timestamp_str = entry.get("timestamp", "")
                
                if timestamp_str:
                    try:
                        if isinstance(timestamp_str, str):
                            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            timestamp_str = dt.strftime('%H:%M:%S')
                    except:
                        pass
                
                f.write(f"Q{idx} [{timestamp_str}]:\n{question}\n\n")
                f.write(f"A{idx} [{timestamp_str}]:\n{answer}\n\n")
                f.write("-" * 80 + "\n\n")
        
        print(f"✅ Transcript saved for session {session_id}")
        print(f"   JSON: {json_filename}")
        print(f"   Text: {text_filename}")

        # Generate and save interview report to database
        report_id = None  # Ensure defined even if report generation fails
        try:
            existing_report = db.query(models.InterviewReport).filter(
                models.InterviewReport.session_id == session_id
            ).first()

            if not existing_report:
                from services.report_generator import generate_report as generate_interview_report
                # Use updated session_state for report
                if session_state.start_time:
                    duration_minutes = int((datetime.now() - session_state.start_time).total_seconds() / 60)
                if not interview_type:
                    interview_type = session_state.interview_type or "mixed"
                if duration_minutes <= 0:
                    duration_minutes = 1

                report_data = generate_interview_report(session_state, interview_type, duration_minutes)
                if derived_metrics.get("capture_status") == "INCOMPLETE_NO_CANDIDATE_AUDIO":
                    report_data.overall_score = 0
                    report_data.scores = ScoreBreakdown(
                        communication=0,
                        clarity=0,
                        structure=0,
                        technical_depth=0 if interview_type in ["technical", "mixed"] else None,
                        relevance=0,
                    )
                    report_data.questions = 0
                    report_data.recommendations = [
                        "We could not evaluate this interview because candidate speech was not captured.",
                        "Please retry after verifying microphone permission and input device.",
                        "Confirm that live transcription events are received before ending the session.",
                    ]
                    report_data.ai_feedback = {
                        "overall_summary": "Evaluation incomplete: candidate speech was not captured.",
                        "strengths": [],
                        "areas_for_improvement": [
                            "Verify microphone selection and browser permission",
                            "Run a short audio check before starting interview",
                            "Retry the session to generate a full evaluation",
                        ],
                    }
                merged_metrics = report_data.metrics if isinstance(report_data.metrics, dict) else {}
                merged_metrics.update({k: v for k, v in derived_metrics.items() if v is not None})
                db_report = models.InterviewReport(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    user_id=user_id,
                    title=report_data.title,
                    date=datetime.now(),
                    type=report_data.type,
                    mode=report_data.mode,
                    duration=report_data.duration,
                    overall_score=report_data.overall_score,
                    scores=json.dumps(report_data.scores.dict() if hasattr(report_data.scores, 'dict') else report_data.scores),
                    transcript=json.dumps(ordered_messages),
                    recommendations=json.dumps(report_data.recommendations),
                    questions=report_data.questions,
                    is_sample=False,
                    metrics=json.dumps(merged_metrics) if merged_metrics else None,
                    ai_feedback=json.dumps(report_data.ai_feedback) if hasattr(report_data, 'ai_feedback') and report_data.ai_feedback is not None else None
                )
                db.add(db_report)
                db.commit()
                db.refresh(db_report)
                report_id = db_report.id
                print(f"✅ Report generated and saved to database: {db_report.id}")
            else:
                merged_existing_metrics = {}
                try:
                    merged_existing_metrics = json.loads(existing_report.metrics) if existing_report.metrics else {}
                except Exception:
                    merged_existing_metrics = {}
                merged_existing_metrics.update({k: v for k, v in derived_metrics.items() if v is not None})
                existing_report.metrics = json.dumps(merged_existing_metrics)
                existing_report.transcript = json.dumps(ordered_messages)
                if derived_metrics.get("capture_status") == "INCOMPLETE_NO_CANDIDATE_AUDIO":
                    existing_report.overall_score = 0
                    existing_report.scores = json.dumps({
                        "communication": 0,
                        "clarity": 0,
                        "structure": 0,
                        "technical_depth": 0 if interview_type in ["technical", "mixed"] else None,
                        "relevance": 0,
                    })
                    existing_report.recommendations = json.dumps([
                        "We could not evaluate this interview because candidate speech was not captured.",
                        "Please retry after verifying microphone permission and input device.",
                        "Confirm that live transcription events are received before ending the session.",
                    ])
                db.commit()
                report_id = existing_report.id
                print(f"ℹ️ Report already exists for session {session_id}, updated metrics/transcript (id={report_id})")
        except Exception as report_err:
            # Don't fail the entire request if report generation fails; transcript is still saved
            print(f"⚠️ Failed to generate report (transcript still saved): {report_err}")
            import traceback
            traceback.print_exc()

        # Mark durable interview session row as completed/failed with final metadata.
        try:
            session_row = db.query(models.InterviewSession).filter(
                models.InterviewSession.session_id == session_id
            ).first()
            final_status = "COMPLETED" if report_id else "FAILED"
            final_meta = runtime_session_data if isinstance(runtime_session_data, dict) else {}
            final_meta.update({
                "ended_at": datetime.utcnow().isoformat(),
                "questions_answered": effective_questions_answered,
            })
            if session_feedback is not None:
                final_meta["session_feedback"] = session_feedback

            if session_row:
                session_row.status = final_status
                session_row.ended_at = datetime.utcnow()
                session_row.report_id = report_id
                session_row.duration_minutes_effective = total_duration_derived
                session_row.session_meta_json = json.dumps(final_meta)
            else:
                session_row = models.InterviewSession(
                    session_id=session_id,
                    clerk_user_id=user_id,
                    status=final_status,
                    interview_type=interview_type,
                    difficulty=getattr(session_state, "difficulty", "mid"),
                    duration_minutes_requested=total_duration_derived,
                    duration_minutes_effective=total_duration_derived,
                    started_at=session_state.start_time or datetime.utcnow(),
                    ended_at=datetime.utcnow(),
                    report_id=report_id,
                    session_meta_json=json.dumps(final_meta),
                )
                db.add(session_row)
            db.commit()
        except Exception as session_update_err:
            db.rollback()
            print(f"⚠️ Failed to update interview session row: {session_update_err}")

        return {
            "message": "Transcript saved successfully",
            "session_id": session_id,
            "report_id": report_id,
            "capture_status": derived_metrics.get("capture_status"),
            "evaluation_source": derived_metrics.get("evaluation_explainability", {}).get("source"),
            "turns_evaluated": len(clean_turn_evaluations),
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
    if not CV2_AVAILABLE or not NP_AVAILABLE:
        # Return mock data if OpenCV/Numpy not available
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
                if not NP_AVAILABLE:
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

# Serve React SPA routes (must be registered after API routes)
@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if not FRONTEND_AVAILABLE:
        raise HTTPException(status_code=404, detail="Not Found")

    # Avoid hijacking API paths if an endpoint is missing
    if full_path.startswith("api/") or full_path in {"api", "docs", "redoc", "openapi.json"}:
        raise HTTPException(status_code=404, detail="Not Found")

    file_path = FRONTEND_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(FRONTEND_INDEX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
