"""
Simple FastAPI Backend for Azure Realtime Token Issuing
Provides /api/token endpoint only for the AI Interview feature
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from azure.identity import (
    CredentialUnavailableError,
    DefaultAzureCredential
)
import os
from typing import Optional

# Initialize FastAPI app
app = FastAPI(title="AI Interview Token Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Azure configuration
AZURE_REALTIME_SCOPE = os.getenv(
    "AZURE_REALTIME_SCOPE",
    "https://gpt-interactive-talk.services.ai.azure.com/.default"
)

azure_credential: Optional[DefaultAzureCredential] = None


def get_azure_credential() -> DefaultAzureCredential:
    """Get or create Azure credential instance"""
    global azure_credential
    if azure_credential is None:
        azure_credential = DefaultAzureCredential()
    return azure_credential


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "AI Interview Token Service",
        "endpoints": ["/api/token"]
    }


@app.get("/api/token")
async def azure_realtime_token():
    """
    Issue a short-lived Azure AD token for the realtime interview service.
    
    Returns:
        dict: Contains 'token' (bearer token string) and 'expires_on' (unix timestamp)
    
    Raises:
        HTTPException: If Azure credentials are unavailable or token cannot be acquired
    """
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
            detail=f"Azure credential unavailable: {exc}. Please ensure Azure CLI is installed and run 'az login'."
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to acquire Azure realtime token: {exc}"
        ) from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
