"""
transcripts.py

Given a YouTube URL, this script:
  1. Downloads the audio with yt-dlp
  2. Transcribes it with faster-whisper (word-level timestamps)
  3. Chunks the transcript into fixed-length windows
  4. Embeds each chunk with sentence-transformers
  5. Finds the windows where the topic changes the most (lowest similarity
     to the next window) and returns the top 10 as suggested pause points

Install first:
    pip install yt-dlp faster-whisper sentence-transformers numpy

Usage:
    python transcripts.py "https://www.youtube.com/watch?v=VIDEO_ID"
"""

import argparse
import os
import subprocess
import sys

import numpy as np


def download_audio(youtube_url: str, out_path: str = "audio.wav") -> str:
    """Download and extract audio from a YouTube video as a 16kHz mono wav."""
    print("Downloading audio...")
    cmd = [
        "yt-dlp",
        "-x", "--audio-format", "wav",
        "--postprocessor-args", "-ar 16000 -ac 1",
        "-o", out_path,
        youtube_url,
    ]
    subprocess.run(cmd, check=True)
    return out_path


def transcribe(audio_path: str):
    """Run faster-whisper and return a list of (start, end, text) segments."""
    from faster_whisper import WhisperModel

    print("Transcribing (this can take a bit)...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, word_timestamps=False)

    return [(seg.start, seg.end, seg.text.strip()) for seg in segments]


def chunk_segments(segments, window_seconds: float = 20.0):
    """Merge whisper segments into fixed-length time windows."""
    if not segments:
        return []

    chunks = []
    window_start = segments[0][0]
    window_end = window_start + window_seconds
    buffer_text = []

    for start, end, text in segments:
        if start >= window_end and buffer_text:
            chunks.append({
                "start": window_start,
                "end": start,
                "text": " ".join(buffer_text),
            })
            buffer_text = []
            window_start = start
            window_end = window_start + window_seconds
        buffer_text.append(text)

    if buffer_text:
        chunks.append({
            "start": window_start,
            "end": segments[-1][1],
            "text": " ".join(buffer_text),
        })

    return chunks


def find_pause_points(chunks, top_n: int = 10):
    """Score topic change between consecutive chunks and return the top N."""
    from sentence_transformers import SentenceTransformer

    print("Embedding chunks and scoring topic changes...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False)

    scored = []
    for i in range(len(chunks) - 1):
        a, b = embeddings[i], embeddings[i + 1]
        similarity = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)
        topic_change_score = 1 - similarity  # higher = bigger topic shift
        scored.append({
            "timestamp": chunks[i]["end"],
            "score": topic_change_score,
            "before": chunks[i]["text"],
            "after": chunks[i + 1]["text"],
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:top_n]
    top.sort(key=lambda x: x["timestamp"])  # chronological order for display
    return top


def format_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main():
    parser = argparse.ArgumentParser(description="Find suggested pause points in a YouTube video.")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--window", type=float, default=20.0, help="chunk window size in seconds (default 20)")
    parser.add_argument("--top", type=int, default=10, help="number of pause points to return (default 10)")
    args = parser.parse_args()

    audio_path = download_audio(args.url)
    segments = transcribe(audio_path)
    chunks = chunk_segments(segments, window_seconds=args.window)

    if len(chunks) < 2:
        print("Not enough transcript content to find pause points.")
        return

    pause_points = find_pause_points(chunks, top_n=args.top)

    print(f"\nTop {len(pause_points)} suggested pause points:\n")
    for i, p in enumerate(pause_points, 1):
        print(f"{i}. {format_time(p['timestamp'])}  (topic-change score: {p['score']:.2f})")
        print(f"   before: \"{p['before'][:80]}...\"")
        print(f"   after:  \"{p['after'][:80]}...\"\n")

    os.remove(audio_path)


if __name__ == "__main__":
    main()