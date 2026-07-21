"""
Pause/silence detector for audio or video files.

Pipeline:
  1. Extract audio from the input file (works on video too, via ffmpeg)
  2. Run pause detection — 'vad' (default) uses a neural voice-activity model
     that recognizes the pattern of human speech, so it isn't fooled by
     background music, hum, or noise the way plain volume-based detection is.
     'energy' is a simpler, faster volume-threshold fallback for clean audio.
  3. Output a list of pauses: {start, end, duration} in seconds,
     filtered to a minimum duration so you only get "meaningful" pauses

Usage:
  python detect_pauses.py input.mp4 --min-pause 1.5
  python detect_pauses.py input.mp3 --min-pause 1.0 --method energy

Requires ffmpeg on PATH. For the default 'vad' method, also:
  pip install torch torchaudio --break-system-packages
(first run downloads the small Silero VAD model, needs internet access once)
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

from pydub import AudioSegment
from pydub.silence import detect_silence


def extract_audio(input_path: str, out_wav: str, sample_rate: int = 16000) -> str:
    """Use ffmpeg to pull a mono WAV track out of any audio/video file."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ac", "1", "-ar", str(sample_rate),
        out_wav,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{result.stderr}")
    return out_wav


def detect_pauses_energy(wav_path: str, min_pause_ms: int, silence_thresh_db: int = -40):
    """Simple, fast energy-threshold silence detection via pydub."""
    audio = AudioSegment.from_file(wav_path)
    ranges = detect_silence(
        audio,
        min_silence_len=min_pause_ms,
        silence_thresh=silence_thresh_db,
        seek_step=10,
    )
    return [
        {"start": start / 1000, "end": end / 1000, "duration": (end - start) / 1000}
        for start, end in ranges
    ]


def detect_pauses_vad(wav_path: str, min_pause_ms: int, sample_rate: int = 16000, speech_prob_thresh: float = 0.5):
    """Speech/non-speech detection using Silero VAD — a small neural model trained
    to recognize the pattern of human speech, not just loudness. This is what makes
    it robust to background music, hum, fans, traffic, etc: a loud but non-speech
    sound doesn't get mistaken for someone talking, and a quiet voice under music
    still gets detected as speech.

    speech_prob_thresh: how confident the model must be that a chunk is speech
      (0-1). Lower it (e.g. 0.35) if quiet speech is being missed and counted as
      part of a pause; raise it (e.g. 0.6) if background music/noise is still
      being picked up as "speech."
    """
    import soundfile as sf
    import torch
    from silero_vad import load_silero_vad, get_speech_timestamps

    model = load_silero_vad()

    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:  # collapse to mono just in case
        audio = audio.mean(axis=1)
    if sr != sample_rate:
        raise ValueError(f"Expected {sample_rate}Hz audio, got {sr}Hz — extract_audio() should have resampled it.")
    wav = torch.from_numpy(audio)

    speech_segments = get_speech_timestamps(
        wav, model, sampling_rate=sample_rate, return_seconds=True,
        threshold=speech_prob_thresh,
    )

    # Pauses = gaps between consecutive speech segments (and before the first / after the last)
    pauses = []
    prev_end = 0.0
    total_duration = len(wav) / sample_rate
    for seg in speech_segments:
        gap = seg["start"] - prev_end
        if gap * 1000 >= min_pause_ms:
            pauses.append({"start": prev_end, "end": seg["start"], "duration": gap})
        prev_end = seg["end"]

    trailing_gap = total_duration - prev_end
    if trailing_gap * 1000 >= min_pause_ms:
        pauses.append({"start": prev_end, "end": total_duration, "duration": trailing_gap})

    return pauses


def main():
    parser = argparse.ArgumentParser(description="Detect pauses in an audio/video file.")
    parser.add_argument("input", help="Path to audio or video file")
    parser.add_argument("--min-pause", type=float, default=1.5, help="Minimum pause length in seconds (default 1.5)")
    parser.add_argument("--method", choices=["energy", "vad"], default="vad", help="Detection method: 'vad' (default, robust to background music/hum) or 'energy' (faster, clean audio only)")
    parser.add_argument("--silence-thresh", type=int, default=-40, help="dBFS threshold for 'energy' method (default -40)")
    parser.add_argument("--speech-prob-thresh", type=float, default=0.5, help="Speech confidence threshold for 'vad' method, 0-1 (default 0.5). Lower = catches quieter speech but may miss real pauses; higher = more aggressive at ignoring background noise as non-speech.")
    parser.add_argument("--out", default=None, help="Output JSON path (default: <input>_pauses.json)")
    args = parser.parse_args()

    input_path = Path(args.input)
    wav_path = str(input_path.with_name(input_path.stem + "_extracted.wav"))
    min_pause_ms = int(args.min_pause * 1000)

    print(f"Extracting audio from {input_path.name}...")
    extract_audio(str(input_path), wav_path)

    print(f"Running '{args.method}' pause detection (min pause = {args.min_pause}s)...")
    if args.method == "energy":
        pauses = detect_pauses_energy(wav_path, min_pause_ms, args.silence_thresh)
    else:
        pauses = detect_pauses_vad(wav_path, min_pause_ms, speech_prob_thresh=args.speech_prob_thresh)

    out_path = args.out or str(input_path.with_name(input_path.stem + "_pauses.json"))
    with open(out_path, "w") as f:
        json.dump(pauses, f, indent=2)

    print(f"\nFound {len(pauses)} pause(s) >= {args.min_pause}s:")
    for p in pauses:
        print(f"  {p['start']:.2f}s -> {p['end']:.2f}s  (duration {p['duration']:.2f}s)")
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
