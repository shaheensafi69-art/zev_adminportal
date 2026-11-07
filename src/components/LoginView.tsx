'use client';

import React, { useState } from 'react';
import { 
  KeyRound, ShieldCheck, Lock, Eye, EyeOff, 
  ArrowRight, Globe, AlertTriangle, ClipboardCopy, CheckCircle2 
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [passkey, setPasskey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pasted, setPasted] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPasskey(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch {
      // ignore clipboard error
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passkey.trim()) {
      setError('Please provide an authorized Admin Master Key.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passkey.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication denied. Invalid access key.');
      }

      onLoginSuccess();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Authentication failed. Please verify your secret key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#050811]">
      
      {/* Background glow effects & cyber grid */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-cyber opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Main Vault Box */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl">
          
          {/* Logo & Security Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex relative items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-indigo-600 shadow-xl shadow-cyan-500/30 ring-1 ring-white/30 mb-4">
              <span className="text-white font-black text-3xl tracking-wider">Z</span>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#050811] shadow-[0_0_8px_#10b981] animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono font-semibold mb-2 shadow-sm shadow-cyan-950">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              RESTRICTED ADMIN ACCESS
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">
              ZEV Cloud Console
            </h1>

            <p className="text-xs text-slate-400 mt-1 font-mono flex items-center justify-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              adminportal.zevapp.com
            </p>
          </div>

          {/* Security Notice */}
          <div className="mb-6 p-3.5 rounded-2xl glass-card text-xs text-slate-300 leading-relaxed flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-white font-bold block mb-0.5">Authorized Personnel Only</span>
              Standard app accounts are strictly forbidden. Access requires one of the 10 Cryptographic Admin Master Keys.
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in shake duration-200 shadow-lg shadow-rose-950/50">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Key Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  Admin Master Access Key
                </label>

                <button
                  type="button"
                  onClick={handlePaste}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {pasted ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <ClipboardCopy className="w-3 h-3" />}
                  <span>{pasted ? 'Pasted!' : 'Paste Key'}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="ZEV-KEY-..."
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 rounded-2xl glass-input text-sm font-mono text-white placeholder-slate-500 focus:outline-none transition-all"
                  autoFocus
                  required
                />
                
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl glass-btn-primary text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authenticate & Unlock Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Cryptographic Protection Footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              SHA-256 Constant-Time Verification Active
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              Audit logging enabled for all authentication events
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
