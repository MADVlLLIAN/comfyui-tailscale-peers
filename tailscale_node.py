"""
ComfyUI Tailscale Peers Plugin - Backend
Shows which Tailscale peers are actively connected to this ComfyUI instance.
Cross-references live WebSocket connections against Tailscale peer IPs.
"""

import json
import subprocess
import urllib.request
import server
from aiohttp import web


def get_tailscale_peers():
    """Get all Tailscale peers with their IPs. Prefers local API, falls back to CLI."""

    # Method 1: Tailscale local API
    try:
        req = urllib.request.urlopen("http://localhost:41112/localapi/v0/status", timeout=2)
        data = json.loads(req.read().decode())
        return parse_peers(data)
    except Exception:
        pass

    # Method 2: CLI fallback
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return parse_peers(json.loads(result.stdout))
    except Exception:
        pass

    return None


def parse_peers(data):
    peers = []
    self_info = data.get("Self", {})
    if self_info:
        peers.append({
            "hostname": self_info.get("HostName", "me"),
            "dns_name": self_info.get("DNSName", ""),
            "ips": self_info.get("TailscaleIPs", []),
            "os": self_info.get("OS", ""),
            "is_self": True,
            "ts_online": True,  # self is always reachable if Tailscale is running
        })
    for key, peer in data.get("Peer", {}).items():
        peers.append({
            "hostname": peer.get("HostName", key),
            "dns_name": peer.get("DNSName", ""),
            "ips": peer.get("TailscaleIPs", []),
            "os": peer.get("OS", ""),
            "is_self": False,
            "ts_online": peer.get("Online", False),
        })
    return peers


LOOPBACK_IPS = {"127.0.0.1", "::1", "localhost"}


def get_connected_ips():
    """
    Return the set of remote IPs that currently have an open WebSocket
    connection to this ComfyUI server (i.e. are on the page right now).
    ComfyUI stores live WS connections in PromptServer.instance.sockets,
    keyed by client_id. Each ws object has a _req with a remote address.
    """
    connected = set()
    loopback_connected = False
    try:
        sockets = server.PromptServer.instance.sockets  # dict: client_id -> WebSocketResponse
        for ws in sockets.values():
            try:
                # aiohttp WebSocketResponse: ws._req.remote gives the IP
                ip = ws._req.remote
                if ip:
                    # Strip IPv6-mapped IPv4 prefix e.g. "::ffff:100.64.0.1"
                    if ip.startswith("::ffff:"):
                        ip = ip[7:]
                    if ip in LOOPBACK_IPS:
                        # Loopback means someone is connected from this machine itself
                        loopback_connected = True
                    else:
                        connected.add(ip)
            except Exception:
                pass
    except Exception:
        pass
    return connected, loopback_connected


@server.PromptServer.instance.routes.get("/tailscale/peers")
async def tailscale_peers(request):
    try:
        peers = get_tailscale_peers()

        if peers is None:
            return web.Response(
                content_type="application/json",
                text=json.dumps({
                    "status": "error",
                    "message": "Could not reach Tailscale. Make sure it is running.",
                    "peers": []
                })
            )

        connected_ips, loopback_connected = get_connected_ips()

        result = []
        for peer in peers:
            # A peer is "online" if one of their Tailscale IPs has an active WS connection,
            # OR if they are the self node and someone is connected via loopback (127.0.0.1/::1)
            online = any(ip in connected_ips for ip in peer["ips"])
            if not online and peer["is_self"] and loopback_connected:
                online = True
            result.append({
                "hostname": peer["hostname"],
                "dns_name": peer["dns_name"],
                "ip": peer["ips"][0] if peer["ips"] else "",
                "online": online,
                "ts_online": peer.get("ts_online", False) or peer["is_self"],
                "os": peer["os"],
                "is_self": peer["is_self"],
            })

        # Sort: comfyui-active first, then tailscale-idle, then offline, then alpha
        result.sort(key=lambda p: (not p["online"], not p["ts_online"], not p["is_self"], p["hostname"].lower()))

        return web.Response(
            content_type="application/json",
            text=json.dumps({"status": "ok", "peers": result})
        )

    except Exception as e:
        return web.Response(
            content_type="application/json",
            text=json.dumps({"status": "error", "message": str(e), "peers": []}),
            status=500
        )


NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
