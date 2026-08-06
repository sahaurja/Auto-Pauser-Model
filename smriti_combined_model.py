# frame change detection

import cv2
from skimage.metrics import structural_similarity as ssim
import numpy as np
import argparse
import subprocess

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from pydub import AudioSegment
from pydub.silence import detect_silence
import soundfile as sf
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

import spacy
from tabulate import tabulate
import pandas as pd
from youtube_transcript_api import YouTubeTranscriptApi



def download_video(youtube_url, out_path="video.mp4"):
    cmd = ["yt-dlp", "-f", "best[height<=480]", "-o", out_path, youtube_url]
    subprocess.run(cmd, check=True)
    return out_path

def extract_frames(video_path, sample_rate):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(fps / sample_rate)
    frames = []
    timestamps = []
    frame_i = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_i % frame_interval == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frames.append(gray)
            timestamps.append(frame_i / fps)
        frame_i += 1
    cap.release()
    return frames, timestamps

def compute_diff_scores(frames):
    scores = [0]
    for i in range(1, len(frames)):
        # scores.append(np.mean(cv2.absdiff(frames[i], frames[i-1])))
        scores.append(1 - ssim(frames[i], frames[i-1]))
    return scores

def get_frame_change_points(video_path, sample_rate=1.0, top_n=10):
    frames, timestamps = extract_frames(video_path, sample_rate)
    frame_diff_scores = np.asarray(compute_diff_scores(frames))

    if len(frame_diff_scores) == 0:
        return []

    n = min(top_n, len(frame_diff_scores))
    top_idx = np.argpartition(frame_diff_scores, -n)[-n:]
    top_idx = top_idx[np.argsort(frame_diff_scores[top_idx])[::-1]]
    return [{"time": timestamps[i], "score": float(frame_diff_scores[i])} for i in top_idx]

# audio change detection

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


