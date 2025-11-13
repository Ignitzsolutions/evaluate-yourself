# Start backend with environment variable
# Note: Set AZURE_COGNITIVE_KEY in your .env file or environment variables
Write-Host "Starting backend server..." -ForegroundColor Green
python -m uvicorn backend.app:app --port 8000 --host 0.0.0.0
