import { CircleCheck, CircleX } from 'lucide-react'
import { TeddyBear } from './TeddyBear'

export interface QuestionResult {
  prompt: string
  choices: [string, string, string, string]
  selectedIndex: number
  correctIndex: number
  explanation: string
}

interface QuestionSummaryModalProps {
  results: QuestionResult[]
  onDone: () => void
}

export function QuestionSummaryModal({ results, onDone }: QuestionSummaryModalProps) {
  const total = results.length
  const correctCount = results.filter((r) => r.selectedIndex === r.correctIndex).length

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card card summary-card">
        <div className="summary-headline">
          <TeddyBear pose="celebrating" size={64} />
          <h2>
            {total > 0
              ? `You got ${correctCount}/${total} correct`
              : 'No comprehension questions were asked for this video'}
          </h2>
        </div>

        {total > 0 && (
          <div className="summary-list">
            {results.map((result, index) => {
              const isCorrect = result.selectedIndex === result.correctIndex
              return (
                <div className="summary-item" key={index}>
                  <div className="summary-item-header">
                    {isCorrect ? (
                      <CircleCheck size={20} color="var(--color-success)" />
                    ) : (
                      <CircleX size={20} color="var(--color-error)" />
                    )}
                    <p className="summary-prompt">{result.prompt}</p>
                  </div>
                  <p className="summary-detail">
                    Your answer: {result.choices[result.selectedIndex]}
                  </p>
                  {!isCorrect && (
                    <p className="summary-detail summary-correct-answer">
                      Correct answer: {result.choices[result.correctIndex]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button className="btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
