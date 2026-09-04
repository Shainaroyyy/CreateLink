import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState<'creator' | 'brand' | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const forced = params.get('role');
    if (forced === 'brand' || forced === 'creator') {
      setRole(forced as any);
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const queryRole = new URLSearchParams(location.search).get('role');
      const savedRole = sessionStorage.getItem('createlink-login-role');
      const forcedRole = queryRole || savedRole;
      const expectedRole = forcedRole === 'creator' || forcedRole === 'brand' ? forcedRole : undefined;
      const loginPromise = login(email.trim().toLowerCase(), password, expectedRole);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timed out. Please check your credentials or network.')), 10000)
      );
      const user = (await Promise.race([loginPromise, timeoutPromise])) as any;
      // The authenticated account role controls the destination, not the login page URL.
      if (user.role === 'brand') {
        navigate('/brand/dashboard');
      } else {
        navigate('/feed');
      }
      sessionStorage.removeItem('createlink-login-role');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[#f8f7ff]">
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1F1F1F] items-center justify-center relative overflow-hidden">

        <div className="relative z-10 text-white text-center px-12 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 text-3xl font-black">
            CL
          </div>
          <h1 className="text-4xl font-black mb-4 leading-tight">
            Where Creators<br />Meet Brands ✨
          </h1>
          <p className="text-white/80 text-base leading-relaxed">
            The professional trust layer for the creator economy. Build your verified reputation, discover campaigns, and grow together.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Creators', value: '50K+' },
              { label: 'Brands', value: '8K+' },
              { label: 'Collabs', value: '200K+' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-2xl py-3 px-2">
                <div className="text-2xl font-black">{value}</div>
                <div className="text-white/70 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo for mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-[#1F1F1F] flex items-center justify-center font-black text-white text-lg">
              CL
            </div>
            <span className="text-xl font-extrabold">
              <span className="text-[#A8678A]">Creator</span>
              <span className="text-[#1F1F1F]">Link</span>
            </span>
          </div>

          <h2 className="text-2xl font-black text-[#1F1F1F] mb-1">
            {role === 'brand' ? 'Brand Sign in' : role === 'creator' ? 'Creator Sign in' : 'Welcome back 👋'}
          </h2>
          <p className="text-[#6E6A65] text-sm mb-8">{
            role === 'brand' ? 'Log in to your Brand account' : role === 'creator' ? 'Log in to your Creator account' : 'Log in to your CreatorLink account'
          }</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6A65] mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#6E6A65] transition-all text-sm"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6A65] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#6E6A65] transition-all text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] px-4 py-3 rounded-2xl text-sm font-semibold text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1F1F1F] text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Logging in...
                </span>
              ) : 'Log In →'}
            </button>
          </form>



          <p className="mt-6 text-sm text-center text-[#6E6A65]">
            No account?{' '}
            <Link to="/register" className="font-bold text-[#A8678A] hover:opacity-80">
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
