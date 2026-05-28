import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scissors,
  ArrowRight,
  Mail,
  RotateCw,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

// ─── OTP Box Input ──────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  function handleKey(idx, e) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = value.slice(0, Math.max(idx, value.length - 1));
      onChange(next.length === value.length ? value.slice(0, idx) : next);
      if (idx > 0 && (value.length - 1 === idx || value[idx] === undefined)) {
        inputs.current[idx - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && idx > 0) {
      inputs.current[idx - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && idx < 5) {
      inputs.current[idx + 1]?.focus();
      return;
    }
  }

  function handleChange(idx, e) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (!char) return;
    const arr = value.split("");
    arr[idx] = char;
    const next = arr.join("").slice(0, 6);
    onChange(next);
    if (idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      inputs.current[focusIdx]?.focus();
    }
  }

  // Focus first empty box when value changes
  useEffect(() => {
    const firstEmpty = Math.min(value.length, 5);
    inputs.current[firstEmpty]?.focus();
  }, []); // only on mount

  return (
    <div className="flex gap-[10px] justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={i < value.length ? value[i] : ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-[46px] h-[56px] text-center text-22 font-bold border-2 rounded-xl outline-none transition-all duration-150
            text-text-primary bg-white
            border-border focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          style={{ caretColor: "transparent" }}
        />
      ))}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email"); // 'email' | 'otp'
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleRequestOtp(e) {
    e?.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtp("");
      setStep("otp");
      setResendCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e?.preventDefault();
    setError("");
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");
      localStorage.setItem("suit_admin_auth", "true");
      localStorage.setItem("suit_admin_name", data.name || "");
      localStorage.setItem("suit_admin_email", email.trim());
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setOtp("");
    await handleRequestOtp();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-[16px]">
      {/* Background subtle pattern */}
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
          {step === "email" ? (
            <>
              {/* Email step */}
              <div className="mb-[24px]">
                <h2 className="text-20 font-bold text-text-primary mb-[6px]">
                  Admin sign in
                </h2>
                <p className="text-14 text-text-secondary">
                  Enter your email — we'll send a one-time code to verify.
                </p>
              </div>

              <form onSubmit={handleRequestOtp}>
                {error && (
                  <div className="mb-[16px] px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-lg text-14 text-red-600">
                    {error}
                  </div>
                )}

                <div className="mb-[20px]">
                  <label className="input-label">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@example.com"
                      className="input pl-[40px]"
                      autoComplete="email"
                      autoFocus
                    />
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
                      Checking…
                    </>
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* OTP step */}
              <div className="mb-[24px]">
                <div className="w-[40px] h-[40px] rounded-xl bg-brand-50 flex items-center justify-center mb-[14px]">
                  <ShieldCheck size={20} className="text-brand-600" />
                </div>
                <h2 className="text-20 font-bold text-text-primary mb-[6px]">
                  Check your email
                </h2>
                <p className="text-14 text-text-secondary">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-text-primary">
                    {email}
                  </span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp}>
                {error && (
                  <div className="mb-[16px] px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-lg text-14 text-red-600">
                    {error}
                  </div>
                )}

                <div className="mb-[24px]">
                  <label className="input-label text-center block mb-[14px]">
                    Enter 6-digit code
                  </label>
                  <OtpInput
                    value={otp}
                    onChange={(v) => {
                      setOtp(v);
                      setError("");
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full btn-primary py-[12px] text-15 gap-[8px] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span className="w-[16px] h-[16px] border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify &amp; Sign In
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Resend + back */}
              <div className="flex items-center justify-between mt-[20px] pt-[20px] border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError("");
                    setOtp("");
                  }}
                  className="inline-flex items-center gap-[5px] text-13 text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={13} />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="inline-flex items-center gap-[5px] text-13 text-brand-600 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <RotateCw
                    size={13}
                    className={loading ? "animate-spin" : ""}
                  />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend OTP"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-12 text-text-muted mt-[24px]">
          Access restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
