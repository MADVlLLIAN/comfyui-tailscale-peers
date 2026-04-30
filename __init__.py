"""
ComfyUI Tailscale Peers Plugin
Shows Tailscale network peers in a floating sidebar panel.
"""

import os
from pathlib import Path
import server

# Register the web directory so ComfyUI serves our JS
WEB_DIRECTORY = str(Path(__file__).parent / "web")

# Import node registrations and route handlers
from .tailscale_node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
