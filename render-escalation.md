# Render escalation plan — Manjhi2 (2781 frames)

## Problem (measured 2026-11-24 13:46 IST)
Local render: 2 frames in ~11 min → Remotion's own estimate **~250h** for the full
video. SwiftShader (CPU WebGL) at 1080x1920 with LensBlur + Bloom + MSAA 4 is
the bottleneck. VM has 1.5 shared CPUs and restarts often — a 250h single run
will never finish, and a restart loses all progress (Remotion does not resume).

## Why plain parallel chunking is NOT enough
- Total CPU cost ≈ 2781 frames x ~5 min ≈ **230 CPU-hours**.
- GitHub Actions free tier = 2000 min/month (~33h) — far too small.
- Colab free CPU = same speed class as this VM.
- Parallelising across runners helps wall-time only if total CPU-hours fit the
  free quota. They don't. **The per-frame cost must fall — i.e. a real GPU.**

## Escalation route: GPU headless-Chrome render (Kaggle / Colab, free GPU)
Kaggle gives ~30h/week free GPU (T4/P100); Colab free gives a T4.
Test first (one frame, BridgeRef frame 60 — known-good):
1. Notebook: clone/copy project WITHOUT node_modules, `npm ci`, then
   `npx remotion still src/index.ts BridgeRef out/test-gpu.png --frame=60`
   with Chrome flags `--use-gl=angle --use-angle=gl` (EGL on the NVIDIA GPU)
   and fallbacks `--use-angle=vulkan`, `--use-gl=swiftshader` for comparison.
2. Time the still. If GPU path gives a frame in seconds (vs ~5 min CPU),
   render the full video in frame-range chunks on the GPU runner.
3. Chunks: 8 x ~348 frames (`--frames=start-end`), download each chunk mp4,
   stitch locally with ffmpeg concat (re-encode once, crf 18).

## Chunked local fallback (resumable across VM restarts)
If GPU fails, do NOT run one 2781-frame render. Run 8 sequential chunk renders
(`--frames=0-347`, `348-695`, ...) each writing its own mp4; a watchdog restarts
only the missing chunk. Same total CPU time (~230h) — only a last resort, and
the user must be told honestly that local full-quality rendering takes days.

## Status
- 2026-11-24 13:46: local render alive, 2/2781, ~250h estimate. Kept running
  as a fallback while the GPU route is tested. Pace to be re-checked by the
  render-watch cron every 30 min.
- 2026-11-24 14:29: COLAB GPU TEST FAILED — 4 connect attempts, every one
  "Failed to assign backend: No backend with GPU available" (free T4 quota
  exhausted today). Notebook saved in user's Drive
  (Untitled3.ipynb, runtime still set to T4 GPU) — retry later/off-peak.
  Paid Colab NOT authorized. Next: try Kaggle free GPU (30h/week) with the
  same tarball + one-frame test.
- 2026-11-24 17:17: KAGGLE TEST COMPLETE — 2x Tesla T4 (15.4 GB each),
  Node 22, npm ci in 12 s. One cold BridgeRef frame: 2m16s plain,
  2m50s with --use-gl=angle --use-angle=gl (GPU flags SLOWER).
  Chromium needed apt system libs (libatk etc.) + --timeout=120000
  (30 s default is too short for first scene load). Key insight: the
  2+ min is scene LOAD/shader setup, not per-frame rasterization — a
  full render reuses the loaded page, so steady-state cost/frame is
  probably far lower. Next: 30-frame timing test on Kaggle, then full
  render in chunks if <=30 s/frame incl. warm-up. Session was stopped;
  project persists as private Kaggle dataset "manjhi3d-src".
- 2026-11-24 17:11: COLAB RETRY FAILED AGAIN (2 more attempts, 6 total
  today). Night retry scheduled 23:30 IST (cron colab-gpu-retry-night).
