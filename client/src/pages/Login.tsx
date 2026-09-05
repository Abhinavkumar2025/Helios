import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SunMedium, Shield, Lock, Mail, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Login: React.FC = () => {
  const [email, setEmail] = useState("admin@helios.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate("/overview");
      } else {
        setError("Invalid credentials. Use demo: admin@helios.local / admin123");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setEmail("admin@helios.local");
    setPassword("admin123");
    setIsLoading(true);
    await login("admin@helios.local", "admin123");
    navigate("/overview");
  };

  return (
    <div className="min-h-screen bg-helios-950 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-solar-500 selection:text-helios-950">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-solar-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-solar-400 to-solar-600 shadow-glow-solar text-helios-950 font-black mb-4 animate-pulse-slow">
          <SunMedium className="w-10 h-10" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-wider text-white font-mono uppercase">
          HELIO<span className="text-solar-400">S</span>
        </h1>
        <p className="text-sm text-slate-300 font-mono mt-1 uppercase tracking-widest font-semibold">
          Smart City Intelligence Platform
        </p>
        <p className="text-xs text-slate-400 mt-2 max-w-sm italic">
          "Command your city through intelligent mobility."
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-helios-900/90 backdrop-blur-xl p-8 shadow-2xl z-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
              Command Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@helios.local"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-helios-850 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-solar-500/70 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold mb-1.5">
              Access Key / Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-helios-850 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-solar-500/70 font-mono transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-solar-500 hover:bg-solar-600 text-helios-950 font-mono font-bold text-sm uppercase tracking-wider shadow-glow-solar border border-solar-400 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-helios-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Sign In to Command Center
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Pass */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDemoSignIn}
            className="w-full py-2.5 rounded-xl bg-helios-850 hover:bg-helios-800 text-slate-200 border border-slate-700 font-mono text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-solar-400" />
            Instant SIH Demo Access (admin123)
          </button>
        </div>

        {/* Security / System Footer */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            Edge Auth V1.0
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-solar-400" />
            Jetson Nano Ready
          </span>
        </div>
      </div>
    </div>
  );
};
