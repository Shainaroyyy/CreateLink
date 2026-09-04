import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  // creator-specific
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [platforms, setPlatforms] = useState('instagram');
  const [audienceSize, setAudienceSize] = useState('');
  // brand-specific
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (role === 'creator' && !name.trim()) {
      setError('Please enter your full name or creator name.');
      return;
    }

    setLoading(true);

    try {
      const profile =
        role === 'brand'
          ? {
              companyName,
              industry,
              companySize,
              website,
            }
          : {
              name: name.trim(),
              displayName: name.trim(),
              niche,
              platforms,
              audienceSize,
            };

      await register(email.trim().toLowerCase(), password, role, profile);

      setSuccessMessage(
        'Registration successful! Please check your inbox to verify your email, or log in now.'
      );

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F2E8] text-[#1F1F1F] px-4 relative overflow-hidden">
      {/* Decorative Glows Removed */}

      <div className="bg-white border border-[#E7E1D8] p-8 sm:p-10 rounded-[20px] shadow-card w-full max-w-md relative z-10 overflow-hidden">
        {/* Glow removed */}

        <h1 className="text-3xl font-extrabold mb-2 text-[#1F1F1F] tracking-tight text-center">
          Register on CreatorLink
        </h1>
        <p className="text-[#6E6A65] text-xs text-center mb-8 leading-relaxed">
          Create an account to start collaborating and building campaigns.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">I am a:</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-[#1F1F1F] cursor-pointer select-none">
                <input
                  type="radio"
                  value="creator"
                  checked={role === 'creator'}
                  onChange={() => setRole('creator')}
                  className="w-4 h-4 text-[#A8678A] bg-white border-[#E7E1D8] focus:ring-[#A8678A] focus:ring-offset-white focus:ring-2"
                />
                Creator
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-[#1F1F1F] cursor-pointer select-none">
                <input
                  type="radio"
                  value="brand"
                  checked={role === 'brand'}
                  onChange={() => setRole('brand')}
                  className="w-4 h-4 text-[#A8678A] bg-white border-[#E7E1D8] focus:ring-[#A8678A] focus:ring-offset-white focus:ring-2"
                />
                Brand
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#6E6A65] transition-all duration-200 text-sm"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#6E6A65] transition-all duration-200 text-sm"
              placeholder="Create a password"
              required
            />
            <p className="text-[10px] text-[#6E6A65] mt-1 leading-normal">
              Min 12 chars, uppercase, lowercase, digit, special char
            </p>
          </div>

          {/* Role specific fields */}
          {role === 'creator' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1">
                  Full Name / Creator Name <span className="text-[#A8678A]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Archi Aggarwal"
                  className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#9E9A97] transition-all text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1">Content Niche</label>
                <input
                  type="text"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="e.g. Lifestyle, Fashion, Tech"
                  className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#9E9A97] transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1">Platforms (comma separated)</label>
                <input
                  type="text"
                  value={platforms}
                  onChange={(e) => setPlatforms(e.target.value)}
                  placeholder="Instagram, YouTube, TikTok"
                  className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#9E9A97] transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1">Audience Size</label>
                <input
                  type="text"
                  value={audienceSize}
                  onChange={(e) => setAudienceSize(e.target.value)}
                  placeholder="e.g. 50K - 100K"
                  className="w-full px-4 py-3 bg-white border border-[#E7E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] text-[#1F1F1F] placeholder-[#9E9A97] transition-all text-sm"
                />
              </div>
            </div>
          )}

          {role === 'brand' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Company Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Company Size</label>
              <input value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
            </div>
          )}
          {error && (
            <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] px-4 py-3 rounded-xl text-xs font-semibold text-center space-y-1">
              <p>{error}</p>
              {error.toLowerCase().includes('already') && (
                <p>
                  <a href="/login" className="underline font-bold hover:opacity-80">
                    Click here to Log in instead →
                  </a>
                </p>
              )}
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium text-center space-y-2">
              <p className="font-bold text-emerald-900">🎉 {successMessage}</p>
              <a
                href="/login"
                className="inline-block bg-[#1F1F1F] text-white px-4 py-2 rounded-lg font-bold text-xs hover:opacity-90 transition-all"
              >
                Go to Login →
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1F1F1F] text-white font-bold py-3.5 rounded-xl hover:opacity-90 shadow-soft transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Register</span>
            )}
          </button>
        </form>
        <p className="mt-6 text-xs text-center text-[#6E6A65]">
          Already have an account?{' '}
          <a href="/login" className="text-[#A8678A] hover:underline font-semibold">
            Log in here
          </a>
        </p>
      </div>
    </div>
  );
}
