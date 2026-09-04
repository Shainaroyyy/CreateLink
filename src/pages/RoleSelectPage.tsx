import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import CreatorSparkGrowthIcon from '../components/icons/CreatorSparkGrowthIcon';
import BrandTrustedNetworkIcon from '../components/icons/BrandTrustedNetworkIcon';

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const selectRole = async (role: 'creator' | 'brand') => {
    sessionStorage.setItem('createlink-login-role', role);
    // Clear both local and Supabase sessions before entering a role-specific login flow.
    await logout();
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="min-h-screen bg-[#F6F2E8] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Hero */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#1F1F1F] leading-tight">
            The Trust Layer for the Creator Economy
          </h1>
          <p className="mt-4 text-lg md:text-xl text-[#6E6A65] max-w-2xl mx-auto">
            Connect creators and brands through meaningful collaborations built on trust, reputation, and proven results.
          </p>
        </header>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <div className="bg-white border border-[#E7E1D8] rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition-all">
            <div className="text-2xl font-extrabold text-[#1F1F1F]">50K+</div>
            <div className="text-xs uppercase tracking-wider text-[#6E6A65] mt-1">
              Creators
            </div>
          </div>

          <div className="bg-white border border-[#E7E1D8] rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition-all">
            <div className="text-2xl font-extrabold text-[#A8678A]">8K+</div>
            <div className="text-xs uppercase tracking-wider text-[#6E6A65] mt-1">
              Brands
            </div>
          </div>

          <div className="bg-white border border-[#E7E1D8] rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition-all">
            <div className="text-2xl font-extrabold text-[#1F1F1F]">200K+</div>
            <div className="text-xs uppercase tracking-wider text-[#6E6A65] mt-1">
              Collaborations
            </div>
          </div>
        </div>
        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
          <article
            role="button"
            tabIndex={0}
            onClick={() => { void selectRole('creator'); }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void selectRole('creator')}
            className="
  relative
  overflow-hidden
  group
  hover:bg-[#F3F0FF]
  bg-gradient-to-br from-white to-[#F8F8FD]
  border border-[#E7E1D8]
  rounded-2xl
  p-10 min-h-[320px]
  shadow-md
  hover:shadow-xl
  hover:-translate-y-1
  hover:bg-[#F8EFF3]
  hover:border-[#A8678A]
  transition-all
  duration-300
  cursor-pointer
  focus:outline-none
  focus:ring-2
  focus:ring-[#A8678A]/30
"
            aria-label="Continue as Creator"
          >
            <span
              className="
    absolute
    inset-0
    -translate-x-full
    bg-gradient-to-r
    from-transparent
    via-white/50
    to-transparent
    group-hover:translate-x-[200%]
    transition-transform
    duration-1000
    pointer-events-none
  "
            />
            <div>
              <div
                className="
    w-20 h-20
    rounded-3xl
    bg-white
    border border-[#E7E1D8]
    shadow-lg
    flex items-center justify-center
    mb-8
    group-hover:scale-110
    transition-all duration-300
  "
              >
                <CreatorSparkGrowthIcon size={44} />
              </div>

              <h3 className="text-2xl font-bold text-[#1F1F1F]">
                Continue as Creator
              </h3>

              <p className="mt-2 text-sm text-[#6E6A65] max-w-xl">
                Discover campaigns, showcase your work, and grow your creator reputation.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#F8EFF3] text-[#A8678A] text-xs font-semibold">
                  Paid Campaigns
                </span>

                <span className="px-3 py-1 rounded-full bg-[#F8EFF3] text-[#A8678A] text-xs font-semibold">
                  AI Portfolios
                </span>

                <span className="px-3 py-1 rounded-full bg-[#F8EFF3] text-[#A8678A] text-xs font-semibold">
                  Trust Score
                </span>
              </div>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <div className="text-xs text-[#9E9A97]">Creator experience</div>
              <button
                onClick={(e) => { e.stopPropagation(); void selectRole('creator'); }}
                className="ml-4 px-5 py-3 bg-[#1F1F1F] text-white rounded-xl font-bold shadow-sm hover:opacity-95 transition"
              >
                Continue
              </button>
            </div>
          </article>

          <article
            role="button"
            tabIndex={0}
            onClick={() => { void selectRole('brand'); }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void selectRole('brand')}
            className="
  relative
  overflow-hidden
  group
  hover:bg-[#F8EFF3]
  bg-gradient-to-br from-white to-[#FCF6FA]
  border border-[#E7E1D8]
  rounded-2xl
  p-8
  shadow-md
  hover:shadow-xl
  hover:-translate-y-1
  hover:bg-[#F8EFF3]
hover:border-[#A8678A]
hover:shadow-[0_0_40px_rgba(168,103,138,0.25)]
  transition-all
  duration-300
  cursor-pointer
  focus:outline-none
  focus:ring-2
  focus:ring-[#A8678A]/30
"
            aria-label="Continue as Brand"
          >
            <span
              className="
    absolute
    inset-0
    -translate-x-full
    bg-gradient-to-r
    from-transparent
    via-white/50
    to-transparent
    group-hover:translate-x-[200%]
    transition-transform
    duration-1000
    pointer-events-none
  "
            />
            <div>
              <div
                className="
    w-20 h-20
    rounded-[32px]
    bg-white
    border border-[#E7E1D8]
    shadow-lg
    flex items-center justify-center
    mb-8
    transition-all duration-300
    group-hover:scale-105
  "
              >
                <BrandTrustedNetworkIcon size={56} />
              </div>

              <h3 className="text-2xl font-bold text-[#1F1F1F]">
                Continue as Brand
              </h3>

              <p className="mt-2 text-sm text-[#6E6A65] max-w-xl">
                Find trusted creators, manage campaigns, and build successful partnerships.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-[#F3F0FF] text-[#7B6DCC] text-xs font-semibold">
                  Creator Discovery
                </span>

                <span className="px-3 py-1 rounded-full bg-[#F3F0FF] text-[#7B6DCC] text-xs font-semibold">
                  Campaign Launch
                </span>

                <span className="px-3 py-1 rounded-full bg-[#F3F0FF] text-[#7B6DCC] text-xs font-semibold">
                  Partnerships
                </span>
              </div>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <div className="text-xs text-[#9E9A97]">Brand experience</div>
              <button
                onClick={(e) => { e.stopPropagation(); void selectRole('brand'); }}
                className="ml-4 px-5 py-3 bg-[#1F1F1F] text-white rounded-xl font-bold shadow-sm hover:opacity-95 transition"
              >
                Continue
              </button>
            </div>
          </article>
        </div>

        {/* Secondary actions */}
        <div className="mt-8 text-center text-sm text-[#6E6A65]">
          <span>New here? </span>
          <button onClick={() => navigate('/register?role=creator')} className="font-semibold text-[#A8678A] hover:underline">Sign up as Creator</button>
          <span className="mx-2">•</span>
          <button onClick={() => navigate('/register?role=brand')} className="font-semibold text-[#A8678A] hover:underline">Sign up as Brand</button>
        </div>
      </div>
    </div>
  );
}