def format_timestamp(seconds: float) -> str:
    """Convert a number of seconds into a M:SS string, e.g. 125.4 -> '2:05'."""
    minutes = int(seconds // 60)
    secs = int(round(seconds % 60))
    if secs == 60:
        minutes += 1
        secs = 0
    return f"{minutes}:{secs:02d}"


def get_audio_pause_points(input_path, min_pause=1.5, method="vad", silence_thresh_db=-40,
                            speech_prob_thresh=0.5, wav_path=None, keep_wav=False):
    input_path = Path(input_path)
    wav_path = wav_path or str(input_path.with_name(input_path.stem + "_extracted.wav"))
    min_pause_ms = int(min_pause * 1000)

    extract_audio(str(input_path), wav_path)

    if method == "energy":
        pauses = detect_pauses_energy(wav_path, min_pause_ms, silence_thresh_db)
    else:
        pauses = detect_pauses_vad(wav_path, min_pause_ms, speech_prob_thresh=speech_prob_thresh)

    for p in pauses:
        p["time"] = p["start"]
        p["start_timestamp"] = format_timestamp(p["start"])

    if not keep_wav:
        try:
            Path(wav_path).unlink()
        except OSError:
            pass

    return pauses

# transcript pause detection

def get_transcript_pause_points(video_id, thresh=0.5):
    ytt_api = YouTubeTranscriptApi()
    fetched_transcript = ytt_api.fetch(video_id)

    nlp = spacy.load("en_core_web_md") #english model
    docs = [nlp(snippet.text) for snippet in fetched_transcript]

    all_pauses = [] #too different
    all_cont = [] #similar enough
    for i in range(len(fetched_transcript) - 1):
        sim = docs[i].similarity(docs[i + 1])
        time_end = fetched_transcript[i + 1].start
        if sim < thresh:
            all_pauses.append({"time": time_end, "similarity": float(sim)})
        else:
            all_cont.append({"time": time_end, "similarity": float(sim)})

    return all_pauses, all_cont

# combined auto pause detection

def normalize_scores(pairs):
    if not pairs:
        return []
    values = [score for _, score in pairs]
    lo, hi = min(values), max(values)
    span = (hi - lo) or 1.0
    return [(t, (score - lo) / span) for t, score in pairs]


def collapse_clusters(pairs, window):
    if not pairs:
        return []
    pairs = sorted(pairs, key=lambda p: p[0])
    clusters = []
    current = [pairs[0]]
    for t, s in pairs[1:]:
        if t - current[-1][0] <= window:
            current.append((t, s))
        else:
            clusters.append(current)
            current = [(t, s)]
    clusters.append(current)
    return [max(c, key=lambda x: x[1]) for c in clusters]


def combine_pause_points(frame_points, audio_points, transcript_points, cluster_window=4.0, top_n=10):
    normalized_frames = normalize_scores([(p["time"], p["score"]) for p in frame_points])
    frame_pairs = collapse_clusters(normalized_frames, cluster_window)
    normalized_audio = normalize_scores([(p["time"], p["duration"]) for p in audio_points])
    audio_pairs = collapse_clusters(normalized_audio, cluster_window)
    normalized_transcript = normalize_scores([(p["time"], 1 - p["similarity"]) for p in transcript_points])
    transcript_pairs = collapse_clusters(normalized_transcript, cluster_window)

    candidates = ([(t, s, "frame") for t, s in frame_pairs] + [(t, s, "audio") for t, s in audio_pairs] + [(t, s, "transcript") for t, s in transcript_pairs])
    candidates.sort(key=lambda c: c[0])

    clusters = []
    current = []
    for cand in candidates:
        if current and cand[0] - current[-1][0] > cluster_window:
            clusters.append(current)
            current = []
        current.append(cand)
    if current:
        clusters.append(current)

    combined = []
    for cluster in clusters:
        times = [c[0] for c in cluster]
        scores = [c[1] for c in cluster]
        sources = sorted({c[2] for c in cluster})
        score_sum = sum(scores)
        agreement_boost = 1 + 0.5 * (len(sources) - 1)
        combined.append({
            "time": sum(times) / len(times),
            "sources": sources,
            "combined_score": score_sum * agreement_boost,
        })

    combined.sort(key=lambda c: c["combined_score"], reverse=True)
    top = combined[:top_n]
    for p in top:
        p["timestamp"] = format_timestamp(p["time"])
    return top

def find_pause_points(youtube_url_or_id, sample_rate=1.0, min_pause=1.5, audio_method="vad", cluster_window=4.0, top_n=10, keep_video=True):
    s = youtube_url_or_id.strip()
    video_id = None
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        video_id = s
    m = re.search(r"(?:v=|be/|embed/|shorts/)([A-Za-z0-9_-]{11})", s)
    if m:
        video_id = m.group(1)
    if not video_id:
        raise ValueError(f"Could not extract a YouTube video ID from: {youtube_url_or_id!r}")
    
    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    video_path = download_video(youtube_url, out_path=f"{video_id}.mp4")

    frame_points = get_frame_change_points(video_path, sample_rate=sample_rate, top_n=top_n)
    audio_points = get_audio_pause_points(video_path, min_pause=min_pause, method=audio_method)
    transcript_points, _ = get_transcript_pause_points(video_id)

    combined = combine_pause_points(frame_points, audio_points, transcript_points, cluster_window=cluster_window, top_n=top_n)

    if not keep_video:
        try:
            Path(video_path).unlink()
        except OSError:
            pass

    return {
        "video_id": video_id,
        "pause_points": combined,
        "raw": {
            "frame": frame_points,
            "audio": audio_points,
            "transcript": transcript_points,
        },
    }


def combined_pause_detection():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--sample-rate", type=float, default=1.0)
    parser.add_argument("--min-pause", type=float, default=1.5)
    parser.add_argument("--audio-method", choices=["energy", "vad"], default="vad")
    parser.add_argument("--cluster-window", type=float, default=4.0)
    parser.add_argument("--top-n", type=int, default=10)
    parser.add_argument("--keep-video", action="store_true", default=True)
    parser.add_argument("--no-keep-video", dest="keep_video", action="store_false")
    args = parser.parse_args()

    result = find_pause_points(args.url, args.sample_rate, args.min_pause, args.audio_method, args.cluster_window, args.top_n, args.keep_video)

    rows = [
        {"timestamp": p["timestamp"], "sources": ", ".join(p["sources"]), "score": round(p["combined_score"], 3)}
        for p in result["pause_points"]
    ]
    print(f"Video: {result['video_id']}")
    print(tabulate(rows, headers="keys", tablefmt="psql"))


if __name__ == "__main__":
    combined_pause_detection()