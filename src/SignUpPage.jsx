import React, { useState } from "react";
import "./SignUpPage.css";
import { postAuth } from "./authApi";

function SignUpPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postAuth("auth/register", { name, email, password });
      setSuccessMessage("Account created. You can now log in.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(error.message || "Unable to create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-right">
        <div className="signup-box">
          <p className="signup-form-kicker">SMARTMARK ACCOUNT</p>

          <h2>Create your account</h2>

          <p className="signup-subtitle">
            Create your SmartMark account to get started
          </p>

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="signup-input-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                minLength={2}
                maxLength={100}
                required
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="signup-input-group">
              <label htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="signup-input-group">
              <label htmlFor="signup-password">Password</label>
              <div className="signup-password-box">
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="signup-show-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="signup-input-group">
              <label htmlFor="signup-confirm-password">Confirm Password</label>
              <div className="signup-password-box">
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="signup-show-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label className="terms">
              <input type="checkbox" required />
              <span>I agree to the Terms & Conditions and Privacy Policy</span>
            </label>

            {errorMessage && (
              <p className="auth-feedback error" role="alert">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="auth-feedback success" role="status">
                {successMessage}
              </p>
            )}

            {/* Create Account */}
            <button
              type="submit"
              className="create-account-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Login */}
          <p className="already-account">
            Already have an account?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onLogin();
              }}
            >
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;