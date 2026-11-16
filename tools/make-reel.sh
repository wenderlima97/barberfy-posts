#!/usr/bin/env bash
# Uso: bash tools/make-reel.sh spec.json saida.mp4  (vídeo em motion + trilha + efeitos)
set -euo pipefail
cd "$(dirname "$0")/.."
SPEC="$1"; OUT="$2"; T=$(mktemp -d)
node tools/reel.js "$SPEC" "$T/silent.mp4" "$T/timeline.json"
python3 tools/audio.py "$T/timeline.json" "$T/audio.wav"
ffmpeg -y -loglevel error -i "$T/silent.mp4" -i "$T/audio.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT.tmp.mp4"
mv "$OUT.tmp.mp4" "$OUT"; echo "reel ok: $OUT"
