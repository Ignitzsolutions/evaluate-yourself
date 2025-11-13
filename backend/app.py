from fastapi import FastAPI, HTTPException, Header, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
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
from azure.identity import (
    CredentialUnavailableError,
    DefaultAzureCredential
)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from models.personality import CreateAssessmentRequest, UpdateReflectionsRequest, PersonalityReport
from models.interview import InterviewReport, InterviewReportSummary, CreateInterviewReportRequest, TranscriptMessage, ScoreBreakdown
from services.personality_scoring import generate_report
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:8080",
        "http://127.0.0.1:3000",
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

# Azure Realtime API Token Endpoint
AZURE_REALTIME_SCOPE = os.getenv(
    "AZURE_REALTIME_SCOPE",
    "https://ai.azure.com/.default"
)

azure_credential: Optional[DefaultAzureCredential] = None

def get_azure_credential() -> DefaultAzureCredential:
    global azure_credential
    if azure_credential is None:
        azure_credential = DefaultAzureCredential()
    return azure_credential

OPENAI_REALTIME_API_KEY = os.getenv("OPENAI_REALTIME_API_KEY")
OPENAI_REALTIME_ENDPOINT = os.getenv("OPENAI_REALTIME_ENDPOINT", "https://api.openai.com/v1/realtime")
OPENAI_REALTIME_MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview")

@app.get("/api/token")
async def realtime_token():
    if OPENAI_REALTIME_API_KEY and OPENAI_REALTIME_API_KEY != "your-openai-api-key-here":
        return {
            "api_key": OPENAI_REALTIME_API_KEY,
            "endpoint": OPENAI_REALTIME_ENDPOINT,
            "model": OPENAI_REALTIME_MODEL,
            "provider": "openai"
        }
    
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
    
    if not OPENAI_REALTIME_API_KEY or OPENAI_REALTIME_API_KEY == "your-openai-api-key-here":
        await websocket.close(code=1008, reason="OpenAI API key not configured")
        return
    
    model = OPENAI_REALTIME_MODEL
    ws_url = f"wss://api.openai.com/v1/realtime?model={model}"
    
    try:
        async with websockets.connect(
            ws_url,
            subprotocols=["realtime"],
            extra_headers={"Authorization": f"Bearer {OPENAI_REALTIME_API_KEY}"}
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
    user_id = get_user_id(authorization)
    
    if report_id not in interview_reports:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report = interview_reports[report_id]
    
    if not report.is_sample and report.user_id != user_id:
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
