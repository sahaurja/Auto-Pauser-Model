from dotenv import load_dotenv
load_dotenv()

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
import os
import time
# --- EDIT (2026-08-27): needed for shuffling MCQ answer order and for
# randomly selecting which pause points get a question. ---
import random
# --- END EDIT ---
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
import google.generativeai as genai

# frame change detection

def download_video(youtube_url, out_path="video.mp4"):
    cmd = ["yt-dlp", "-f", "bv*[height<=480]+ba/best[height<=480]", "--merge-output-format", "mp4", "-o", out_path, youtube_url]
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

# --- EDIT (2026-08-27): new helper — video length now feeds into how many
# pause points combine_pause_points() returns (see that function below). ---
def get_video_duration(video_path):
    """Total video duration in seconds, or None if it can't be read."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()
    if not fps or fps <= 0:
        return None
    return frame_count / fps
# --- END EDIT ---

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

def get_full_transcript(video_id):
    ytt_api = YouTubeTranscriptApi()
    fetched_transcript = ytt_api.fetch(video_id)
    return fetched_transcript.to_raw_data()

def get_transcript_pause_points(raw_transcript, thresh=0.5):
    nlp = spacy.load("en_core_web_md")
    docs = [nlp(s["text"]) for s in raw_transcript]
    all_pauses = []
    all_cont = []
    for i in range(len(raw_transcript) - 1):
        sim = docs[i].similarity(docs[i + 1])
        time_end = raw_transcript[i + 1]["start"]
        if sim < thresh:
            all_pauses.append({"time": time_end, "similarity": float(sim)})
        else:
            all_cont.append({"time": time_end, "similarity": float(sim)})
    return all_pauses, all_cont

def get_transcript_text_between(raw_transcript, start_time, end_time):
    texts = [s["text"] for s in raw_transcript if start_time <= s["start"] < end_time]
    return " ".join(texts)

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

# --- EDIT (2026-08-27): added score_threshold/video_duration/points_per_second
# params so the number of returned pause points can scale with video length
# and a minimum-score bar, instead of always being a flat top_n. top_n is
# kept as the fallback behavior when video_duration isn't supplied, so any
# other existing caller of this function is unaffected. ---
def combine_pause_points(frame_points, audio_points, transcript_points, cluster_window=4.0, top_n=10,
                          score_threshold=0.6, video_duration=None, points_per_second=1 / 45):
# --- END EDIT ---
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

    # --- EDIT (2026-08-27): was a flat `top = combined[:top_n]`. Now: keep
    # only clusters scoring above score_threshold, and size the result off
    # video length (~1 pause point per points_per_second^-1 seconds, min 3)
    # instead of a fixed count. Falls back to the exact old behavior if the
    # caller doesn't pass video_duration.
    # OLD: top = combined[:top_n]
    above_threshold = [c for c in combined if c["combined_score"] > score_threshold]
    if video_duration:
        max_points = max(3, round(video_duration * points_per_second))
        top = above_threshold[:max_points]
    else:
        top = combined[:top_n]
    # --- END EDIT ---

    for p in top:
        p["timestamp"] = format_timestamp(p["time"])
    return top

# question generation

LAST_CALL_TIME = 0.0
MIN_INTERVAL = 13.0

def rate_limit():
    global LAST_CALL_TIME
    elapsed = time.time() - LAST_CALL_TIME
    if elapsed < MIN_INTERVAL:
        time.sleep(MIN_INTERVAL - elapsed)
    LAST_CALL_TIME = time.time()

QUESTION_MODEL = None

def get_question_model():
    global QUESTION_MODEL
    if QUESTION_MODEL is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Set the GEMINI_API_KEY environment variable before generating questions.")
        genai.configure(api_key=api_key)
        QUESTION_MODEL = genai.GenerativeModel("gemini-2.5-flash", generation_config=genai.GenerationConfig(response_mime_type="application/json"),)
    return QUESTION_MODEL


def generate_mcq(transcript_text, max_retries=2):
    if not transcript_text or len(transcript_text.split()) < 1:
        return None

    # prompt = f"""You are creating a comprehension check for a video-based lesson.
    # Based ONLY on the following transcript excerpt, write one multiple-choice question
    # that tests whether a viewer understood the key point of this section. Do not
    # reference "the transcript" or "the excerpt" in the question itself.
    #
    # Transcript excerpt:
    # \"\"\"{transcript_text}\"\"\"
    #
    # Return JSON in exactly this shape:
    # {{
    #   "question": "...",
    #   "choices": ["...", "...", "...", "..."],
    #   "correct_index": 0,
    #   "explanation": "..."
    # }}
    # correct_index is the 0-based index into choices of the right answer."""
    prompt = f"""You are creating a comprehension check for a video-based lesson.

Based on the following transcript excerpt, write one multiple-choice question
that tests whether a viewer understood and can apply or reason about the key
idea of this section — not whether they can recall the exact wording.

Requirements:
- Do NOT quote or closely paraphrase a sentence from the transcript as the
  question or as an answer choice. Ask about the underlying concept, a
  cause/effect relationship, an application, or an inference a viewer who
  understood this section could make — not a fact lookup.
- Do not reference "the transcript", "the excerpt", or "this section" in the
  question itself; phrase it as a standalone question about the topic.
- Write three plausible, distinct wrong answers (not obviously silly), so the
  question isn't trivially guessable.

Transcript excerpt:
\"\"\"{transcript_text}\"\"\"

Return JSON in exactly this shape:
{{
  "question": "<the question text>",
  "choices": ["<choice>", "<choice>", "<choice>", "<choice>"],
  "correct_index": <integer 0-3, the position of the correct choice>,
  "explanation": "<why the correct choice is right>"
}}"""

    model = get_question_model()
    for attempt in range(max_retries + 1):
        rate_limit()
        try:
            response = model.generate_content(prompt)
            data = json.loads(response.text)
            assert len(data["choices"]) == 4
            assert 0 <= data["correct_index"] < 4

            correct_choice = data["choices"][data["correct_index"]]
            shuffled_choices = data["choices"][:]
            random.shuffle(shuffled_choices)
            data["choices"] = shuffled_choices
            data["correct_index"] = shuffled_choices.index(correct_choice)

            return data
        except Exception as e:
            is_rate_limit = "429" in str(e) or "quota" in str(e).lower()
            if attempt == max_retries:
                print(f"MCQ generation failed: {e}")
                return None
            time.sleep(15 if is_rate_limit else 2)
    return None


