"""Native Messaging host of LMRT: Pocket TTS (Kyutai, CC BY 4.0) from the runtime that Letter installed.

Chrome starts this script through lmrt_tts_host.bat and exchanges messages with it: a 4-byte little-endian length,
then UTF-8 JSON. The script answers "status" itself (installed voices) and passes speak, warm and cancel to Letter's
engine (tts_server.py, JSON lines on stdin/stdout), whose answers it passes back. No network access; Chrome ends the
host when the reader tab closes (stdin closes), and the engine is ended with it.
"""
import json
import os
import re
import struct
import subprocess
import sys
import threading

# Letter's runtime; LMRT_TTS_RUNTIME points elsewhere (the tests use it). The engine runs on the same Python as
# this script, which lmrt_tts_host.bat takes from that runtime.
RUNTIME = os.environ.get("LMRT_TTS_RUNTIME") or os.path.join(os.environ.get("LOCALAPPDATA", ""), "Artisan", "Letter", "tts")
LANGS = ("german", "english")
VOICE = re.compile(r"^[a-z0-9_]{1,40}$")
MAX_MESSAGE = 1024 * 1024  # Chrome's limit for messages to the extension
MAX_TEXT = 2000

stdout_lock = threading.Lock()


def send(message):
    send_raw(json.dumps(message).encode("utf-8"))


def send_raw(data):
    if len(data) > MAX_MESSAGE:
        data = json.dumps({"type": "error", "id": None, "message": "message too large"}).encode("utf-8")
    with stdout_lock:
        sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
        sys.stdout.buffer.flush()


def read():
    header = sys.stdin.buffer.read(4)
    if len(header) < 4:
        return None
    (length,) = struct.unpack("<I", header)
    if length > MAX_MESSAGE:
        return None
    data = sys.stdin.buffer.read(length)
    try:
        return json.loads(data.decode("utf-8"))
    except ValueError:
        return {}


def installed_voices():
    voices = {}
    for lang in LANGS:
        base = os.path.join(RUNTIME, "models", lang)
        folder = os.path.join(base, "voices")
        names = []
        if os.path.isfile(os.path.join(base, "model.safetensors")) and os.path.isdir(folder):
            names = sorted(f[: -len(".safetensors")] for f in os.listdir(folder) if f.endswith(".safetensors"))
        voices[lang] = [n for n in names if VOICE.match(n)]
    return voices


def job_id(value):
    """A request id: a positive int (bool is an int in Python and is refused)."""
    return value if type(value) is int and value > 0 else None


def valid(job):
    op = job.get("op")
    voice_ok = job.get("lang") in LANGS and isinstance(job.get("voice"), str) and VOICE.match(job["voice"])
    if op == "warm":
        return voice_ok
    if op == "speak":
        text = job.get("text")
        return voice_ok and job_id(job.get("id")) is not None and isinstance(text, str) and 0 < len(text) <= MAX_TEXT
    if op == "cancel":
        return job_id(job.get("id")) is not None
    return False


def start_engine():
    script = os.path.join(RUNTIME, "tts_server.py")
    config = os.path.join(RUNTIME, "python", "Lib", "site-packages", "pocket_tts", "config")
    if not os.path.isfile(script):
        return None
    env = dict(os.environ, HF_HUB_OFFLINE="1", PYTHONIOENCODING="utf-8", PYTHONNOUSERSITE="1")
    return subprocess.Popen(
        [sys.executable, script, os.path.join(RUNTIME, "models"), config],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


def pump(engine):
    # Lines are passed on as they are (audio chunks are large); the extension checks every field.
    for line in engine.stdout:
        line = line.strip()
        if line.startswith(b"{"):
            send_raw(line)
    # The engine stopped (crash or quit): end the host too, so Chrome tells the extension and nothing waits forever.
    os._exit(0)


def main():
    engine = None
    while True:
        job = read()
        if job is None:
            break
        if not isinstance(job, dict):
            continue
        if job.get("op") == "status":
            send({"type": "status", "voices": installed_voices()})
            continue
        if not valid(job):
            send({"type": "error", "id": job_id(job.get("id")), "message": "invalid request"})
            continue
        if engine is None or engine.poll() is not None:
            engine = start_engine()
            if engine is None:
                send({"type": "error", "id": job.get("id"), "message": "Pocket TTS is not installed (install it in Letter)"})
                continue
            threading.Thread(target=pump, args=(engine,), daemon=True).start()
        engine.stdin.write((json.dumps(job) + "\n").encode("utf-8"))
        engine.stdin.flush()
    if engine is not None and engine.poll() is None:
        try:
            engine.stdin.write(b'{"op":"quit"}\n')
            engine.stdin.flush()
            engine.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            engine.kill()


if __name__ == "__main__":
    main()
