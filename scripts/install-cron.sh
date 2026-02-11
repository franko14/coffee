#!/bin/bash
# Install Coffee Monitor as a scheduled launchd job

PLIST_NAME="com.coffee.monitor.plist"
PLIST_SOURCE="$(dirname "$0")/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "Installing Coffee Monitor scheduler..."

# Create logs directory
mkdir -p "$(dirname "$0")/../logs"

# Copy plist to LaunchAgents
cp "$PLIST_SOURCE" "$PLIST_DEST"

# Unload if already loaded (ignore errors)
launchctl unload "$PLIST_DEST" 2>/dev/null

# Load the new plist
launchctl load "$PLIST_DEST"

echo "✓ Coffee Monitor scheduled!"
echo "  - Runs at 7:00 AM daily"
echo "  - Runs on login/startup"
echo ""
echo "Logs: $(dirname "$0")/../logs/"
echo ""
echo "To uninstall: launchctl unload $PLIST_DEST && rm $PLIST_DEST"
