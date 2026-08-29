import React, { useEffect } from 'react';

// ==========================================
// BADGES
// ==========================================
interface BadgeProps {
  variant: 'improving' | 'stable' | 'attention' | 'pending' | 'verified' | 'neutral';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children }) => {
  const styles = {
    improving: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stable: 'bg-blue-50 text-blue-700 border-blue-200',
    attention: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    verified: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}>
      {children}
    </span>
  );
};

// ==========================================
// BUTTONS
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variants = {
    primary: 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
    ghost: 'hover:bg-slate-50 text-slate-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// ==========================================
// INPUTS & SELECTS
// ==========================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <input
        className={`w-full px-3 py-2 text-sm bg-white border rounded-md shadow-2xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors ${
          error ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
      {error && <span className="block mt-1 text-xs text-rose-600">{error}</span>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, error, children, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <div className="relative">
        <select
          className={`w-full px-3 py-2 text-sm bg-white border rounded-md shadow-2xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors appearance-none ${
            error ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-200'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      {error && <span className="block mt-1 text-xs text-rose-600">{error}</span>}
    </div>
  );
};

// ==========================================
// CARDS
// ==========================================
interface CardProps {
  title?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, headerAction, children, className = '' }) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-2xs ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="font-semibold text-slate-800 text-sm md:text-base">{title}</div>
          <div>{headerAction}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

// ==========================================
// MODAL
// ==========================================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Box */}
      <div className={`relative bg-white w-full ${sizes[size]} rounded-lg shadow-xl border border-slate-100 transform transition-all flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 focus:outline-hidden p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-sm text-slate-700">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-800 text-white border-emerald-900',
    error: 'bg-rose-800 text-white border-rose-900',
    info: 'bg-teal-800 text-white border-teal-900',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-teal-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-sm transition-all duration-300 animate-slide-in ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1 font-medium">{message}</span>
      <button onClick={onClose} className="text-white/60 hover:text-white focus:outline-hidden">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
