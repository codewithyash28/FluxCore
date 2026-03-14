import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { performAudit, generateCode, AuditResult } from '../services/geminiService';
import ThreeScene from './ThreeScene';
import { Shield, Zap, Leaf, Code, History, Send, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Download, LogOut, MessageSquare, User, GitBranch, Terminal, Settings, Save, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  user: any;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [code, setCode] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [auditing, setAuditing] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [view, setView] = useState<'audit' | 'history' | 'ai' | 'policies'>('audit');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitInfo, setCommitInfo] = useState<{ hash: string; author: string } | null>(null);
  const [policies, setPolicies] = useState(user.policies || { minHealthScore: 0.7, blockHighSecurity: true });
  const [savingPolicies, setSavingPolicies] = useState(false);

  const demoRepos = [
    {
      name: "Vulnerable Node.js",
      url: "https://github.com/demo/vulnerable-node",
      code: `const express = require('express');
const app = express();
const db = require('./db');

app.get('/user', (req, res) => {
  const query = "SELECT * FROM users WHERE id = " + req.query.id;
  db.query(query, (err, result) => {
    res.send(result);
  });
});

app.listen(3000);`
    },
    {
      name: "Unoptimized React",
      url: "https://github.com/demo/slow-react",
      code: `function HeavyComponent({ items }) {
  const sortedItems = items.sort((a, b) => a.value - b.value);
  
  return (
    <div>
      {sortedItems.map(item => (
        <div key={Math.random()}>{item.name}</div>
      ))}
    </div>
  );
}`
    }
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'audits'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const auditData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistory(auditData);
    }, (err) => {
      console.error('Firestore Error in snapshot listener:', JSON.stringify({
        error: err.message,
        operationType: 'list',
        path: 'audits',
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email
        }
      }));
      setError(`Permission denied: Unable to load audit history. Please ensure you are logged in.`);
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const fetchCommitInfo = async () => {
      if (!repoUrl || !repoUrl.includes('github.com')) {
        setCommitInfo(null);
        return;
      }
      try {
        const parts = repoUrl.replace('https://github.com/', '').split('/');
        if (parts.length >= 2) {
          const owner = parts[0];
          const repo = parts[1];
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/HEAD`);
          if (response.ok) {
            const data = await response.json();
            setCommitInfo({
              hash: data.sha.substring(0, 7),
              author: data.commit.author.name
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch commit info:', err);
      }
    };
    fetchCommitInfo();
  }, [repoUrl]);

  const handleAudit = async () => {
    if (!code || !repoUrl) return;
    setAuditing(true);
    setError(null);
    try {
      const result = await performAudit(code, repoUrl, history);
      setCurrentAudit(result);

      await addDoc(collection(db, 'audits'), {
        userId: user.uid,
        repoUrl,
        ...result,
        timestamp: serverTimestamp()
      });
    } catch (err: any) {
      console.error('Audit failed:', err);
      setError(err.message || 'Audit failed. Please try again.');
    } finally {
      setAuditing(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setGenerating(true);
    try {
      const res = await generateCode(aiPrompt);
      setAiResponse(res);
    } catch (error) {
      console.error('AI Generation failed:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    onLogout();
  };

  const handleUpdatePolicies = async () => {
    setSavingPolicies(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { policies });
      alert('Policies updated successfully!');
    } catch (err) {
      console.error('Failed to update policies:', err);
      alert('Failed to update policies.');
    } finally {
      setSavingPolicies(false);
    }
  };

  const checkPolicyPass = (audit: AuditResult) => {
    const healthPass = audit.healthScore >= policies.minHealthScore;
    const securityPass = !policies.blockHighSecurity || (audit.securitySeverity !== 'Critical' && audit.securitySeverity !== 'High');
    return {
      pass: healthPass && securityPass,
      healthPass,
      securityPass
    };
  };

  const exportMarkdown = () => {
    if (!currentAudit) return;
    const md = `
# FluxCore Audit Report
**Repository:** ${repoUrl}
**Date:** ${new Date().toLocaleString()}

## Executive Health Status
- **Health Score:** ${(currentAudit.healthScore * 100).toFixed(0)}%
- **Security Severity:** ${currentAudit.securitySeverity}

## Security Findings
${currentAudit.securityFindings.map(f => `- ${f}`).join('\n')}

## Eco-Efficiency Details
- **Energy Savings:** ${currentAudit.energySavings}%
- **Rationale:** ${currentAudit.ecoLogic}

## Optimization Details
- **Potential:** ${(currentAudit.optimizationPotential * 100).toFixed(0)}%
- **Findings:** ${currentAudit.optimizationFindings.map(f => `- ${f}`).join('\n')}

## Refactored Code
\`\`\`
${currentAudit.optimizedCode}
\`\`\`
    `;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${Date.now()}.md`;
    a.click();
  };

  const getRegressionStatus = () => {
    if (history.length === 0) return { status: 'Stable', icon: CheckCircle2, color: 'text-emerald-500' };
    const lastAudit = history[0];
    if (currentAudit && currentAudit.healthScore < lastAudit.healthScore) {
      return { status: 'Regression', icon: TrendingDown, color: 'text-rose-500' };
    }
    return { status: 'Stable', icon: TrendingUp, color: 'text-emerald-500' };
  };

  const regression = getRegressionStatus();

  const securityScore = currentAudit ? (currentAudit.securitySeverity === 'Low' ? 0.9 : currentAudit.securitySeverity === 'Med' ? 0.6 : 0.3) : 0;
  const performanceScore = currentAudit ? 1 - currentAudit.optimizationPotential : 0;
  const ecoScore = currentAudit ? currentAudit.energySavings / 100 : 0;

  const badgeUrl = currentAudit 
    ? `https://img.shields.io/badge/FluxCore-${(currentAudit.healthScore * 100).toFixed(0)}%25-${currentAudit.securitySeverity === 'Low' ? 'green' : currentAudit.securitySeverity === 'Med' ? 'yellow' : 'red'}`
    : '';

  return (
    <div className="mx-auto max-w-6xl p-6">
      <ThreeScene 
        scores={currentAudit ? { security: securityScore, performance: performanceScore, eco: ecoScore } : undefined} 
        history={history}
        onNodeClick={setSelectedAudit}
      />
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 text-blue-500">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Hi {user.displayName}, what things bring you today?</h1>
            <p className="text-sm text-slate-400">
              FluxCore CI/CD Architect • {user.email}
            </p>
          </div>
        </div>
        <div className="flex gap-2 rounded-xl bg-slate-900/50 p-1 backdrop-blur-md">
          <button
            onClick={() => setView('ai')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'ai' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            AI Assistant
          </button>
          <button
            onClick={() => setView('audit')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'audit' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="h-4 w-4" />
            New Audit
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            History
          </button>
          <button
            onClick={() => setView('policies')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'policies' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            Policies
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg bg-rose-600/20 px-4 py-2 text-sm font-medium text-rose-500 transition-all hover:bg-rose-600/30"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'ai' ? (
          <motion.div
            key="ai-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6"
          >
            <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-bold text-white flex items-center gap-3">
                <MessageSquare className="text-blue-500" />
                FluxCore AI Architect
              </h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">What do you want to build today?</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Create a secure Express middleware for JWT validation..."
                    className="h-32 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <button
                  onClick={handleAiGenerate}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  {generating ? 'Architecting...' : 'Generate Secure Code'}
                </button>
                {aiResponse && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-500">Generated Architecture</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(aiResponse)}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300"
                      >
                        Copy Code
                      </button>
                    </div>
                    <div className="markdown-body prose prose-invert max-w-none">
                      <ReactMarkdown>{aiResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : view === 'audit' ? (
          <motion.div
            key="audit-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6 lg:grid-cols-12"
          >
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Source Code Input</h2>
                  <div className="flex gap-2">
                    {demoRepos.map((repo, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setRepoUrl(repo.url);
                          setCode(repo.code);
                        }}
                        className="rounded-lg bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-slate-400 transition-all hover:bg-white/10 hover:text-white"
                      >
                        Demo {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase text-slate-500">Repository URL</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pl-10 text-white focus:border-blue-500 focus:outline-none"
                      />
                      <GitBranch className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                  {repoUrl && (
                    <div className="flex items-center gap-4 rounded-xl bg-blue-500/5 p-3 border border-blue-500/10">
                      <Terminal size={16} className="text-blue-400" />
                      <div className="text-[10px] font-mono text-blue-400">
                        Latest Commit: <span className="font-bold">{commitInfo?.hash || 'Fetching...'}</span> • Author: <span className="font-bold">{commitInfo?.author || 'Fetching...'}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase text-slate-500">Code Snippet / Diff</label>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Paste your code here for audit..."
                      className="h-64 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAudit}
                    disabled={auditing || !code || !repoUrl}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                  >
                    {auditing ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Running Audit Protocols...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Execute CI/CD Audit
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="flex items-center gap-3 rounded-xl bg-red-500/10 p-4 border border-red-500/20 text-red-400">
                      <AlertTriangle size={18} />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-6 space-y-6">
                {currentAudit ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl"
                  >
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">Executive Health Status</h2>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 font-mono text-lg font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                        {currentAudit.healthScore.toFixed(1)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Optimization</p>
                        <p className="text-xl font-bold text-white">{(currentAudit.optimizationPotential * 100).toFixed(0)}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Energy Savings</p>
                        <p className="text-xl font-bold text-emerald-500">{currentAudit.energySavings}%</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Security</p>
                        <p className={`text-xl font-bold ${
                          currentAudit.securitySeverity === 'Critical' ? 'text-rose-500' :
                          currentAudit.securitySeverity === 'High' ? 'text-orange-500' :
                          'text-emerald-500'
                        }`}>{currentAudit.securitySeverity}</p>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Regression</p>
                        <div className={`flex items-center gap-2 text-xl font-bold ${regression.color}`}>
                          <regression.icon className="h-5 w-5" />
                          {regression.status}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className={`rounded-2xl border p-4 ${
                        checkPolicyPass(currentAudit).pass
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-rose-500/20 bg-rose-500/5'
                      }`}>
                        <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Policy Builder Status</h3>
                        <div className="flex items-center gap-2">
                          {checkPolicyPass(currentAudit).pass ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm font-bold text-emerald-500">PASS: Ready for Merge</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-rose-500" />
                              <span className="text-sm font-bold text-rose-500">
                                FAIL: {!checkPolicyPass(currentAudit).securityPass ? 'Security Violation' : 'Health Score Violation'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
                          <Leaf className="h-4 w-4 text-blue-400" />
                          Eco-Logic Rationale
                        </h3>
                        <p className="text-xs leading-relaxed text-slate-400">{currentAudit.ecoLogic}</p>
                      </div>

                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <h3 className="mb-2 text-sm font-bold text-white">Status Badge</h3>
                        <div className="flex items-center gap-3">
                          <img src={badgeUrl} alt="FluxCore Badge" />
                          <button 
                            onClick={() => navigator.clipboard.writeText(`![FluxCore Score](${badgeUrl})`)}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                          >
                            Copy Markdown
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-900/30 text-center">
                    <AlertTriangle className="mb-4 h-12 w-12 text-slate-700" />
                    <p className="text-slate-500">Awaiting code push for audit...</p>
                  </div>
                )}

                {currentAudit && (
                  <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                    <h3 className="mb-4 text-sm font-bold text-white">Detailed Findings</h3>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{currentAudit.findings}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {currentAudit && (
              <div className="lg:col-span-12">
                <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Optimized Code (FluxCore Refactor)</h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => navigator.clipboard.writeText(currentAudit.optimizedCode)}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300"
                      >
                        Copy Code
                      </button>
                      <button 
                        onClick={exportMarkdown}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                      >
                        <Download size={14} />
                        Export Report
                      </button>
                    </div>
                  </div>
                  <pre className="overflow-x-auto rounded-xl bg-black/50 p-6 font-mono text-sm text-blue-300">
                    <code>{currentAudit.optimizedCode}</code>
                  </pre>
                </div>
              </div>
            )}
          </motion.div>
        ) : view === 'policies' ? (
          <motion.div
            key="policies-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid gap-6"
          >
            <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-bold text-white flex items-center gap-3">
                <Settings className="text-blue-500" />
                Policy Builder
              </h2>
              <div className="space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Minimum Health Score</h3>
                      <span className="text-2xl font-mono font-bold text-blue-500">{(policies.minHealthScore * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={policies.minHealthScore}
                      onChange={(e) => setPolicies({ ...policies, minHealthScore: parseFloat(e.target.value) })}
                      className="w-full accent-blue-600"
                    />
                    <p className="text-xs text-slate-500 italic">Block merges if the overall code health falls below this threshold.</p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-white/5 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Block High Severity</h3>
                      <button
                        onClick={() => setPolicies({ ...policies, blockHighSecurity: !policies.blockHighSecurity })}
                        className={`h-6 w-12 rounded-full transition-all relative ${policies.blockHighSecurity ? 'bg-blue-600' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${policies.blockHighSecurity ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 italic">Automatically fail audits if 'High' or 'Critical' security vulnerabilities are detected.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
                  <h4 className="mb-2 text-sm font-bold text-blue-400">Current Rule Logic:</h4>
                  <code className="text-xs text-slate-300">
                    IF (healthScore &lt; {policies.minHealthScore}) OR (securitySeverity IN ['High', 'Critical'] AND blockHighSecurity == {String(policies.blockHighSecurity)}) THEN STATUS = FAIL
                  </code>
                </div>

                <button
                  onClick={handleUpdatePolicies}
                  disabled={savingPolicies}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  {savingPolicies ? 'Saving...' : 'Save Policy Configuration'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {history.length > 0 ? (
              history.map((audit) => (
                <div key={audit.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl transition-all hover:bg-slate-900/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-mono font-bold text-white ${
                        audit.healthScore > 0.8 ? 'bg-emerald-600' : audit.healthScore > 0.5 ? 'bg-amber-600' : 'bg-rose-600'
                      }`}>
                        {audit.healthScore.toFixed(1)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{audit.repoUrl}</h4>
                        <p className="text-xs text-slate-500">{new Date(audit.timestamp?.toDate()).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Security</p>
                        <p className={`text-sm font-bold ${
                          audit.securitySeverity === 'Critical' ? 'text-rose-500' : 'text-emerald-500'
                        }`}>{audit.securitySeverity}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Energy</p>
                        <p className="text-sm font-bold text-blue-400">-{audit.energySavings}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 text-center">
                <History className="mb-4 h-12 w-12 text-slate-700" />
                <p className="text-slate-500">No audit history found.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Audit Details: {selectedAudit.repoUrl}</h2>
              <button onClick={() => setSelectedAudit(null)} className="text-slate-400 hover:text-white">
                <LogOut size={24} />
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Health Score</p>
                  <p className="text-2xl font-bold text-white">{(selectedAudit.healthScore * 100).toFixed(0)}%</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Security</p>
                  <p className="text-2xl font-bold text-white">{selectedAudit.securitySeverity}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Eco Savings</p>
                  <p className="text-2xl font-bold text-white">{selectedAudit.energySavings}%</p>
                </div>
              </div>
              <div className="rounded-2xl bg-black/30 p-6 font-mono text-xs text-blue-400 overflow-x-auto">
                <pre>{JSON.stringify(selectedAudit, null, 2)}</pre>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <footer className="mt-12 border-t border-white/10 pt-8 text-center text-slate-500">
        <p className="text-xs">--- FluxCore: Security & Sustainability Optimized | Made by [Code With Yash](https://yashchoubey-portfolio.netlify.app/) ---</p>
        <div className="mt-4 flex justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">System Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">AI Engine Ready</span>
          </div>
        </div>
      </footer>

      <div className="pointer-events-none fixed bottom-8 right-8 z-50">
        <div className="rounded-2xl bg-blue-600/10 p-4 backdrop-blur-xl border border-blue-500/20">
          <pre className="text-[10px] font-mono text-blue-400">
            {JSON.stringify({
              userRepo: user.gitPlatform === 'github' ? `github.com/${user.gitUsername}` : `gitlab.com/${user.gitUsername}`,
              fileHealth: currentAudit?.healthScore || 0,
              optimizationPotential: currentAudit?.optimizationPotential || 0,
              energySavings: currentAudit?.energySavings || 0,
              securitySeverity: currentAudit?.securitySeverity || "Low",
              regressionStatus: regression.status
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
