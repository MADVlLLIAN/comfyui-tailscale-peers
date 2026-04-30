# ComfyUI Tailscale Peers Panel

A lightweight ComfyUI plugin that shows who's online on your Tailscale network in a floating, draggable panel.

## Features
- 🟢 Live online/offline status for all Tailscale peers
- 🖥️ OS detection icons (Windows, Linux, macOS, iOS, Android)
- 🕒 Last-seen time for offline peers
- 🔄 Auto-refreshes every 15 seconds
- 🖱️ Draggable, collapsible panel

## Installation

1. Copy the `tailscale_peers` folder into your ComfyUI custom nodes directory:

```
ComfyUI/
└── custom_nodes/
    └── tailscale_peers/       ← put it here
        ├── __init__.py
        ├── tailscale_node.py
        └── web/
            └── tailscale_peers.js
```

2. Restart ComfyUI.

## Requirements

- **Tailscale must be running** on the machine running ComfyUI.
- The `tailscale` CLI should be in your system PATH (it usually is after install).
  - On Linux: `/usr/bin/tailscale`
  - On macOS: `/usr/local/bin/tailscale` or via Homebrew
  - On Windows: usually auto-added to PATH by the installer

The plugin tries two methods to get peer data:
1. `tailscale status --json` via CLI (preferred)
2. Tailscale local API at `localhost:41112` (fallback)

## Troubleshooting

**Panel shows "Tailscale unavailable"**
- Make sure Tailscale is connected: `tailscale status`
- Make sure the CLI is accessible: `which tailscale`

**Panel doesn't appear**
- Open browser devtools console and look for errors
- Make sure the `web/` directory is present inside the plugin folder
