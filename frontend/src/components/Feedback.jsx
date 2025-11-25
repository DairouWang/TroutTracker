import { useState } from 'react'
import './Feedback.css'

const Feedback = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpen = () => {
    setIsOpen(true)
    setStatus({ type: '', message: '' })
  }

  const handleClose = () => {
    setIsOpen(false)
    setFormData({ name: '', email: '', message: '' })
    setStatus({ type: '', message: '' })
  }

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
      // Using EmailJS or similar service for client-side email sending
      // For now, we'll use a simple mailto link as fallback
      const subject = `TroutTracker Feedback from ${formData.name || 'Anonymous'}`
      const body = `Name: ${formData.name || 'Not provided'}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`

      // Send email using backend API (we'll need to implement this)
      const response = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
          to: 'trouttrackerinfo@gmail.com'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send feedback')
      }

      setStatus({ type: 'success', message: 'Thank you for your feedback! We will get back to you soon.' })
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (error) {
      console.error('Error sending feedback:', error)
      // Fallback to mailto link
      const subject = encodeURIComponent(`TroutTracker Feedback from ${formData.name || 'Anonymous'}`)
      const body = encodeURIComponent(`Name: ${formData.name || 'Not provided'}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`)
      window.location.href = `mailto:trouttrackerinfo@gmail.com?subject=${subject}&body=${body}`
      setStatus({ type: 'info', message: 'Opening your email client...' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        className="feedback-button"
        onClick={handleOpen}
        aria-label="Send Feedback"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <span>Feedback</span>
      </button>

      {isOpen && (
        <div className="feedback-modal-overlay" onClick={handleClose}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h2>Send Feedback</h2>
              <button
                className="feedback-close-button"
                onClick={handleClose}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

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
                  rows="5"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {status.message && (
                <div className={`feedback-status ${status.type}`}>
                  {status.message}
                </div>
              )}

              <div className="feedback-modal-actions">
                <button
                  type="button"
                  className="feedback-cancel-button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="feedback-submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Feedback