#!/usr/bin/env bash
set -e

PROJECT_DIR="/home/Charis/projects/Need"
WIN_DEST="/mnt/c/Users/obune/OneDrive/Documents/Need/Need.ipa"
RUNNER=""

if [ -f "/home/Charis/with-relay.sh" ]; then
    RUNNER="/home/Charis/with-relay.sh"
fi

echo "=================================================="
echo "📱 iOS Multi-Device Deployment: Need.ipa"
echo "=================================================="

# 1. Sync lockdown plists from Windows host to WSL if available
if [ -d "/mnt/c/ProgramData/Apple/Lockdown" ]; then
    sudo cp /mnt/c/ProgramData/Apple/Lockdown/*.plist /var/lib/lockdown/ 2>/dev/null || true
    sudo chown -R usbmux:plugdev /var/lib/lockdown 2>/dev/null || true
fi

# 2. Check for connected Apple devices in usbipd and attach them to WSL
if [ -f "/mnt/c/Program Files/usbipd-win/usbipd.exe" ]; then
    USBIPD="/mnt/c/Program Files/usbipd-win/usbipd.exe"
    # Find all bus IDs for Apple devices (VID 05ac) from the Connected section ONLY
    APPLE_BUSES=$("$USBIPD" list 2>/dev/null | sed '/Persisted:/q' | grep -iE '05ac|Apple' | awk '{print $1}' || true)
    for BUS in $APPLE_BUSES; do
        if [ -n "$BUS" ]; then
            echo "--> Attaching Apple USB device on BusID $BUS via usbipd..."
            "$USBIPD" attach --wsl --busid "$BUS" 2>/dev/null || true
        fi
    done
fi

# 3. Detect connected devices via relay and native usbmuxd
RELAY_DEVICES=""
if [ -n "$RUNNER" ]; then
    RELAY_DEVICES=$($RUNNER idevice_id -l 2>/dev/null || true)
fi
NATIVE_DEVICES=$(idevice_id -l 2>/dev/null || true)

DEVICES=$(printf "%s\n%s\n" "$RELAY_DEVICES" "$NATIVE_DEVICES" | sed '/^[[:space:]]*$/d' | sort -u)

echo "Connected Device UDID(s):"
if [ -n "$DEVICES" ]; then
    echo "$DEVICES"
else
    echo "None detected yet."
fi

# 4. Build & Sign with xtool if Need.ipa does not exist or rebuild requested
if [ ! -f "$PROJECT_DIR/xtool/Need.ipa" ] || [ "$1" == "--build" ] || [ "$1" == "--rebuild" ]; then
    echo "--> Building and signing Need.ipa with xtool..."
    cd "$PROJECT_DIR"
    xtool dev build --ipa --sign
fi

# Sync to Windows workspace
if [ -f "$PROJECT_DIR/xtool/Need.ipa" ] && [ -d "$(dirname "$WIN_DEST")" ]; then
    cp "$PROJECT_DIR/xtool/Need.ipa" "$WIN_DEST"
    echo "--> Synced signed IPA to Windows: $WIN_DEST"
fi

# 5. Install on all detected devices
if [ -z "$DEVICES" ]; then
    echo "⚠️  No iOS devices found via USB or Relay."
    echo "Please ensure for BOTH devices (iPhone 15 Pro & iPhone X):"
    echo "  1. Device screens are UNLOCKED (iOS USB Restricted Mode blocks USB until unlocked)."
    echo "  2. You tapped 'Trust This Computer' and entered the passcode on each device."
    echo "  3. The USB cables are data-capable and securely plugged into the computer."
    exit 1
fi

COUNT=0
for UDID in $DEVICES; do
    [ -z "$UDID" ] && continue
    COUNT=$((COUNT + 1))
    
    # Try fetching device name with RUNNER or directly
    DEV_NAME=""
    if [ -n "$RUNNER" ]; then
        DEV_NAME=$($RUNNER ideviceinfo -u "$UDID" -k DeviceName 2>/dev/null || true)
        DEV_MODEL=$($RUNNER ideviceinfo -u "$UDID" -k ProductType 2>/dev/null || true)
    fi
    if [ -z "$DEV_NAME" ]; then
        DEV_NAME=$(ideviceinfo -u "$UDID" -k DeviceName 2>/dev/null || echo "iOS Device $COUNT")
        DEV_MODEL=$(ideviceinfo -u "$UDID" -k ProductType 2>/dev/null || echo "iPhone")
    fi

    echo ""
    echo "--------------------------------------------------"
    echo "📲 [$COUNT] Installing on $DEV_NAME ($DEV_MODEL | $UDID)..."
    echo "--------------------------------------------------"
    
    INSTALLED=false
    if [ -n "$RUNNER" ]; then
        if $RUNNER ideviceinstaller -u "$UDID" install "$PROJECT_DIR/xtool/Need.ipa"; then
            INSTALLED=true
        fi
    fi
    
    if [ "$INSTALLED" = "false" ]; then
        ideviceinstaller -u "$UDID" install "$PROJECT_DIR/xtool/Need.ipa"
    fi
    
    echo "✅ COMPLETE: Installed on $DEV_NAME ($UDID)!"
done

echo ""
echo "=================================================="
echo "🎉 ALL DONE: Need.ipa installed on $COUNT connected device(s)!"
echo "=================================================="
