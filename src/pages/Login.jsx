import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { checkSuperAdmin } from "../lib/shopify";

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
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      const isSuperAdmin = await checkSuperAdmin(trimmedEmail);
      if (!isSuperAdmin) {
        setError("This email is not authorized to access the admin panel.");
        return;
      }
      if (password !== ALLOWED_PASSWORD) {
        setError("Incorrect password.");
        return;
      }
      localStorage.setItem("suit_admin_auth", "true");
      localStorage.setItem("suit_admin_email", trimmedEmail);
      navigate("/dashboard");
    } catch {
      setError("Unable to verify email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-[24px]"
      style={{ backgroundColor: "#f4f1ed" }}
    >
      {/* Two-column centered card */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: "1100px",
          display: "grid",
          gridTemplateColumns: "54% 46%",
          minHeight: "660px",
          boxShadow: "20px 0 60px rgba(0,0,0,0.12)",
          borderRadius: "4px",
        }}
      >
        {/* ── LEFT: Brand narrative — no logo ── */}
        <div
          className="relative flex flex-col justify-center px-[52px] py-[56px]"
          style={{ backgroundColor: "#f4f1ed" }}
        >
          {/* Scissors — bottom-left corner inside left box */}
          <div
            className="absolute bottom-0 left-0 w-[180px] h-[180px] pointer-events-none select-none"
            style={{ opacity: 0.03, mixBlendMode: "multiply" }}
          >
            <img
              src="/watermark-scissors.png"
              alt=""
              className="w-full h-full object-contain"
            />
          </div>

          <div
            className="flex flex-col gap-[20px]"
            style={{ maxWidth: "380px" }}
          >
            <h1
              className="font-garamond font-bold italic leading-none"
              style={{ fontSize: "50px", color: "#3c3c3c" }}
            >
              AUTHENTICITY
              <br />
              REQUIRED
            </h1>
            <p
              className="font-hanken text-[14px] leading-[20px]"
              style={{ color: "#44474c" }}
            >
              Access the private atelier management system. Every stitch
              recorded, every measurement preserved with the precision of a
              master's eye.
            </p>
          </div>
        </div>

        {/* ── RULER: full card height, at the column boundary ── */}
        <div
          className="absolute pointer-events-none select-none"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            top: 0,
            bottom: 0,
            width: "64px",
            zIndex: 10,
          }}
        >
          <img
            src="/ruler-scale.png"
            alt=""
            className="w-full h-full object-contain"
          />
        </div>

        {/* ── RIGHT: Login form — white, no footer line ── */}
        <div
          className="bg-white flex flex-col justify-start"
          style={{ padding: "79px 60px 100px 70px" }}
        >
          <div
            className="flex flex-col gap-[48px]"
            style={{ maxWidth: "380px", width: "100%" }}
          >
            {/* Heading */}
            <div className="flex flex-col gap-[8px]">
              <h2
                className="font-garamond font-semibold text-black"
                style={{ fontSize: "30px", lineHeight: "normal" }}
              >
                Sign In
              </h2>
              <p
                className="font-hanken text-[14px] leading-[21px]"
                style={{ color: "#44474c" }}
              >
                Provide your atelier credentials to continue.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-[40px]"
            >
              {/* Error */}
              {error && (
                <div className="px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[4px]">
                  <p className="font-hanken text-[13px] text-red-600">
                    {error}
                  </p>
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-[8px]">
                <label
                  className="font-hanken font-medium text-black uppercase"
                  style={{ fontSize: "14px", letterSpacing: "0.6px" }}
                >
                  Email Address
                </label>
                <div
                  className="flex items-center"
                  style={{
                    borderBottom: "1px solid #6b7280",
                    paddingBottom: "15px",
                    paddingTop: "13px",
                    paddingLeft: "2px",
                  }}
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    className="font-hanken flex-1 bg-transparent outline-none text-black"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-[8px]">
                <label
                  className="font-hanken font-medium text-black uppercase"
                  style={{ fontSize: "14px", letterSpacing: "0.6px" }}
                >
                  Password
                </label>
                <div
                  className="flex items-center"
                  style={{
                    borderBottom: "1px solid #6b7280",
                    paddingBottom: "15px",
                    paddingTop: "13px",
                    paddingLeft: "2px",
                  }}
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="font-hanken flex-1 bg-transparent outline-none text-black"
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-[#6b7280] hover:text-black transition-colors ml-[8px]"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="font-hanken flex items-center justify-center gap-[8px] w-full rounded-[8px] text-white font-semibold uppercase tracking-wide transition-opacity disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "#a45d41",
                  height: "52px",
                  fontSize: "14px",
                }}
              >
                {loading ? (
                  <>
                    <span className="w-[16px] h-[16px] border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
