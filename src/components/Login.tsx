import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Github, Gitlab, ShieldCheck, Zap, Leaf } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [platforms, setPlatforms] = useState<('github' | 'gitlab')[]>([]);
  const [githubUsername, setGithubUsername] = useState('');
  const [gitlabUsername, setGitlabUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'name' | 'connect-both' | 'details'>('name');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.displayName || 'Developer',
        githubUsername: githubUsername || null,
        gitlabUsername: gitlabUsername || null,
        createdAt: serverTimestamp(),
        policies: {
          minHealthScore: 0.7,
          blockHighSecurity: true
        }
      };

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, userData);
      }
      
      onLogin(userData);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        console.log('Login popup closed by user.');
        return;
      }
      console.error('Login failed:', error);
      alert(`Login failed: ${error.message}. Please ensure popups are enabled.`);
    } finally {
      setLoading(false);
    }
  };

  const startLogin = (connectBoth: boolean) => {
    if (connectBoth) {
      setStep('details');
    } else {
      // Trigger login immediately without Git details
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleLogin(fakeEvent);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl shadow-2xl"
      >
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-500"
          >
            <ShieldCheck size={48} />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-white">FluxCore</h1>
          <p className="mt-2 text-slate-400">CI/CD Gatekeeper & SDLC Architect</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {step === 'name' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">What's your name?</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setStep('connect-both')}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-500"
              >
                Next
              </button>
            </div>
          )}

          {step === 'connect-both' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-medium text-white">Connect Git Platforms?</h2>
                <p className="text-sm text-slate-400 mt-1">Would you like to link both GitHub and GitLab accounts now?</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => startLogin(true)}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-blue-500 group"
                >
                  <div className="flex gap-2">
                    <Github className="h-5 w-5 text-white" />
                    <Gitlab className="h-5 w-5 text-orange-500" />
                  </div>
                  <span className="text-sm font-semibold text-white">Yes, both</span>
                </button>
                <button
                  type="button"
                  onClick={() => startLogin(false)}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:border-slate-500"
                >
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <span className="text-sm font-semibold text-white">No, skip</span>
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">GitHub Username</label>
                <div className="relative">
                  <Github className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="github_user"
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 py-3 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">GitLab Username</label>
                <div className="relative">
                  <Gitlab className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
                  <input
                    type="text"
                    required
                    value={gitlabUsername}
                    onChange={(e) => setGitlabUsername(e.target.value)}
                    placeholder="gitlab_user"
                    className="w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 py-3 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? 'Initializing...' : 'Initialize FluxCore'}
              </button>
            </div>
          )}
        </form>

        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-8 text-center">
          <div className="space-y-1">
            <ShieldCheck className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="text-[10px] font-bold uppercase text-slate-500">Secure</p>
          </div>
          <div className="space-y-1">
            <Zap className="mx-auto h-5 w-5 text-amber-500" />
            <p className="text-[10px] font-bold uppercase text-slate-500">Performant</p>
          </div>
          <div className="space-y-1">
            <Leaf className="mx-auto h-5 w-5 text-blue-500" />
            <p className="text-[10px] font-bold uppercase text-slate-500">Green</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
