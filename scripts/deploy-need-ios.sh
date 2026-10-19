#!/usr/bin/env bash
set -e

PROJECT_DIR="/home/Charis/projects/Need"
WIN_DEST="/mnt/c/Users/obune/OneDrive/Documents/Need/Need.ipa"
BUSID="2-2"

echo "=================================================="
echo "📱 iOS Deployment: Build, Sign, and Install on iPhone"
echo "=================================================="

# 1. Check & ensure USB passthrough
if ! idevice_id -l 2>/dev/null | grep -q '00008130'; then
    echo "Connecting iPhone via usbipd (BusID: $BUSID)..."
    "/mnt/c/Program Files/usbipd-win/usbipd.exe" attach --wsl --busid "$BUSID" 2>/dev/null || true
    sleep 2
fi

DEVICE_NAME=$(ideviceinfo -k DeviceName 2>/dev/null || echo "Charis's iPhone")
echo "Target Device: $DEVICE_NAME"

# 2. Build & Sign with xtool
echo "--> Building and signing Need.ipa with xtool..."
cd "$PROJECT_DIR"
xtool dev build --ipa --sign

# 3. Install directly to iPhone
echo "--> Installing signed Need.ipa on $DEVICE_NAME..."
ideviceinstaller install "$PROJECT_DIR/xtool/Need.ipa"

# 4. Sync to Windows workspace
if [ -d "$(dirname "$WIN_DEST")" ]; then
    cp "$PROJECT_DIR/xtool/Need.ipa" "$WIN_DEST"
    echo "--> Copied signed IPA to Windows: $WIN_DEST"
fi

echo "✅ COMPLETE: Need.ipa installed and live on $DEVICE_NAME!"
