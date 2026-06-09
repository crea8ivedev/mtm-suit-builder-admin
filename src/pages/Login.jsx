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
      const { isAdmin, name } = await checkSuperAdmin(trimmedEmail);
      if (!isAdmin) {
        setError("This email is not authorized to access the admin panel.");
        return;
      }
      if (password !== ALLOWED_PASSWORD) {
        setError("Incorrect password.");
        return;
      }
      localStorage.setItem("suit_admin_auth", "true");
      localStorage.setItem("suit_admin_email", trimmedEmail);
      if (name) localStorage.setItem("suit_admin_name", name);
      navigate("/dashboard");
    } catch {
      setError("Unable to verify email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-[16px] sm:p-[24px] bg-gc-bg-warm">
      <div className="fixed bottom-0 left-0 w-[180px] h-[180px] pointer-events-none select-none opacity-[0.03] mix-blend-multiply">
        <img
          src="/watermark-scissors.png"
          alt=""
          className="w-full h-full object-contain"
        />
      </div>

      <div className="relative w-full max-w-[1100px] overflow-hidden rounded-[4px] flex flex-col md:flex-row md:min-h-[660px]">
        <div className="hidden md:flex relative flex-col justify-center px-[52px] py-[56px] md:w-[54%] bg-gc-bg-warm">
          <div className="flex flex-col gap-[20px] max-w-[380px]">
            <h1 className="font-garamond font-bold italic leading-none text-[50px] text-gc-heading">
              AUTHENTICITY
              <br />
              REQUIRED
            </h1>
            <p className="font-hanken text-[14px] leading-[20px] text-gc-near-black2">
              Access the private atelier management system. Every stitch
              recorded, every measurement preserved with the precision of a
              master's eye.
            </p>
          </div>
        </div>

        <div className="hidden md:block absolute pointer-events-none select-none z-10 left-[52%] -translate-x-1/2 top-0 bottom-0 w-[64px]">
          <img
            src="/ruler-scale.png"
            alt=""
            className="w-full h-full object-contain"
          />
        </div>

        <div className="bg-white flex flex-col justify-center w-full md:w-[46%] px-[24px] py-[40px] sm:px-[40px] md:px-[70px] md:py-[79px]">
          <div className="md:hidden mb-[32px] text-center">
            <h1 className="font-garamond font-bold italic leading-tight text-[28px] text-gc-heading">
              AUTHENTICITY
              <br />
              REQUIRED
            </h1>
            <p className="font-hanken text-[13px] mt-[8px] text-gc-near-black2">
              Atelier management system
            </p>
          </div>

          <div className="flex flex-col gap-[40px] sm:gap-[48px] w-full max-w-[380px] mx-auto">
            <div className="flex flex-col gap-[8px]">
              <h2 className="font-garamond font-semibold text-black text-[30px] leading-normal">
                Sign In
              </h2>
              <p className="font-hanken text-[14px] leading-[21px] text-gc-near-black2">
                Provide your atelier credentials to continue.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col gap-[32px] sm:gap-[40px]"
            >
              {error && (
                <div className="px-[14px] py-[10px] bg-red-50 border border-red-200 rounded-[4px]">
                  <p className="font-hanken text-[13px] text-red-600">
                    {error}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-[8px]">
                <label className="font-hanken font-medium text-black uppercase text-[14px] tracking-[0.6px]">
                  Email Address
                </label>
                <div className="flex items-center border-b border-gc-muted pb-[15px] pt-[13px] pl-[2px]">
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
                    className="font-hanken flex-1 bg-transparent outline-none text-black min-w-0 text-[16px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[8px]">
                <label className="font-hanken font-medium text-black uppercase text-[14px] tracking-[0.6px]">
                  Password
                </label>
                <div className="flex items-center border-b border-gc-muted pb-[15px] pt-[13px] pl-[2px]">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="font-hanken flex-1 bg-transparent outline-none text-black min-w-0 text-[16px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-gc-muted hover:text-black transition-colors ml-[8px] flex-shrink-0"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="font-hanken flex items-center justify-center gap-[8px] w-full h-[52px] rounded-[8px] text-white text-[14px] font-semibold uppercase tracking-wide transition-opacity disabled:opacity-70 disabled:cursor-not-allowed bg-gc-primary"
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
