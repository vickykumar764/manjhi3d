#!/usr/bin/env bash
# BridgeFast SFX: synthesize effects and mix them under the narration.
# Timeline (seconds, from voice-bridge bounds /30):
#   segs: 0 | 7.97 | 15.8 | 26.53 | 36.53 | 45.73 | 55.47 | 63.47 | 72.37
#   marching 15.8-36.5 | whistle ~31, ~33.5 | chain rattles 40/43/45, creak 45.9
#   collapse 47.67 | splash 48.15 | river ambience 55.47-63.47 | soft whooshes at cuts
set -euo pipefail
cd "$(dirname "$0")"
W=/tmp/sfx; rm -rf "$W"; mkdir -p "$W"
FF="ffmpeg -y -v error"

# --- one marching step (low thump + click), padded to a 0.5s pattern cell ---
$FF -f lavfi -i "sine=frequency=85:duration=0.10" -f lavfi -i "anoisesrc=duration=0.03:color=brown" \
  -filter_complex "[0]afade=t=out:st=0.02:d=0.08,volume=0.9[a];[1]highpass=f=800,volume=0.25[b];[a][b]amix=inputs=2:normalize=0,apad=whole_dur=0.5" "$W/step.wav"
# marching bed: loop the 0.5s cell for 20.7s
$FF -stream_loop -1 -i "$W/step.wav" -t 20.7 -af "volume=0.5,afade=t=in:st=0:d=1,afade=t=out:st=19.5:d=1.2" "$W/march.wav"

# --- whistle (warbling sine), two toots ---
$FF -f lavfi -i "aevalsrc=sin(2*PI*(2100+250*sin(2*PI*7*t))*t):d=0.8:s=44100" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=0.55:d=0.25,volume=0.16" "$W/whistle1.wav"
$FF -f lavfi -i "aevalsrc=sin(2*PI*(2250+250*sin(2*PI*8*t))*t):d=0.6:s=44100" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=0.4:d=0.2,volume=0.14" "$W/whistle2.wav"

# --- chain rattle bursts (bandpassed noise with fast tremolo) ---
for i in 1 2 3; do
  case $i in 1) v=0.20;; 2) v=0.30;; 3) v=0.42;; esac
  $FF -f lavfi -i "anoisesrc=duration=0.45:color=white" -af "bandpass=f=2800:w=1200,tremolo=f=11:d=0.85,volume=$v,afade=t=out:st=0.3:d=0.15" "$W/rattle$i.wav"
done
# --- creak (low sine sweep down with wobble), 1.6s, rising into the collapse ---
$FF -f lavfi -i "aevalsrc=sin(2*PI*(150-35*t+6*sin(2*PI*3*t))*t):d=1.6:s=44100" -af "volume=0.30,afade=t=in:st=0:d=0.3,afade=t=out:st=1.3:d=0.3" "$W/creak.wav"

# --- collapse crash: noise burst + sub boom ---
$FF -f lavfi -i "anoisesrc=duration=0.5:color=brown" -f lavfi -i "aevalsrc=sin(2*PI*(72-40*t)*t):d=1.0:s=44100" \
  -filter_complex "[0]lowpass=f=900,afade=t=out:st=0.05:d=0.45,volume=0.9[a];[1]afade=t=out:st=0.1:d=0.9,volume=0.8[b];[a][b]amix=inputs=2:normalize=0,apad=whole_dur=1.1" "$W/crash.wav"
# --- splash (bandpassed noise swell) ---
$FF -f lavfi -i "anoisesrc=duration=1.9:color=white" -af "bandpass=f=750:w=900,afade=t=in:st=0:d=0.18,afade=t=out:st=0.7:d=1.2,volume=0.5" "$W/splash.wav"

# --- whoosh (soft, for major cuts) ---
$FF -f lavfi -i "anoisesrc=duration=0.4:color=white" -af "bandpass=f=600:w=700,afade=t=in:st=0:d=0.18,afade=t=out:st=0.2:d=0.2,volume=0.10" "$W/whoosh.wav"
# --- river ambience (very soft low noise), 8s ---
$FF -f lavfi -i "anoisesrc=duration=8:color=brown" -af "lowpass=f=420,volume=0.10,afade=t=in:st=0:d=1.5,afade=t=out:st=6.5:d=1.5" "$W/river.wav"

# --- assemble the SFX track (72.37s) by delaying each piece to its timestamp ---
$FF -i "$W/march.wav" -i "$W/whistle1.wav" -i "$W/whistle2.wav" -i "$W/rattle1.wav" -i "$W/rattle2.wav" \
    -i "$W/rattle3.wav" -i "$W/creak.wav" -i "$W/crash.wav" -i "$W/splash.wav" -i "$W/river.wav" \
    -i "$W/whoosh.wav" -i "$W/whoosh.wav" -i "$W/whoosh.wav" -i "$W/whoosh.wav" \
  -filter_complex "\
[0]adelay=15800:all=1[m];\
[1]adelay=31000:all=1[w1];\
[2]adelay=33500:all=1[w2];\
[3]adelay=40000:all=1[r1];\
[4]adelay=43000:all=1[r2];\
[5]adelay=45000:all=1[r3];\
[6]adelay=45900:all=1[cr];\
[7]adelay=47670:all=1[bo];\
[8]adelay=48150:all=1[sp];\
[9]adelay=55470:all=1[rv];\
[10]adelay=15800:all=1[h1];\
[11]adelay=36530:all=1[h2];\
[12]adelay=45730:all=1[h3];\
[13]adelay=55470:all=1[h4];\
[m][w1][w2][r1][r2][r3][cr][bo][sp][rv][h1][h2][h3][h4]amix=inputs=14:normalize=0,apad=whole_dur=72.37,atrim=0:72.37,alimiter=limit=0.7" \
  "$W/sfx-track.wav"

# --- final mix: narration (already has its music bed) + SFX under it ---
$FF -i public/voice-bridge.wav -i "$W/sfx-track.wav" \
  -filter_complex "[0][1]amix=inputs=2:weights='1 0.9':normalize=0,alimiter=limit=0.95" \
  public/voice-bridgefast.wav
echo "SFX BUILD OK"
ffprobe -v error -show_entries format=duration -of csv=p=0 public/voice-bridgefast.wav
