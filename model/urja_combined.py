import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any

import numpy as np

from model.audio_change_detector.audio import (
    detect_pauses_energy,
    detect_pauses_vad,
    extract_audio,
)
from model.frame_change_detector.frames import (
    compute_diff_scores,
    download_video,
    extract_frames,
)


def format_timestamp(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(round(seconds % 60))
    if secs == 60:
        minutes += 1
        secs = 0
    return f"{minutes}:{secs:02d}"


def transcribe_audio(audio_path: str) -> List[Dict[str, Any]]:
    from faster_whisper import WhisperModel

    print("Transcribing audio...")
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, vad_filter=True)
    return [
        {
            "start": float(seg.start),
            "end": float(seg.end),
            "text": (seg.text or "").strip(),
        }
        for seg in segments
        if (seg.text or "").strip()
    ]


def punctuate_text(text: str) -> str:
    try:
        from deepmultilingualpunctuation import PunctuationModel
    except Exception:
        return text

    model = PunctuationModel()
    return model.restore_punctuation(text)


def chunk_segments(segments: List[Dict[str, Any]], window_seconds: float = 20.0) -> List[Dict[str, Any]]:
    if not segments:
        return []

    chunks: List[Dict[str, Any]] = []
    window_start = segments[0]["start"]
    window_end = window_start + window_seconds
    buffer_text: List[str] = []

    for segment in segments:
        start = segment["start"]
        text = segment["text"]
        if start >= window_end and buffer_text:
            chunks.append({
                "start": window_start,
                "end": start,
                "text": " ".join(buffer_text).strip(),
            })
            buffer_text = []
            window_start = start
            window_end = window_start + window_seconds
        if text:
            buffer_text.append(text)

    if buffer_text:
        chunks.append({
            "start": window_start,
            "end": segments[-1]["end"],
            "text": " ".join(buffer_text).strip(),
        })

    return chunks


def find_transcript_pause_points(chunks: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    if len(chunks) < 2:
        return []

    from sentence_transformers import SentenceTransformer

    print("Scoring transcript topic shifts...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    texts = [chunk["text"] for chunk in chunks]
    embeddings = model.encode(texts, show_progress_bar=False)

    scored = []
    for idx in range(len(chunks) - 1):
        a = embeddings[idx]
        b = embeddings[idx + 1]
        similarity = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)
        score = float(1 - similarity)
        scored.append({
            "timestamp": float(chunks[idx]["end"]),
            "score": score,
            "before": chunks[idx]["text"],
            "after": chunks[idx + 1]["text"],
        })

    scored.sort(key=lambda item: item["score"], reverse=True)
    top = scored[:top_n]
    top.sort(key=lambda item: item["timestamp"])
    return top


def detect_frame_pause_points(video_path: str, top_n: int = 10) -> List[Dict[str, Any]]:
    print("Analyzing frame changes...")
    frames, timestamps = extract_frames(video_path, sample_rate=1)
    scores = np.asarray(compute_diff_scores(frames), dtype=float)

    if len(scores) == 0:
        return []

    top_indices = np.argpartition(scores, -top_n)[-top_n:]
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    return [
        {
            "timestamp": float(timestamps[idx]),
            "score": float(scores[idx]),
        }
        for idx in top_indices
    ]


def detect_audio_pause_points(audio_path: str, min_pause: float = 1.5) -> List[Dict[str, Any]]:
    print("Detecting audio pauses...")
    min_pause_ms = int(min_pause * 1000)
    try:
        return detect_pauses_vad(audio_path, min_pause_ms)
    except Exception:
        return detect_pauses_energy(audio_path, min_pause_ms)


def save_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Download a YouTube video, transcribe it, and suggest pause points.")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--output-dir", default="output", help="Directory for downloaded assets and generated files")
    parser.add_argument("--window", type=float, default=20.0, help="Transcript chunk window size in seconds")
    parser.add_argument("--top", type=int, default=10, help="How many pause points to report")
    parser.add_argument("--min-pause", type=float, default=1.5, help="Minimum pause length in seconds for audio detection")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    video_path = str(output_dir / "video.mp4")
    audio_path = str(output_dir / "audio.wav")
    transcript_path = output_dir / "transcript.txt"
    transcript_json_path = output_dir / "transcript.json"
    results_path = output_dir / "results.json"

    print(f"Downloading video from {args.url}...")
    download_video(args.url, out_path=video_path)

    print("Extracting audio...")
    extract_audio(video_path, audio_path)

    segments = transcribe_audio(audio_path)
    if not segments:
        raise RuntimeError("No transcript segments were generated.")

    full_text = " ".join(segment["text"] for segment in segments)
    punctuated_text = punctuate_text(full_text)
    transcript_path.write_text(punctuated_text, encoding="utf-8")

    chunks = chunk_segments(segments, window_seconds=args.window)
    transcript_pause_points = find_transcript_pause_points(chunks, top_n=args.top)

    audio_pause_points = detect_audio_pause_points(audio_path, min_pause=args.min_pause)
    frame_pause_points = detect_frame_pause_points(video_path, top_n=args.top)

    results = {
        "url": args.url,
        "audio_pauses": audio_pause_points,
        "transcript_pause_points": transcript_pause_points,
        "frame_pause_points": frame_pause_points,
        "transcript_text": punctuated_text,
    }
    save_json(results_path, results)
    save_json(transcript_json_path, {
        "segments": segments,
        "chunks": chunks,
        "transcript_pause_points": transcript_pause_points,
    })

    print("\nTranscript saved to:", transcript_path)
    print("Results saved to:", results_path)
    print("\nAudio pause points:")
    for pause in audio_pause_points:
        print(f"- {format_timestamp(pause['start'])} to {format_timestamp(pause['end'])} ({pause['duration']:.2f}s)")

    print("\nTranscript-based pause suggestions:")
    for point in transcript_pause_points:
        print(f"- {format_timestamp(point['timestamp'])} (score {point['score']:.2f})")

    print("\nFrame-change pause suggestions:")
    for point in frame_pause_points:
        print(f"- {format_timestamp(point['timestamp'])} (score {point['score']:.2f})")


if __name__ == "__main__":
    main()
