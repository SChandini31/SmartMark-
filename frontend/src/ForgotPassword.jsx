import React, { useState } from "react";
import "./ForgotPasswordPage.css";
import { postAuth } from "./authApi";

function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await postAuth(`auth/forgot-password?email=${encodeURIComponent(email.trim())}`);
      setMessage("If an account exists with this email, a password reset link has been sent.");
    } catch (error) {
      setErrorMessage(error.message || "Unable to request a password reset. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="forgot-page">
      <div className="forgot-card">

        <div className="brand">
          <h1>SmartMark</h1>
          <p>Personal Information Retrieval & Knowledge Management</p>
        </div>

        <div className="forgot-content">
          <div className="lock-icon">🔐</div>

          <h2>Forgot Password?</h2>

          <p className="forgot-description">
            Don't worry! Enter your registered email address and
            we'll help you reset your password.
          </p>

          <form onSubmit={handleSubmit}>

            <label>Email Address</label>

            <input
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>

          </form>

          {message && (
            <p className="success-message" role="status">
              {message}
            </p>
          )}

          {errorMessage && (
            <p className="auth-feedback error" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="back-login"
            onClick={onBackToLogin}
          >
            ← Back to Login
          </button>

        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;