def attach_questions(pause_points, raw_transcript, question_coverage_range=(0.6, 0.7)):
    sorted_points = sorted(pause_points, key=lambda p: p["time"])

    coverage = random.uniform(*question_coverage_range)
    num_with_questions = round(len(sorted_points) * coverage)
    question_indices = set(
        random.sample(range(len(sorted_points)), num_with_questions)
    ) if sorted_points else set()

    prev_time = 0.0
    # for p in sorted_points:
    #     text = get_transcript_text_between(raw_transcript, prev_time, p["time"])
    #     p["question"] = generate_mcq(text)
    #     prev_time = p["time"]
    for i, p in enumerate(sorted_points):
        text = get_transcript_text_between(raw_transcript, prev_time, p["time"])
        p["question"] = generate_mcq(text) if i in question_indices else None
        prev_time = p["time"]
    return pause_points

def find_pause_points(youtube_url_or_id, sample_rate=1.0, min_pause=1.5, audio_method="vad", cluster_window=4.0, top_n=10, keep_video=True, generate_questions=True):
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
    video_duration = get_video_duration(video_path)

    frame_points = get_frame_change_points(video_path, sample_rate=sample_rate, top_n=top_n)
    audio_points = get_audio_pause_points(video_path, min_pause=min_pause, method=audio_method)
    raw_transcript = get_full_transcript(video_id)
    transcript_points, _ = get_transcript_pause_points(raw_transcript)

    # combined = combine_pause_points(frame_points, audio_points, transcript_points, cluster_window=cluster_window, top_n=top_n)
    combined = combine_pause_points(
        frame_points, audio_points, transcript_points,
        cluster_window=cluster_window, top_n=top_n, video_duration=video_duration,
    )

    if generate_questions:
        combined = attach_questions(combined, raw_transcript)
        combined.sort(key=lambda c: c["combined_score"], reverse=True)

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
    parser.add_argument("--no-questions", dest="generate_questions", action="store_false", default=True)
    args = parser.parse_args()

    result = find_pause_points(args.url, args.sample_rate, args.min_pause, args.audio_method, args.cluster_window, args.top_n, args.keep_video, args.generate_questions)

    rows = [
        {"timestamp": p["timestamp"], "sources": ", ".join(p["sources"]), "score": round(p["combined_score"], 3)}
        for p in result["pause_points"]
    ]
    print(f"Video: {result['video_id']}")
    print(tabulate(rows, headers="keys", tablefmt="psql"))

    if args.generate_questions:
        print("\nGenerated questions:\n")
        for p in sorted(result["pause_points"], key=lambda x: x["time"]):
            q = p.get("question")
            print(f"[{p['timestamp']}]")
            if q is None:
                print("No question generated, not enough transcript text in this window\n")
                continue
            print(f"Q: {q['question']}")
            for i, choice in enumerate(q["choices"]):
                marker = "*" if i == q["correct_index"] else " "
                print(f"   {marker} {chr(97 + i)}) {choice}")
            print(f"Explanation: {q['explanation']}\n")


if __name__ == "__main__":
    combined_pause_detection()