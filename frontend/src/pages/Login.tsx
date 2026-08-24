import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/home')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    setResetMessage(null)
    setResetError(null)

    if (!email.trim()) {
      setResetError('Enter your email above first, then click "Forgot password?".')
      return
    }

    setResetSubmitting(true)
    try {
      await resetPassword(email.trim())
      setResetMessage('If an account exists for that email, a reset link has been sent.')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Log in to Cadence</h1>

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="text-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className="text-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="button"
          className="link-button forgot-password-link"
          onClick={handleForgotPassword}
          disabled={resetSubmitting}
        >
          {resetSubmitting ? 'Sending reset email...' : 'Forgot password?'}
        </button>

        {resetMessage && <p className="success-text">{resetMessage}</p>}
        {resetError && <p className="error-text">{resetError}</p>}

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          <LogIn size={18} />
          {submitting ? 'Logging in...' : 'Log in'}
        </button>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  )
}
