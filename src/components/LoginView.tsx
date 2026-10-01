import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FolderKanban,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { api, ApiError, DevConfigResponse } from '../client/api.ts';
import { User, UserRole } from '../shared/types.ts';

type PortalKey = 'ADMIN' | 'MANAGER' | 'MEMBER';

interface PortalDefinition {
  key: PortalKey;
  label: string;
  role: UserRole;
  description: string;
  heading: string;
  subheading: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  demoEmail: string;
  demoName: string;
}

const PORTALS: Record<PortalKey, PortalDefinition> = {
  ADMIN: {
    key: 'ADMIN',
    label: 'Admin',
    role: UserRole.SUPER_ADMIN,
    description: 'System governance, organizations & role policies',
    heading: 'Sign in to PrimeMeet Command Center',
    subheading: 'Manage organizations, audit row-level security policies, and oversee platform telemetry.',
    icon: ShieldCheck,
    accentBorder: 'border-indigo-500 ring-2 ring-indigo-500/20',
    accentBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    demoEmail: 'alex.rivera@primemeet.io',
    demoName: 'Alex Rivera',
  },
  MANAGER: {
    key: 'MANAGER',
    label: 'Manager',
    role: UserRole.PROJECT_MANAGER,
    description: 'Project roadmaps, team capacity & task delivery',
    heading: 'Sign in to PrimeMeet Portfolio',
    subheading: 'Orchestrate project milestones, balance team workload, and unblock delivery risks.',
    icon: Briefcase,
    accentBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    accentBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    demoEmail: 'sarah.chen@primemeet.io',
    demoName: 'Sarah Chen',
  },
  MEMBER: {
    key: 'MEMBER',
    label: 'Member',
    role: UserRole.TEAM_MEMBER,
    description: 'Personal sprint focus, Kanban tasks & collaboration',
    heading: 'Sign in to PrimeMeet Workspace',
    subheading: 'Focus on your assigned tasks, ship deliverables, and collaborate in real time.',
    icon: Users,
    accentBorder: 'border-sky-500 ring-2 ring-sky-500/20',
    accentBg: 'bg-sky-500/10 dark:bg-sky-500/20',
    accentText: 'text-sky-600 dark:text-sky-400',
    demoEmail: 'david.kim@primemeet.io',
    demoName: 'David Kim',
  },
};

