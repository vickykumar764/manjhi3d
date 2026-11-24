#!/bin/bash
# Resumable chunked local render of Manjhi2 (2781 frames) — fallback route.
# Renders 100-frame chunks into out/chunks/; skips chunks that already exist
# and probe OK, so a VM restart loses at most one chunk. Run detached:
#   nohup bash render-chunks.sh > out/chunks.log 2>&1 &
cd "$(dirname "$0")" || exit 1
mkdir -p out/chunks
TOTAL=2781
SIZE=100
for ((start=0; start<TOTAL; start+=SIZE)); do
  end=$((start+SIZE-1)); [ $end -ge $TOTAL ] && end=$((TOTAL-1))
  f=$(printf "out/chunks/c%04d-%04d.mp4" $start $end)
  if [ -s "$f" ] && ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" >/dev/null 2>&1; then
    echo "$(date -Is) SKIP $f (exists)"
    continue
  fi
  echo "$(date -Is) RENDER $f frames $start-$end"
  npx remotion render src/index.ts Manjhi2 "$f" --frames=$start-$end --concurrency=1 --timeout=900000 --crf=18 >> out/chunks.log 2>&1
  echo "$(date -Is) DONE $f rc=$?"
done
echo "$(date -Is) ALL CHUNKS DONE"
