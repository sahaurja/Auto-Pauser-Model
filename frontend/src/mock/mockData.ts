const YOUTUBE_ID_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX)
  return match ? match[1] : null
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url.trim()) !== null
}