interface LoginViewProps {
  onAuthenticated: (user: User) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onAuthenticated,
  darkMode,
  onToggleDarkMode,
}) => {
  const [selectedPortal, setSelectedPortal] = useState<PortalKey>('MANAGER');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devConfig, setDevConfig] = useState<DevConfigResponse | null>(null);

  useEffect(() => {
    api
      .getDevConfig()
      .then((cfg) => setDevConfig(cfg))
      .catch(() => setDevConfig(null));
  }, []);

  const currentPortal = PORTALS[selectedPortal];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onAuthenticated(res.user);
      } else {
        const res = await api.signup(name, email, password);
        onAuthenticated(res.user);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOneClickDemo = async (portalKey: PortalKey) => {
    const portal = PORTALS[portalKey];
    setSelectedPortal(portalKey);
    setMode('login');
    setError(null);
    const pw = devConfig?.demoPassword || 'PrimeMeet2026!';
    setEmail(portal.demoEmail);
    setPassword(pw);
    setLoading(true);
    try {
      const res = await api.login(portal.demoEmail, pw);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Left Form Column */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between px-6 sm:px-12 py-8 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 z-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl btn-3d-primary flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                PrimeMeet
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label="Toggle color theme"
            className="p-2.5 rounded-xl btn-3d-secondary text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Center Auth Content */}
        <div className="my-auto py-8 max-w-md w-full mx-auto">
          <p className="text-xs font-semibold text-[#6366F1] dark:text-indigo-400 mb-2">
            Plan clearly. Collaborate better. Ship faster.
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            {mode === 'signup' ? 'Create your PrimeMeet account' : currentPortal.heading}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            {mode === 'signup'
              ? 'New accounts are provisioned with Team Member access and strict row-level security.'
              : currentPortal.subheading}
          </p>

          {/* Portal Selector Cards (Admin, Manager, Member) */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Select workspace portal view
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(PORTALS) as PortalKey[]).map((key) => {
                const p = PORTALS[key];
                const Icon = p.icon;
                const active = selectedPortal === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPortal(key)}
                    className={`text-left p-3.5 rounded-2xl transition-all duration-150 cursor-pointer ${
                      active
                        ? `card-3d ${p.accentBorder}`
                        : 'card-3d card-3d-interactive opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${
                        active
                          ? `${p.accentBg} ${p.accentText}`
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {p.label}
                    </div>
                    <div className="text-[11px] leading-tight text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {p.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 font-medium"
            >
              {error}
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Work email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={currentPortal.demoEmail}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl btn-3d-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <span>
                {loading
                  ? 'Authenticating...'
                  : mode === 'login'
                  ? 'Sign in to PrimeMeet'
                  : 'Create Team Member Account'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Login / Sign up */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              {mode === 'login' ? "Don't have an account yet?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="font-semibold text-[#6366F1] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {mode === 'login' ? 'Create an account' : 'Sign in instead'}
            </button>
          </div>

          {/* Development-only One-Click Demo Accounts */}
          {devConfig?.isDev && (
            <div className="mt-7 pt-6 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#6366F1]" />
                  One-Click Demo Accounts (Dev)
                </span>
                {devConfig.demoPassword && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    Pass: {devConfig.demoPassword}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(Object.keys(PORTALS) as PortalKey[]).map((key) => {
                  const p = PORTALS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={loading}
                      onClick={() => handleOneClickDemo(key)}
                      className="p-3 rounded-xl card-3d card-3d-interactive text-left cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.demoName}
                      </div>
                      <div className="text-[11px] text-[#6366F1] dark:text-indigo-400 font-medium truncate mt-0.5">
                        {p.label} Role
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          <span>PrimeMeet Workspace Platform</span>
          <span>Plan clearly. Collaborate better. Ship faster.</span>
        </div>
      </div>

      {/* Right Brand Hero Panel: Luminous Light-First 3D Spatial Stage (Gradients permitted on Login Hero) */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-gradient-to-br from-indigo-50/90 via-[#F8FAFC] to-sky-100/70 dark:from-slate-900 dark:via-indigo-950/80 dark:to-slate-900 text-slate-900 dark:text-white p-12 flex-col justify-between perspective-1000">
        {/* Soft 3D Ambient Light Orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-400/15 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-400/15 dark:bg-sky-500/15 blur-3xl pointer-events-none" />

        {/* Architectural Dot-Grid Plane */}
        <div
          className="absolute inset-0 opacity-45 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(rgba(99, 102, 241, 0.28) 1.25px, transparent 1.25px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Top Context Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6366F1]" />
            <span>PrimeMeet Labs · Interactive 3D Workspace Architecture</span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            Portal Preview:{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              {currentPortal.role}
            </span>
          </div>
        </div>

        {/* 3D Floating Glass & Tactile UI Fragment Showcase */}
        <div className="relative z-10 my-auto max-w-2xl mx-auto w-full preserve-3d">
          {selectedPortal === 'ADMIN' && (
            <div className="floating-3d-card rounded-3xl card-3d p-7 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs text-[#6366F1] dark:text-indigo-400 font-semibold">
                    SUPER_ADMIN · Command Center
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    Organization & Security Governance
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-[#6366F1] flex items-center justify-center shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3.5 tabular-nums">
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Total Users</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">6</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Organizations</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">1</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Projects</div>
                  <div className="text-2xl font-bold text-[#6366F1] dark:text-indigo-400 mt-1">
                    3
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Active Tasks</div>
                  <div className="text-2xl font-bold text-[#10B981] mt-1">25</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-200/60 dark:border-slate-700 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Live Row-Level Security Enforcement
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>System-wide organization & user role control</span>
                  <span className="text-[#10B981] font-mono font-semibold">ALLOWED</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Unauthorized project deletion or comment tampering</span>
                  <span className="text-[#EF4444] font-mono font-semibold">403 BLOCKED</span>
                </div>
              </div>
            </div>
          )}

          {selectedPortal === 'MANAGER' && (
            <div className="floating-3d-card rounded-3xl card-3d p-7 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs text-[#10B981] font-semibold">
                    PROJECT_MANAGER · Portfolio Health
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    Active Roadmap & Team Workload
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shadow-inner">
                  <FolderKanban className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Website Redesign
                    </span>
                    <span className="text-xs text-[#10B981] font-semibold">ACTIVE · HIGH</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-[#10B981] rounded-full"
                      style={{ width: '30%' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>10 tasks · 3 completed</span>
                    <span>Managed by Sarah Chen</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Mobile Application
                    </span>
                    <span className="text-xs text-[#F59E0B] font-semibold">ACTIVE · URGENT</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-[#6366F1] rounded-full"
                      style={{ width: '22%' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>9 tasks · 2 completed</span>
                    <span>Due in 2 days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedPortal === 'MEMBER' && (
            <div className="floating-3d-card rounded-3xl card-3d p-7 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                    TEAM_MEMBER · My Focus Queue
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                    Assigned Tasks & Sprint Deliverables
                  </div>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Build interactive hero preview with role-based glass cards
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Website Redesign · IN_PROGRESS · URGENT
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#F59E0B] tabular-nums shrink-0 ml-3">
                    Due Today
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Implement optimistic drag-and-drop state engine with rollback
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Mobile Application · IN_PROGRESS · URGENT
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#6366F1] dark:text-indigo-400 tabular-nums shrink-0 ml-3">
                    Due Tomorrow
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Architecture Bar */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800 pt-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-[#6366F1]" />
              Row-Level Access Policies
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-[#10B981]" />
              Real-Time WebSocket Sync
            </span>
          </div>
          <span className="font-mono font-semibold text-[#6366F1] dark:text-indigo-400 tabular-nums">
            PrimeMeet Labs
          </span>
        </div>
      </div>
    </div>
  );
};
