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
  const [error, setError] = useState('');
  const { register } = useAuthStore();
  const navigate = useNavigate();

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  try {
    const profile =
      role === "brand"
        ? {
            companyName,
            industry,
            companySize,
            website,
          }
        : {
            name,
            niche,
            platforms,
            audienceSize,
          };

    await register(email, password, role, profile);

    alert(
      "Verification email sent! Please check your inbox and verify your email before logging in."
    );

    navigate("/login");
  } catch (err: any) {
    setError(err.message);
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
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Content Niche</label>
              <input value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Platforms (comma separated)</label>
              <input value={platforms} onChange={(e) => setPlatforms(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">Audience Size</label>
              <input value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} className="w-full px-4 py-3 border border-[#E7E1D8] rounded-xl" />
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
            <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] px-4 py-3 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-[#1F1F1F] text-white font-bold py-3.5 rounded-xl hover:opacity-90 shadow-soft transition-all duration-200 text-sm"
          >
            Register
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
