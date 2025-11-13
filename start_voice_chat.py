import subprocess
import sys
import os

print("=" * 60)
print("Azure Realtime Voice Chat Launcher")
print("=" * 60)

# Check if dependencies are installed
print("\n[1/3] Checking dependencies...")
required = ['websockets', 'pyaudio', 'dotenv', 'azure.identity']
missing = []

for pkg in required:
    try:
        if pkg == 'dotenv':
            import dotenv
        elif pkg == 'azure.identity':
            import azure.identity
        else:
            __import__(pkg)
        print(f"  ✓ {pkg} is installed")
    except ImportError:
        print(f"  ✗ {pkg} is missing")
        missing.append(pkg)

if missing:
    print("\n[2/3] Installing missing dependencies...")
    packages = {
        'dotenv': 'python-dotenv',
        'azure.identity': 'azure-identity',
        'websockets': 'websockets',
        'pyaudio': 'pyaudio'
    }
    for pkg in missing:
        pkg_name = packages.get(pkg, pkg)
        print(f"  Installing {pkg_name}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg_name])
            print(f"  ✓ {pkg_name} installed successfully")
        except Exception as e:
            print(f"  ✗ Failed to install {pkg_name}: {e}")
            if pkg == 'pyaudio':
                print("\n  PyAudio installation failed!")
                print("  Please visit: https://www.lfd.uci.edu/~gohlke/pythonlibs/#pyaudio")
                print("  Download the appropriate .whl file for your Python version")
                print("  Then run: pip install <downloaded-file>.whl")
                input("\nPress Enter to exit...")
                sys.exit(1)
else:
    print("\n[2/3] All dependencies are installed!")

# Check environment variables
print("\n[3/3] Checking configuration...")
from dotenv import load_dotenv
load_dotenv()

required_vars = ['AZURE_PROJECT_BASE', 'AZURE_OPENAI_API_KEY', 'AZURE_REALTIME_DEPLOYMENT']
missing_vars = []

for var in required_vars:
    value = os.getenv(var)
    if value:
        if 'KEY' in var:
            print(f"  ✓ {var}: {value[:10]}...")
        else:
            print(f"  ✓ {var}: {value}")
    else:
        print(f"  ✗ {var} is not set")
        missing_vars.append(var)

if missing_vars:
    print("\n✗ Missing environment variables!")
    print("Please check your .env file and ensure these variables are set:")
    for var in missing_vars:
        print(f"  - {var}")
    input("\nPress Enter to exit...")
    sys.exit(1)

print("\n" + "=" * 60)
print("Starting Voice Chat Application...")
print("=" * 60)
print("\nThe application window should open shortly.")
print("If you don't see a window, check if it's behind other windows.")
print("\nInstructions:")
print("  1. Click 'Start Voice Chat' button")
print("  2. Wait for 'Streaming microphone...' message")
print("  3. Speak into your microphone")
print("  4. Listen to the AI response")
print("\n" + "=" * 60 + "\n")

# Launch the application
try:
    subprocess.run([sys.executable, "realtime_voice_chat.py"])
except KeyboardInterrupt:
    print("\nApplication closed by user.")
except Exception as e:
    print(f"\n✗ Error running application: {e}")
    input("\nPress Enter to exit...")
    sys.exit(1)
