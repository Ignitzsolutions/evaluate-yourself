# Compatibility Guide

This document describes Python version compatibility, OS package requirements, optional dependencies, and Azure App Service configuration for this project.

## Supported Python Version

**Python 3.10** is the recommended and tested version for this project.

- **GitHub Actions CI/CD**: Uses Python 3.10 on Ubuntu 22.04
- **Azure App Service**: Configure to use Python 3.10 runtime
- **Local Development**: Python 3.10+ recommended (3.9 minimum)

### Why Python 3.10?

- Best wheel availability for scientific packages (numpy, scipy, opencv-python)
- Stable compatibility with Azure App Service Linux runtime
- Avoids compilation issues with native dependencies like dlib

## OS Package Requirements (Linux)

### Required for Azure Deployment

These packages are automatically installed in GitHub Actions CI/CD:

```bash
sudo apt-get update
sudo apt-get install -y \
    libopenblas-dev \
    libgl1 \
    libglib2.0-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev
```

### Package Descriptions

- **libopenblas-dev**: Optimized BLAS library for numpy/scipy
- **libgl1**: OpenGL library (replaces deprecated libgl1-mesa-glx on Ubuntu 24.04+)
- **libglib2.0-0**: GLib library for OpenCV
- **libavcodec-dev, libavformat-dev, libswscale-dev**: Video processing libraries for OpenCV

### Optional Build Dependencies

These are only needed if building native packages from source (not required for Azure deployment):

```bash
cmake \
build-essential \
libx11-dev \
libgtk-3-dev
```

## Requirements Files Structure

### `backend/requirements.txt` (Azure Deployment)

**This is the main requirements file used for Azure App Service deployment.**

Contains all dependencies needed for `backend/app.py`:
- FastAPI, uvicorn, websockets
- OpenCV (headless mode compatible)
- NumPy, SciPy
- Azure services, AI/ML libraries
- **Does NOT include dlib** (not needed for Azure deployment)

### `requirements-base.txt` (Core Dependencies)

Base dependencies shared across the project:
- Web framework (FastAPI, uvicorn)
- Computer vision (OpenCV)
- Scientific computing (NumPy, SciPy)
- **Does NOT include dlib**

### `requirements-face.txt` (Optional)

Optional face detection dependencies:
- **dlib** - Only needed for `server.py` (standalone eye-tracking server)
- **NOT required** for Azure deployment (`backend/app.py` uses OpenCV's haarcascade instead)

### `requirements.txt` (Root)

References `requirements-base.txt` by default. To include optional face detection:

```bash
# Install base dependencies
pip install -r requirements-base.txt

# Or install with optional face detection
pip install -r requirements.txt  # includes base
pip install -r requirements-face.txt  # add dlib
```

## Application Structure

### `backend/app.py` (Azure Deployment)

- **Main FastAPI application** deployed to Azure App Service
- Uses OpenCV for gaze tracking (no dlib required)
- Startup command: `cd backend && uvicorn app:app --host 0.0.0.0 --port 8000`
- Requirements: `backend/requirements.txt`

### `server.py` (Standalone Server)

- **Standalone eye-tracking server** (not deployed to Azure)
- Uses dlib for advanced face landmark detection
- Optional dependency - gracefully handles missing dlib
- Requirements: `requirements-base.txt` + `requirements-face.txt`

## Azure App Service Configuration

### Python Runtime

Set the Python version in Azure Portal:
1. Go to App Service → Configuration → General settings
2. Set "Stack" to "Python"
3. Set "Python version" to "3.10"

### Startup Command

The GitHub Actions workflow sets this automatically:
```bash
cd backend && gunicorn -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:${PORT:-8000} --timeout 600
```

**Why gunicorn?**
- More reliable on Azure App Service than uvicorn directly
- Uses uvicorn worker for ASGI support (FastAPI compatibility)
- `${PORT:-8000}` provides fallback if `$PORT` environment variable isn't set
- `--timeout 600` prevents premature timeouts on long-running requests

### Port Configuration

**IMPORTANT**: Set `WEBSITES_PORT=8000` in Azure Portal → Configuration → Application settings.

This tells Azure which port your application listens on, enabling proper traffic routing.

**Steps:**
1. Go to Azure Portal → App Service → Configuration → Application settings
2. Click "+ New application setting"
3. Name: `WEBSITES_PORT`, Value: `8000`
4. Click "Save" and restart the app service

### Environment Variables

**IMPORTANT**: Configure these in Azure Portal → Configuration → Application settings (NOT in .env files).

#### Required Variables

Set these in Azure App Service Application Settings:

- `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com`)

#### Optional Variables

- `AZURE_OPENAI_DEPLOYMENT` - Deployment name (default: `gpt-realtime`)
- `AZURE_OPENAI_API_VERSION` - API version (default: `2025-08-28`)
- `AZURE_REALTIME_SCOPE` - OAuth scope (default: `https://cognitiveservices.azure.com/.default`)
- `AZURE_SPEECH_KEY` - Azure Speech Services key (optional)
- `AZURE_SPEECH_REGION` - Speech region (default: `centralindia`)

#### Configuration Steps

1. Go to Azure Portal → App Service → Configuration → Application settings
2. Click "+ New application setting" for each variable
3. Add the required variables listed above
4. Click "Save" and restart the app service
5. Verify in Log stream that environment variables are loaded correctly

