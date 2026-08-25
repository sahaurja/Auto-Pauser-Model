import type { ProcessedVideoData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export type JobStatus = 'processing' | 'done' | 'error'

export interface StartProcessingResult {
  jobId: string
}

export interface JobStatusResult {
  status: JobStatus
  error?: string
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Request to ${path} failed (${response.status}): ${body}`)
  }

  return response.json() as Promise<T>
}

export function startProcessing(
  youtubeUrl: string,
  generateQuestions: boolean,
): Promise<StartProcessingResult> {
  return apiFetch<StartProcessingResult>('/process', {
    method: 'POST',
    body: JSON.stringify({ youtubeUrl, generateQuestions }),
  })
}

export function getProcessingStatus(jobId: string): Promise<JobStatusResult> {
  return apiFetch<JobStatusResult>(`/process/${jobId}/status`)
}

export function getProcessingResult(jobId: string): Promise<ProcessedVideoData> {
  return apiFetch<ProcessedVideoData>(`/process/${jobId}/result`)
}
