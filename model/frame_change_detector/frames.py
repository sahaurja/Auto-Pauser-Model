import cv2
from skimage.metrics import structural_similarity as ssim
import numpy as np
import matplotlib.pyplot as plt
import argparse
import subprocess

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

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--sample-rate", type=float, default=1)
    args = parser.parse_args()
 
    video_path = download_video(args.url)

    frames, timestamps = extract_frames(video_path, args.sample_rate)
    print(f"Sampled {len(frames)} frames")

    frame_diff_scores = compute_diff_scores(frames)

    frame_diff_scores = np.asarray(frame_diff_scores)
    top_10 = np.argpartition(frame_diff_scores, -10)[-10:]
    top_10 = top_10[np.argsort(frame_diff_scores[top_10])[::-1]]
    for i in top_10:
        print(f"{int(timestamps[i])//60}:{int(timestamps[i])%60:02d}")

    plt.figure(figsize=(14, 4))
    plt.plot(timestamps, frame_diff_scores)
    plt.xlabel("Time")
    plt.ylabel("Frame diff score")
    plt.savefig("frame_diff.png")

if __name__ == "__main__":
    main()