**Security Note**: Never commit `.env` files or hardcode secrets. Use Azure App Service Application Settings or GitHub Secrets only.

### Oryx Build Process

Azure App Service uses Oryx to build Python applications:
- Automatically installs dependencies from `requirements.txt` in the project root
- **Important**: Ensure `backend/requirements.txt` is used (workflow handles this)
- Oryx will install system dependencies automatically for common packages

### Build Tools Configuration

The `backend/requirements.txt` includes build tools at the top to ensure reliable deployment:
- `pip>=24.0` - Latest pip for better wheel resolution
- `setuptools>=70.0` - Required for building packages
- `wheel>=0.41.0` - Required for wheel-based installations

These are installed first to prevent `BackendUnavailable: Cannot import 'setuptools.build_meta'` errors.

### Disabling Remote Build (If Needed)

If remote build fails due to native dependencies, you can disable it:

1. Go to Azure Portal → App Service → Configuration → Application settings
2. Set `SCM_DO_BUILD_DURING_DEPLOYMENT` to `false`
3. The GitHub Actions workflow will deploy the pre-built artifact instead

**Note**: With remote build disabled, ensure all dependencies are built in CI (which they are).

## CI/CD Compatibility

### GitHub Actions

- **Runner**: `ubuntu-22.04` (pinned for stability)
- **Python**: 3.10
- **Installation**: `pip install -r backend/requirements.txt`
- **Validation**: Tests core imports before deployment

### Build Process

1. Install system dependencies (libgl1, libglib2.0-0, etc.)
2. Create virtual environment
3. Upgrade pip
4. Install Python dependencies from `backend/requirements.txt`
5. Validate imports
6. Upload artifact for deployment

## Version Compatibility Notes

### NumPy

- **Version**: `>=1.24.0,<1.26.0`
- Compatible with Python 3.10
- Pre-built wheels available for Linux

### SciPy

- **Version**: `>=1.10.0,<1.13.0`
- Compatible with Python 3.10
- Requires NumPy >= 1.24.0

### OpenCV

- **Version**: `4.8.1.78`
- Headless mode compatible (no GUI dependencies)
- Requires libgl1 and libglib2.0-0 system packages

### dlib (Optional)

- **Version**: `19.24.2`
- Only needed for `server.py`
- May require building from source if wheels unavailable
- Consider `dlib-bin` as alternative if build fails

## Troubleshooting

### Azure App Service Shows Placeholder Page

If you see "Your web app is running and waiting for your content":

**1. Check Application Logs**
- Go to Azure Portal → App Service → Log stream
- Enable "Application Logging (Filesystem)" and "Web server logging" in App Service logs
- Restart the app and watch for startup errors

**2. Verify Port Configuration**
- Ensure `WEBSITES_PORT=8000` is set in Application settings
- Check startup command uses `${PORT:-8000}` fallback
- Restart app service after changing settings

**3. Verify Folder Structure**
- Use Azure Portal → Advanced Tools (Kudu) → SSH
- Run: `cd /home/site/wwwroot && ls -la`
- Confirm `backend/` folder exists
- If missing, check deployment artifact includes entire repo root

**4. Test Application Startup**
- In Kudu SSH: `cd /home/site/wwwroot/backend`
- Run: `python -c "import app; print('App module loads')"`
- Check for import errors or missing dependencies

**5. Verify Server is Running**
- Check if process is listening: `netstat -tlnp | grep 8000`
- Test API endpoint: `curl http://localhost:8000/docs` (from Kudu SSH)
- External test: `https://your-app.azurewebsites.net/docs`

### Import Errors

If you see import errors for cv2, numpy, or scipy:

1. Verify Python version: `python --version` (should be 3.10)
2. Check system packages are installed (libgl1, libglib2.0-0)
3. Reinstall dependencies: `pip install -r backend/requirements.txt`

### dlib Build Failures

If dlib fails to install:

1. **Option 1**: Use `dlib-bin` instead (pre-built binary)
2. **Option 2**: Install build dependencies (cmake, build-essential)
3. **Option 3**: Skip dlib if only using `backend/app.py` (not required)

### Azure Deployment Failures

If deployment fails:

1. Check Python runtime version in Azure Portal (should be 3.10)
2. Verify startup command is correct (should use gunicorn)
3. Check application logs in Azure Portal → Log stream
4. Ensure environment variables are set correctly
5. Verify `WEBSITES_PORT=8000` is configured
6. Check that `backend/` folder exists in deployment artifact

## Local Development Setup

### Quick Start

```bash
# Create virtual environment
python3.10 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

# Install backend dependencies (for Azure deployment)
pip install -r backend/requirements.txt

# Or install with optional face detection (for server.py)
pip install -r requirements-base.txt
pip install -r requirements-face.txt
```

### Testing

```bash
# Test core imports
python -c "import fastapi, uvicorn, cv2, numpy, scipy; print('✓ Core imports OK')"

# Test backend app
cd backend
python -c "import app; print('✓ Backend app loads')"

# Run backend server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Summary

- **Python**: 3.10 (required)
- **OS**: Ubuntu 22.04 (CI/CD), Linux (Azure App Service)
- **Core Dependencies**: `backend/requirements.txt` (no dlib)
- **Optional**: `requirements-face.txt` (dlib for server.py only)
- **Azure**: Uses `backend/app.py` with OpenCV (no dlib needed)

For questions or issues, check the GitHub Actions logs or Azure App Service logs for detailed error messages.
