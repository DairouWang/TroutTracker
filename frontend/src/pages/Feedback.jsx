import { useState } from 'react'
import { sendFeedback } from '../services/api'
import { trackFeedbackSubmitted } from '../services/analytics'
import './Feedback.css'

const Feedback = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.email || !formData.message) {
      setStatus({ type: 'error', message: 'Email and message are required' })
      return
    }

    setIsSubmitting(true)
    setStatus({ type: '', message: '' })

    try {
      await sendFeedback({
        name: formData.name,
        email: formData.email,
        message: formData.message,
        to: 'feedback@trouttracker.info'
      })
      trackFeedbackSubmitted({
        hasName: Boolean(formData.name),
        hasEmail: Boolean(formData.email),
        messageLength: formData.message.length
      })
      setStatus({ type: 'success', message: 'Your feedback has been received.' })
      setFormData({ name: '', email: '', message: '' })
    } catch (error) {
      console.error('Error sending feedback:', error)
      setStatus({ type: 'error', message: 'Failed to send feedback. Please try again later.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-container">
        <div className="feedback-header">
          <h1>Send Feedback</h1>
          <p>Have a suggestion, found a bug, or just want to say hi? We'd love to hear from you.</p>
        </div>

        <div className="feedback-content">
          <form onSubmit={handleSubmit} className="feedback-form">
            <div className="form-group">
              <label htmlFor="name">Name (Optional)</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your name"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Share your feedback, suggestions, or report issues..."
                rows="6"
                required
                disabled={isSubmitting}
              />
            </div>

            {status.message && (
              <div className={`feedback-status ${status.type}`}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              className="feedback-submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Feedback
