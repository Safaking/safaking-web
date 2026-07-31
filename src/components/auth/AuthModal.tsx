'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Mail, Lock, User, Phone, X, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, setDemoRole } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email || 'user@safaking.com', role);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  const handleQuickDemo = (selectedRole: UserRole) => {
    setDemoRole(selectedRole);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-maroon-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl shadow-2xl border border-royal-200"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-maroon-900 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Modal Header */}
          <div className="relative bg-maroon-950 text-white p-8 text-center overflow-hidden">
            <div className="absolute inset-0 pattern-diamond opacity-20" />
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-royal-gradient mx-auto flex items-center justify-center mb-3 shadow-lg shadow-royal-500/20 relative z-10"
            >
              <Crown size={24} className="text-maroon-950" />
            </motion.div>
            <h3 className="font-display font-black text-2xl text-royal-100 tracking-wider uppercase relative z-10">
              SafaKing Account
            </h3>
            <p className="text-xs text-royal-200/60 mt-1 relative z-10">
              {tab === 'login' ? 'Sign in to access your royal portal' : 'Join India\'s premier safa network'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/50 p-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl ${
                tab === 'login' ? 'bg-white text-maroon-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-xl ${
                tab === 'signup' ? 'bg-white text-maroon-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Content */}
          <div className="p-7">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 size={48} className="text-emerald-500 mx-auto animate-bounce" />
                <h4 className="font-display font-bold text-xl text-maroon-900">Welcome Back!</h4>
                <p className="text-xs text-gray-500">Redirecting to your portal...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role Selector */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'customer', label: 'Customer' },
                      { id: 'artist', label: 'Safa Artist' },
                      { id: 'admin', label: 'Admin' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRole(r.id as UserRole)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                          role === r.id
                            ? 'bg-maroon-950 text-royal-300 border-maroon-950 shadow-md'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {tab === 'signup' && (
                  <>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        required
                        type="text"
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                      />
                    </div>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        required
                        type="tel"
                        placeholder="Phone Number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                      />
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    required
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                  />
                </div>

                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    required
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-maroon-800/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-maroon-950 hover:bg-maroon-900 text-royal-300 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-colors"
                >
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                {/* Quick Demo Switcher */}
                <div className="pt-3 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold flex items-center justify-center gap-1">
                    <Sparkles size={11} className="text-amber-500" /> One-Click Role Testing
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('artist')}
                      className="px-3 py-1.5 bg-royal-100 text-royal-800 text-[10px] font-bold rounded-lg hover:bg-royal-200 transition-colors"
                    >
                      Login as Artist
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo('admin')}
                      className="px-3 py-1.5 bg-maroon-100 text-maroon-900 text-[10px] font-bold rounded-lg hover:bg-maroon-200 transition-colors"
                    >
                      Login as Admin
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
