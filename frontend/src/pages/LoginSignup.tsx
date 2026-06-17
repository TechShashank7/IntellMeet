import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { Mail, Lock, User } from 'lucide-react';

export default function LoginSignup() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // Simulate API call and login
    login(email);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-[24px] font-bold tracking-tight text-[#111827]">
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </h2>
        <p className="mt-2 text-center text-[14px] text-[#6B7280]">
          Or{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-[#4F46E5] hover:text-[#4338CA] transition-colors"
          >
            {isLogin ? 'start your 14-day free trial' : 'sign in to your existing account'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 border border-[#E5E7EB]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-[14px] font-medium text-[#374151]">
                  Full Name
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-[#9CA3AF]" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required={!isLogin}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-[#D1D5DB] rounded-md shadow-sm placeholder-[#9CA3AF] focus:outline-none focus:ring-[#4F46E5] focus:border-[#4F46E5] text-[14px]"
                    placeholder="Sarah Anderson"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[14px] font-medium text-[#374151]">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-[#9CA3AF]" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-[#D1D5DB] rounded-md shadow-sm placeholder-[#9CA3AF] focus:outline-none focus:ring-[#4F46E5] focus:border-[#4F46E5] text-[14px]"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[14px] font-medium text-[#374151]">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-[#9CA3AF]" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-[#D1D5DB] rounded-md shadow-sm placeholder-[#9CA3AF] focus:outline-none focus:ring-[#4F46E5] focus:border-[#4F46E5] text-[14px]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-[#4F46E5] focus:ring-[#4F46E5] border-[#D1D5DB] rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-[14px] text-[#374151]">
                    Remember me
                  </label>
                </div>

                <div className="text-[14px]">
                  <a href="#" className="font-medium text-[#4F46E5] hover:text-[#4338CA]">
                    Forgot your password?
                  </a>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-[14px] font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4F46E5] transition-colors"
              >
                {isLogin ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E7EB]" />
              </div>
              <div className="relative flex justify-center text-[13px]">
                <span className="px-2 bg-white text-[#6B7280]">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <button
                  type="button"
                  className="w-full inline-flex justify-center py-2 px-4 border border-[#D1D5DB] rounded-md shadow-sm bg-white text-[14px] font-medium text-[#374151] hover:bg-[#F9FAFB]"
                >
                  <span className="sr-only">Sign in with Google</span>
                  <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  className="w-full inline-flex justify-center py-2 px-4 border border-[#D1D5DB] rounded-md shadow-sm bg-white text-[14px] font-medium text-[#374151] hover:bg-[#F9FAFB]"
                >
                  <span className="sr-only">Sign in with Microsoft</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M1.05 1.05h10.5v10.5H1.05z" />
                    <path fill="#7FBA00" d="M12.45 1.05h10.5v10.5h-10.5z" />
                    <path fill="#00A4EF" d="M1.05 12.45h10.5v10.5H1.05z" />
                    <path fill="#FFB900" d="M12.45 12.45h10.5v10.5h-10.5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => navigate('/')}
              className="inline-flex items-center text-[13px] text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
