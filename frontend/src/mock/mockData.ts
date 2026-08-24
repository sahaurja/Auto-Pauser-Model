import type { ProcessedVideoData } from '../types'

/**
 * Mock "processed video" records, shaped to match the eventual real API
 * response so this file is a drop-in swap once the backend exists. These are
 * templates only — LibraryContext attaches a userId when it seeds/stores them
 * for a specific logged-in user.
 */
export const mockVideos: ProcessedVideoData[] = [
  {
    videoId: 'dQw4w9WgXcQ',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Introduction to Photosynthesis',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    processedDate: '2026-08-10',
    pausePoints: [
      { timestamp: 8, hasQuestion: false },
      {
        timestamp: 20,
        hasQuestion: true,
        question: {
          prompt: 'What are the two main inputs to photosynthesis?',
          choices: [
            'Water and carbon dioxide',
            'Oxygen and glucose',
            'Nitrogen and sunlight',
            'Water and oxygen',
          ],
          correctIndex: 0,
          explanation:
            'Plants take in water through their roots and carbon dioxide through their leaves to produce glucose and oxygen.',
        },
      },
      { timestamp: 34, hasQuestion: false },
      {
        timestamp: 47,
        hasQuestion: true,
        question: {
          prompt: 'Where in the plant cell does photosynthesis take place?',
          choices: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'],
          correctIndex: 2,
          explanation:
            'Chloroplasts contain chlorophyll, the pigment that captures light energy for photosynthesis.',
        },
      },
      {
        timestamp: 61,
        hasQuestion: true,
        question: {
          prompt: 'What gas is released as a byproduct of photosynthesis?',
          choices: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'],
          correctIndex: 1,
          explanation:
            'Oxygen is released as plants split water molecules to obtain electrons for the light reactions.',
        },
      },
      { timestamp: 75, hasQuestion: false },
    ],
  },
  {
    videoId: 'M7lc1UVf-VE',
    youtubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    title: 'The French Revolution, Explained',
    thumbnailUrl: 'https://img.youtube.com/vi/M7lc1UVf-VE/mqdefault.jpg',
    processedDate: '2026-08-05',
    pausePoints: [
      { timestamp: 10, hasQuestion: false },
      {
        timestamp: 26,
        hasQuestion: true,
        question: {
          prompt: 'What year did the French Revolution begin?',
          choices: ['1776', '1789', '1804', '1815'],
          correctIndex: 1,
          explanation:
            'The French Revolution began in 1789 with the storming of the Bastille.',
        },
      },
      { timestamp: 42, hasQuestion: false },
      {
        timestamp: 58,
        hasQuestion: true,
        question: {
          prompt: 'Which of these was a major cause of the revolution?',
          choices: [
            'Widespread famine and economic crisis',
            'A foreign invasion',
            'A newly discovered continent',
            'A royal abdication',
          ],
          correctIndex: 0,
          explanation:
            'Poor harvests, debt from war spending, and an unfair tax system pushed France into crisis.',
        },
      },
    ],
  },
  {
    videoId: 'kXYiU_JCYtU',
    youtubeUrl: 'https://www.youtube.com/watch?v=kXYiU_JCYtU',
    title: 'How Neural Networks Learn',
    thumbnailUrl: 'https://img.youtube.com/vi/kXYiU_JCYtU/mqdefault.jpg',
    processedDate: '2026-07-28',
    pausePoints: [
      { timestamp: 15, hasQuestion: false },
      {
        timestamp: 33,
        hasQuestion: true,
        question: {
          prompt: 'What is backpropagation used for?',
          choices: [
            'Compressing image files',
            'Computing gradients to update weights',
            'Encrypting network traffic',
            'Rendering 3D graphics',
          ],
          correctIndex: 1,
          explanation:
            'Backpropagation computes how much each weight contributed to the error, so it can be adjusted to reduce that error.',
        },
      },
      { timestamp: 50, hasQuestion: false },
    ],
  },
]

/**
 * Generates a mock processed-video record for a freshly submitted URL.
 * `withQuestions=false` forces every pause point to hasQuestion: false,
 * matching the Home screen's "Generate questions: No" toggle.
 */
export function generateMockResult(
  youtubeUrl: string,
  withQuestions: boolean,
): ProcessedVideoData {
  const base = mockVideos[0]
  const videoId = extractYouTubeId(youtubeUrl) ?? base.videoId

  return {
    videoId,
    youtubeUrl,
    title: 'Newly Processed Video',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    processedDate: new Date().toISOString().slice(0, 10),
    pausePoints: base.pausePoints.map((p) => ({
      timestamp: p.timestamp,
      hasQuestion: withQuestions && p.hasQuestion,
      question: withQuestions ? p.question : undefined,
    })),
  }
}

const YOUTUBE_ID_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX)
  return match ? match[1] : null
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url.trim()) !== null
}
