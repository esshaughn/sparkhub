#!/bin/bash
# Schedule scripts/backup-live.sh to run weekly on this Mac (Sundays 03:30).
# If the Mac is asleep then, macOS runs it at the next wake.
#
# The script is copied to ~/.local/share/torrezhub/ because macOS doesn't let
# background jobs read from ~/Desktop. Rerun this installer after editing
# backup-live.sh so the scheduled copy picks up the change.
#
# Uninstall:
#   launchctl bootout gui/$(id -u)/com.torrezhub.backup
#   rm ~/Library/LaunchAgents/com.torrezhub.backup.plist

set -euo pipefail

LABEL=com.torrezhub.backup
SRC="$(cd "$(dirname "$0")" && pwd)/backup-live.sh"
DIR="$HOME/.local/share/torrezhub"
LOGDIR="$HOME/Backups/torrezhub"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$DIR" "$LOGDIR" "$HOME/Library/LaunchAgents"
chmod 700 "$LOGDIR"
install -m 700 "$SRC" "$DIR/backup-live.sh"

cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DIR/backup-live.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>3</integer>
    <key>Minute</key><integer>30</integer>
  </dict>
  <key>StandardOutPath</key><string>$LOGDIR/backup.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/backup.log</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string></dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed. Weekly backups → $LOGDIR (log: $LOGDIR/backup.log)"
echo "Run one now with: launchctl kickstart gui/$(id -u)/$LABEL"
