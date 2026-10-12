import React, { useState } from "react";
import "./LoginPage.css";
import SmartMarkWorkspace from "./SmartMarkWorkspace";
import { postAuth } from "./authApi";

function LoginPage({ onSignUp, onLogin, onForgotPassword }) {
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await postAuth("auth/login", { email, password });
      if (!result.access_token) {
        throw new Error("The server did not return an access token.");
      }

      try {
        window.localStorage.setItem("smartmark-access-token", result.access_token);
      } catch {
        throw new Error("Your session could not be saved. Please enable browser storage and try again.");
      }
      onLogin();
    } catch (error) {
      setErrorMessage(error.message || "Unable to log in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <SmartMarkWorkspace />
      </div>

      <div className="login-right">
        <div className="login-box">
          <p className="login-kicker">SMARTMARK ACCOUNT</p>

          <h2>Login to SmartMark</h2>

          <p className="login-subtitle">
            Sign in to continue to SmartMark
          </p>


          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-box">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="show-password"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {errorMessage && (
              <p className="auth-feedback error" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="login-options">
              <label className="remember">
                <input type="checkbox" />
                Remember me
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onForgotPassword();
                }}
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="signup-text">
            Don't have an account?{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSignUp();
              }}
            >
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;