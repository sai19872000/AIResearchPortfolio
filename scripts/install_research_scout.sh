#!/usr/bin/env bash
# install_research_scout.sh — a systemd --user timer that runs the proactive
# research scout once a day. The scout discovers + vets new AI/ML research and
# big-lab announcements and writes the top 1-3 to Firestore `researchCandidates`;
# @Bloggersaibot then asks Sai to approve each. Probe-only: never posts.
set -euo pipefail

REPO="/home/sai/AIResearchPortfolio"
PY="/home/linuxbrew/.linuxbrew/bin/python3"
UNIT_DIR="$HOME/.config/systemd/user"
WHEN="${SCOUT_ONCALENDAR:-*-*-* 08:00:00}"   # daily, local time
mkdir -p "$UNIT_DIR"

cat > "$UNIT_DIR/saiteja-research-scout.service" <<EOF
[Unit]
Description=saiteja.ai research scout — daily discover+vet of new research/announcements (writes recommendations, never posts)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO
Environment=PATH=/home/sai/.local/bin:/home/linuxbrew/.linuxbrew/bin:/usr/local/bin:/usr/bin:/bin
Environment=SITE_BASE_URL=https://saiteja.ai
# the deep multi-agent gate makes several claude -p calls; give it room
TimeoutStartSec=1800
ExecStart=$PY $REPO/scripts/research_scout.py --once
EOF

cat > "$UNIT_DIR/saiteja-research-scout.timer" <<EOF
[Unit]
Description=Run the saiteja.ai research scout daily

[Timer]
OnCalendar=$WHEN
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now saiteja-research-scout.timer
echo "OK: saiteja-research-scout.timer enabled ($WHEN local)."
echo "Run now: systemctl --user start saiteja-research-scout.service"
echo "Logs:    journalctl --user -u saiteja-research-scout.service -f"
