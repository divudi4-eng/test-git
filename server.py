#!/usr/bin/env python3
"""
AudioBook Reader Backend Server
- Serves static web frontend (index.html, style.css, app.js)
  Accessible at http://localhost:8080/test_agent/ and http://localhost:8080/
- Provides /api/tts-export endpoint for downloading full page/chapter as MP3 audio files
Zero external pip dependencies required.
"""
import http.server
import socketserver
import os
import sys
import json
import urllib.request
import urllib.parse
import re

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def split_text_for_tts(text, max_len=150):
    """Splits text into chunks <= max_len suitable for TTS requests."""
    chunks = []
    parts = re.split(r'([.?!,;\n]+)', text)
    curr = ""
    for part in parts:
        if len(curr) + len(part) <= max_len:
            curr += part
        else:
            if curr.strip():
                chunks.append(curr.strip())
            curr = part
    if curr.strip():
        chunks.append(curr.strip())
    return chunks or [text[:max_len]]

def fetch_tts_audio_mp3(text, lang="en"):
    """Fetches and stitches MP3 audio chunks from Google TTS."""
    chunks = split_text_for_tts(text)
    combined_audio = bytearray()
    
    for chunk in chunks:
        if not chunk.strip():
            continue
        encoded = urllib.parse.quote(chunk)
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang}&q={encoded}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                combined_audio.extend(resp.read())
        except Exception as e:
            sys.stderr.write(f"TTS fetch error for chunk '{chunk[:20]}...': {e}\n")
            continue
            
    return bytes(combined_audio)

AUDIO_CACHE = {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        # Strip /test_agent prefix so it maps directly into this directory
        if path.startswith("/test_agent/"):
            path = "/" + path[len("/test_agent/"):]
        elif path == "/test_agent":
            path = "/"
        return super().translate_path(path)

    def do_GET(self):
        clean_path = self.path
        if clean_path.startswith("/test_agent"):
            clean_path = clean_path[len("/test_agent"):]

        # Streaming Audio for Sentences
        if clean_path.startswith("/api/tts-stream"):
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            text = qs.get("text", [""])[0]
            lang = qs.get("lang", ["en"])[0]
            if not text.strip():
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error": "Empty text"}')
                return

            cache_key = f"{lang}:{text}"
            mp3_data = AUDIO_CACHE.get(cache_key)
            if not mp3_data:
                mp3_data = fetch_tts_audio_mp3(text, lang)
                if mp3_data:
                    if len(AUDIO_CACHE) > 300:
                        AUDIO_CACHE.clear()
                    AUDIO_CACHE[cache_key] = mp3_data

            if not mp3_data:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"error": "Audio synthesis failed"}')
                return

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(mp3_data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(mp3_data)
            return

        # Redirect / to /test_agent/
        if self.path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/test_agent/")
            self.end_headers()
            return

        # Redirect /test_agent to /test_agent/ for proper relative paths
        if self.path == "/test_agent":
            self.send_response(301)
            self.send_header("Location", "/test_agent/")
            self.end_headers()
            return

        return super().do_GET()

    def do_HEAD(self):
        if self.path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/test_agent/")
            self.end_headers()
            return

        if self.path == "/test_agent":
            self.send_response(301)
            self.send_header("Location", "/test_agent/")
            self.end_headers()
            return

        return super().do_HEAD()

    def do_POST(self):
        clean_path = self.path
        if clean_path.startswith("/test_agent"):
            clean_path = clean_path[len("/test_agent"):]

        if clean_path == "/api/tts-export":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode("utf-8"))
                text = data.get("text", "")
                lang = data.get("lang", "en")
                filename = data.get("filename", "audiobook_page.mp3")
                
                if not text.strip():
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Text is empty"}')
                    return

                mp3_data = fetch_tts_audio_mp3(text, lang)
                
                if not mp3_data:
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"error": "Failed to synthesize audio"}')
                    return

                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Content-Length", str(len(mp3_data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(mp3_data)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_error(404, "Endpoint not found")

    def log_message(self, format, *args):
        sys.stderr.write("%s - - [%s] %s\n" %
                         (self.address_string(),
                          self.log_date_time_string(),
                          format % args))

def run():
    socketserver.TCPServer.allow_reuse_address = True
    port = PORT
    for p in range(PORT, PORT + 20):
        try:
            with socketserver.TCPServer(("", p), Handler) as httpd:
                print("==================================================")
                print(f"🎧 AudioBook Reader App is running!")
                print(f"📱 Open in your browser: http://localhost:{p}/test_agent/")
                print(f"📁 Serving folder: {DIRECTORY}")
                print(f"✨ Accessible via: http://localhost:{p}/test_agent/")
                print("Press Ctrl+C to stop the server.")
                print("==================================================")
                httpd.serve_forever()
                break
        except OSError:
            continue

if __name__ == "__main__":
    run()
