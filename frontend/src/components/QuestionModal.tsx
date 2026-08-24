import { useState } from 'react'
import { Play } from 'lucide-react'
import type { Question } from '../types'

interface QuestionModalProps {
  question: Question
  onAnswer: (selectedIndex: number) => void
  onContinue: () => void
}

export function QuestionModal({ question, onAnswer, onContinue }: QuestionModalProps) {
  const [selected, setSelected] = useState<number | null>(null)

  const handleSelect = (index: number) => {
    if (selected !== null) return
    setSelected(index)
    onAnswer(index)
  }

  const isCorrect = selected !== null && selected === question.correctIndex

  const choiceClassName = (index: number) => {
    if (selected === null) return 'choice-button'
    if (index === question.correctIndex) return 'choice-button correct'
    if (index === selected) return 'choice-button incorrect'
    return 'choice-button'
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card card">
        <h2>{question.prompt}</h2>
        <div className="choice-list">
          {question.choices.map((choice, index) => (
            <button
              key={index}
              className={choiceClassName(index)}
              onClick={() => handleSelect(index)}
              disabled={selected !== null}
            >
              {choice}
            </button>
          ))}
        </div>

        {selected !== null && (
          <>
            <p className={`feedback-banner ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? 'Correct!' : 'Not quite.'}
            </p>
            <p>{question.explanation}</p>
            <button className="btn-primary" onClick={onContinue}>
              <Play size={18} />
              Continue video
            </button>
          </>
        )}
      </div>
    </div>
  )
}
