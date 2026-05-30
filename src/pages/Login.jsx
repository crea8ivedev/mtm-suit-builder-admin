import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";

const ALLOWED_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? "")
  .toLowerCase()
  .trim();
const ALLOWED_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));

    const enteredEmail = email.trim().toLowerCase();
    if (enteredEmail !== ALLOWED_EMAIL || password !== ALLOWED_PASSWORD) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    localStorage.setItem("suit_admin_auth", "true");
    localStorage.setItem("suit_admin_email", enteredEmail);
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-[16px]">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(37,99,235,0.06) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(37,99,235,0.04) 0%, transparent 50%)`,
        }}
      />

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-[32px]">
          <div className="w-[52px] h-[52px] rounded-2xl bg-brand-600 flex items-center justify-center mb-[14px] shadow-md">
            <Scissors size={24} className="text-white" />
          </div>
          <h1 className="text-22 font-bold text-text-primary leading-tight">
            SuitAdmin
          </h1>
          <p className="text-13 text-text-muted mt-[3px]">
            Order Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-lg p-[32px]">
          <div className="mb-[24px]">
            <h2 className="text-20 font-bold text-text-primary mb-[6px]">
              Admin sign in
            </h2>
            <p className="text-14 text-text-secondary">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-[16px] px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-lg text-14 text-red-600">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="mb-[16px]">
              <label className="input-label">Email Address</label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-[12px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  className="input pl-[36px]"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-[24px]">
              <label className="input-label">Password</label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-[12px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••••••"
                  className="input pl-[36px] pr-[40px]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-[12px] top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-[12px] text-15 gap-[8px] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-[16px] h-[16px] border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-12 text-text-muted mt-[24px]">
          Access restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
