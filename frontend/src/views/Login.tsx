import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { Button } from '../components/ui';
import { 
  Lock, 
  AlertCircle, 
  User, 
  Eye, 
  EyeOff, 
  Activity, 
  BarChart2, 
  FileText,
  Scan,
  Shield
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.user) {
        login(data.user);
      } else {
        setError('Unable to sign in. Please check your username and password and try again.');
      }
    } catch (err) {
      setError('Unable to sign in. Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#fafcfa] flex font-sans antialiased text-slate-900 relative">
      
      {/* Top Left decorative shape */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-teal-50 rounded-br-full -z-10 hidden lg:block"></div>

      {/* LEFT COLUMN - Product Intro */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between px-16 py-12 relative overflow-hidden z-10">
        
        {/* Top Branding */}
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-[#0f766e] p-2 rounded-xl shadow-md">
              <Activity className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 text-2xl leading-none tracking-tight">
                CureSight AI
              </span>
              <span className="text-sm font-medium text-slate-500 mt-1">
                Wound Intelligence Platform
              </span>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-extrabold text-slate-900 leading-[1.1] mb-4 tracking-tight">
              AI-assisted wound assessment<br/>
              and <span className="text-[#0f766e]">progress monitoring</span>
            </h1>
            <p className="text-lg text-slate-600 mb-12 leading-relaxed pr-8">
              Analyze wound images, review AI-generated measurements, and monitor assessment history in one secure clinical workspace.
            </p>

            {/* Features */}
            <div className="space-y-5">
              <div className="flex items-start gap-5">
                <div className="mt-0.5 bg-teal-50 p-2.5 rounded-lg text-[#0f766e]">
                  <Scan className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">AI-Assisted Analysis</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Automated wound detection and segmentation.</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="mt-0.5 bg-teal-50 p-2.5 rounded-lg text-[#0f766e]">
                  <Activity className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Physical Measurements</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Estimate wound dimensions and area from clinical imagery.</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="mt-0.5 bg-teal-50 p-2.5 rounded-lg text-[#0f766e]">
                  <BarChart2 className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Progress Monitoring</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Compare wound assessments over time.</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="mt-0.5 bg-teal-50 p-2.5 rounded-lg text-[#0f766e]">
                  <FileText className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Clinical Reports</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Review structured assessment information and reports.</p>
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* Abstract teal shapes mimicking the clinical image placement */}
        <div className="absolute -bottom-20 -right-20 w-[600px] h-[600px] bg-gradient-to-tr from-teal-100/40 to-teal-50/10 rounded-full blur-3xl opacity-80 -z-10 pointer-events-none"></div>
      </div>

      {/* RIGHT COLUMN - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-12 relative z-10">
        
        <div className="w-full max-w-[440px]">
          {/* Main Card */}
          <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80">
            
            {/* Card Header (Logo & Welcome) */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="bg-[#0f766e] p-2.5 rounded-xl shadow-md mb-5">
                <Activity className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">CureSight AI</h2>
              <p className="text-xs font-medium text-slate-500 mt-1 mb-6">Wound Intelligence Platform</p>
              
              <h3 className="text-xl font-bold text-slate-900">Welcome back</h3>
              <p className="text-sm text-slate-500 mt-1">Sign in to access your clinical workspace</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-lg flex items-start gap-3 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-[13px] font-bold text-[#0f766e]">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter your clinical username"
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-[#0f766e] focus:border-[#0f766e] sm:text-sm text-slate-800 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-bold text-[#0f766e]">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Enter your password"
                    className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-[#0f766e] focus:border-[#0f766e] sm:text-sm text-slate-800 transition-colors placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0f766e] hover:bg-teal-800 text-white rounded-xl shadow-md transition-all text-sm font-bold cursor-pointer"
                  disabled={loading}
                >
                  <Lock className="w-[18px] h-[18px]" />
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </form>

            {/* Authorized Access Notice block */}
            <div className="mt-6 flex items-center justify-start p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="text-slate-400">
                  <Shield className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-slate-700">Authorized clinical access</h4>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">For registered doctors and administrators.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="mt-8 text-center flex flex-col items-center gap-1.5">
            <div className="flex gap-4 text-xs font-semibold text-slate-400">
              <span>Privacy</span>
              <span>·</span>
              <span>Terms</span>
              <span>·</span>
              <span>Support</span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">© 2026 CureSight AI. All rights reserved.</p>
          </div>

        </div>



      </div>
    </div>
  );
};
