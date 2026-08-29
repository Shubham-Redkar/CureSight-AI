import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  HeartPulse
} from 'lucide-react';

interface ShellProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  clinicName: string;
  practitionerRole: string;
}

export const Shell: React.FC<ShellProps> = ({
  activeTab,
  setActiveTab,
  children,
  clinicName,
  practitionerRole,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'assessment', label: 'Wound Assessment', icon: ClipboardCheck },
    { id: 'progress', label: 'Progress Analysis', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to end your current session?')) {
      alert('You have logged out. (This is a frontend demonstration.)');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* HEADER FOR MOBILE & TABLET */}
      <header className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-teal-700" />
          <span className="font-semibold text-slate-900 tracking-tight text-sm">Wound Healing Progress</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-500 hover:text-slate-700 focus:outline-hidden p-1.5"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen">
          {/* Logo Section */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="bg-teal-50 p-1.5 rounded-md border border-teal-100">
              <HeartPulse className="w-6 h-6 text-teal-700" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-sm leading-tight tracking-tight">
                AI WOUND PROGRESS
              </span>
              <span className="text-[10px] font-medium text-teal-700 tracking-wider uppercase">
                Clinical Suite
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 border-l-2 border-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs border border-slate-300">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">Clinical Staff</div>
                  <div className="text-[10px] text-slate-500 truncate">{practitionerRole}</div>
                </div>
              </button>

              {isProfileOpen && (
                <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-500">
                    {clinicName}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MOBILE NAVIGATION DRAWER */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Menu panel */}
            <div className="relative flex flex-col w-64 max-w-xs bg-white h-full shadow-xl border-r border-slate-200 py-4 px-3 z-50">
              <div className="flex items-center justify-between px-3 pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-teal-700" />
                  <span className="font-semibold text-slate-900 text-sm">Wound Healing AI</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {navigationItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-50 text-teal-850 border-l-2 border-teal-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border border-slate-300">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Clinical Staff</div>
                    <div className="text-[10px] text-slate-500">{practitionerRole}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
          {/* Header (Desktop-only subtitle/banner) */}
          <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
            <h1 className="text-lg font-semibold text-slate-900 m-0 tracking-tight">
              AI BASED WOUND HEALING PROGRESS ANALYSIS
            </h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span>Institution: <strong className="text-slate-700">{clinicName}</strong></span>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span>System Calibrated</span>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION (Tab bar layout) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 flex justify-around py-1 shadow-md">
        {navigationItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
      {/* Bottom spacer for mobile navigation */}
      <div className="h-14 lg:hidden shrink-0"></div>
    </div>
  );
};
