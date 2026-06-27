# GitHub Actions Workflow Debugging Guide

## How to View GitHub Actions Logs

### Option 1: Via GitHub Web Interface
1. Go to: `https://github.com/Ignitzsolutions/evaluate-yourself/actions`
2. Click on the workflow run: "Build and deploy Python app to Azure Web App - projecte"
3. Click on the failed job (build or deploy)
4. Expand each step to see detailed logs

### Option 2: Via GitHub CLI (if installed)
```bash
gh run list --workflow=main_projecte.yml --limit 5
gh run view <run-id> --log
```

## Potential Issues Identified

### 1. **Python Version Compatibility**
- **Issue**: Using Python 3.14 (very new, released Oct 2025)
- **Risk**: Some packages in `requirements.txt` may not be compatible
- **Packages of concern**:
  - `numpy==1.24.3` - May not support Python 3.14
  - `scipy>=1.11.0,<1.12.0` - May have compatibility issues
  - `dlib==19.24.2` - Requires CMake and may not support Python 3.14
- **Recommendation**: Consider using Python 3.11 or 3.12 for better compatibility

### 2. **Azure Login Authentication**
- **Current**: Using Azure-provided secrets (OIDC authentication)
- **Issue**: Missing explicit OIDC configuration
- **Check**: Verify federated credentials are set up in Azure AD
- **Location**: Azure Portal → App Registrations → Your App → Certificates & secrets → Federated credentials

### 3. **Deployment Package Path**
- **Current**: No `package` parameter specified
- **Comparison**: `azure-deploy.yml` uses `package: ./backend`
- **Issue**: Deploying entire root directory might include unnecessary files
- **Recommendation**: Specify `package: .` explicitly or use a specific path

### 4. **Build Dependencies**
- **OpenBLAS**: ✅ Installed correctly
- **Other system dependencies**: May need additional packages for:
  - `dlib` (requires CMake, dlib-dev)
  - `opencv-python` (may need libgl1-mesa-glx, libglib2.0-0)

## Common Error Patterns to Look For

### Build Job Failures:
1. **Python version not found**: Check if Python 3.14 is available
2. **Package installation errors**: Check package compatibility with Python 3.14
3. **Missing system libraries**: Check for CMake, OpenCV dependencies
4. **OpenBLAS errors**: Should be fixed with the installation step

### Deploy Job Failures:
1. **Azure authentication errors**: 
   - "AADSTS70021: No matching federated identity record found"
   - Check federated credentials in Azure AD
2. **Permission errors**: 
   - "Authorization failed"
   - Verify service principal has Contributor role
3. **Deployment errors**:
   - "Package deployment failed"
   - Check app-name and slot-name are correct

## Recommended Fixes

### Fix 1: Use Python 3.11 (More Stable)
```yaml
- name: Set up Python version
  uses: actions/setup-python@v5
  with:
    python-version: '3.11'
```

### Fix 2: Add Additional System Dependencies
```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libopenblas-dev \
      cmake \
      libgl1-mesa-glx \
      libglib2.0-0
```

### Fix 3: Explicit Package Path
```yaml
- name: 'Deploy to Azure Web App'
  uses: azure/webapps-deploy@v3
  with:
    app-name: 'projecte'
    slot-name: 'Production'
    package: .
```

## Next Steps

1. **View the actual logs** from GitHub Actions to see the exact error
2. **Check Azure AD** federated credentials configuration
3. **Consider downgrading** Python version if compatibility issues arise
4. **Add more system dependencies** if build fails on specific packages
