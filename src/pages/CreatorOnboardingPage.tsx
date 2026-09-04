import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useCreatorStore } from '../stores/creatorStore';

const CONTENT_TYPES = [
  'Technology', 'Lifestyle', 'Beauty', 'Fashion', 'Fitness',
  'Food', 'Travel', 'Gaming', 'Education', 'Finance',
  'Comedy', 'Photography', 'Art & Design', 'Music', 'Parenting', 'Other'
];

const PLATFORMS = [
  'Instagram', 'YouTube', 'TikTok', 'LinkedIn', 'X (Twitter)', 'Twitch', 'Substack', 'Other'
];

const CONTENT_STYLES = [
  'Educational', 'Entertaining', 'Storytelling', 'Reviews', 'Tutorials',
  'Vlogs', 'Product-focused', 'Aesthetic', 'Short-form', 'Long-form', 'Humorous', 'Other'
];

const AUDIENCES = [
  'Gen Z', 'Millennials', 'Students', 'Professionals', 'Parents',
  'Fitness enthusiasts', 'Beauty enthusiasts', 'Tech enthusiasts',
  'Entrepreneurs', 'General audience', 'Other'
];

const COLLAB_TYPES = [
  'Sponsored posts', 'Product reviews', 'Affiliate collaborations',
  'UGC (User Generated Content)', 'Long-term partnerships',
  'Campaigns', 'Event collaborations', 'Brand Ambassador'
];

export default function CreatorOnboardingPage({
  onComplete,
  isModal = false
}: {
  onComplete?: () => void;
  isModal?: boolean;
}) {
  const { currentUser } = useAuthStore();
  const { creator, loadCreator, saveOnboarding } = useCreatorStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [location, setLocation] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [contentStyle, setContentStyle] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [collabTypes, setCollabTypes] = useState<string[]>([]);
  const [uniqueValue, setUniqueValue] = useState('');

  // Load existing creator profile answers if available
  useEffect(() => {
    if (!currentUser) return;

    loadCreator(currentUser.id).then(() => {
      // Prefill if data already exists in creator object or localStorage
      try {
        const cachedRaw = localStorage.getItem(`creator_onboarding_${currentUser.id}`);
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};

        setDisplayName(cached.displayName || creator?.displayName || currentUser.email.split('@')[0]);
        setLocation(cached.location || creator?.location || '');
        setCategories(cached.categories || creator?.contentCategories || []);
        setPlatforms(cached.platforms || creator?.platforms || []);
        setContentStyle(cached.contentStyle || creator?.contentStyle || []);
        setTargetAudience(cached.targetAudience || creator?.targetAudience || []);
        setBio(cached.bio || creator?.bio || '');
        setCollabTypes(cached.collabTypes || creator?.collabTypes || []);
        setUniqueValue(cached.uniqueValue || creator?.uniqueValue || '');
      } catch {}
    });
  }, [currentUser, loadCreator]);

  const toggleSelect = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  // Progressive saving on each step transition
  const saveProgress = async (completed = false) => {
    if (!currentUser) return;
    setSaving(true);
    setErrorMessage('');

    try {
      await saveOnboarding({
        displayName,
        location,
        categories,
        platforms,
        contentStyle,
        targetAudience,
        bio,
        collabTypes,
        uniqueValue,
        step,
        completed,
      });
    } catch (err: any) {
      console.warn('Progressive save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Validation per step
    if (step === 1 && categories.length === 0) {
      setErrorMessage('Please select at least one content category.');
      return;
    }
    if (step === 2 && platforms.length === 0) {
      setErrorMessage('Please select at least one platform you create on.');
      return;
    }
    if (step === 3 && contentStyle.length === 0) {
      setErrorMessage('Please select at least one content style.');
      return;
    }
    if (step === 4 && targetAudience.length === 0) {
      setErrorMessage('Please select your primary audience.');
      return;
    }
    if (step === 5 && bio.trim().length < 10) {
      setErrorMessage('Please write a short description about yourself (min. 10 characters).');
      return;
    }

    setErrorMessage('');
    await saveProgress(false);

    if (step < 7) {
      setStep((prev) => prev + 1);
    } else {
      // Finish onboarding
      await saveProgress(true);
      if (onComplete) {
        onComplete();
      } else {
        navigate(`/creator/${currentUser?.id || 'me'}`);
      }
    }
  };

  const handleBack = () => {
    setErrorMessage('');
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const progressPercent = Math.round((step / 7) * 100);

  return (
    <div className={isModal ? 'w-full' : 'min-h-[85vh] flex items-center justify-center py-10 px-4 bg-[#F6F2E8]'}>
      <div className={`w-full max-w-2xl bg-white border border-[#E7E1D8] rounded-[24px] p-6 sm:p-10 shadow-card ${isModal ? 'border-none p-0 shadow-none' : ''}`}>

        {/* Progress Bar & Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-[#6E6A65] mb-2">
            <span>Step {step} of 7</span>
            <span className="text-[#A8678A]">{progressPercent}% Completed</span>
          </div>
          <div className="w-full bg-[#E7E1D8] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#A8678A] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Question 1: Content Type / Niches */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">What type of content do you create?</h2>
              <p className="text-xs text-[#6E6A65]">Select all categories that match your content strategy.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {CONTENT_TYPES.map((type) => {
                const selected = categories.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleSelect(categories, type, setCategories)}
                    className={`py-3 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      selected
                        ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A] shadow-soft scale-[1.02]'
                        : 'bg-white border-[#E7E1D8] text-[#1F1F1F] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className="mr-1.5">{selected ? '✓' : '+'}</span> {type}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question 2: Platforms */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">Which platforms do you create content on?</h2>
              <p className="text-xs text-[#6E6A65]">Where can brands and followers find your work?</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {PLATFORMS.map((platform) => {
                const selected = platforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => toggleSelect(platforms, platform, setPlatforms)}
                    className={`py-3 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      selected
                        ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A] shadow-soft scale-[1.02]'
                        : 'bg-white border-[#E7E1D8] text-[#1F1F1F] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className="mr-1.5">{selected ? '✓' : '+'}</span> {platform}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question 3: Content Style */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">What is your content style?</h2>
              <p className="text-xs text-[#6E6A65]">How would you describe the tone and format of your content?</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {CONTENT_STYLES.map((style) => {
                const selected = contentStyle.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleSelect(contentStyle, style, setContentStyle)}
                    className={`py-3 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      selected
                        ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A] shadow-soft scale-[1.02]'
                        : 'bg-white border-[#E7E1D8] text-[#1F1F1F] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className="mr-1.5">{selected ? '✓' : '+'}</span> {style}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question 4: Primary Audience */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">Who is your primary audience?</h2>
              <p className="text-xs text-[#6E6A65]">Who engages most with your posts and videos?</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {AUDIENCES.map((aud) => {
                const selected = targetAudience.includes(aud);
                return (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => toggleSelect(targetAudience, aud, setTargetAudience)}
                    className={`py-3 px-3 rounded-xl border text-xs font-bold text-left transition-all ${
                      selected
                        ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A] shadow-soft scale-[1.02]'
                        : 'bg-white border-[#E7E1D8] text-[#1F1F1F] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className="mr-1.5">{selected ? '✓' : '+'}</span> {aud}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question 5: About You & Bio */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">Tell us about yourself</h2>
              <p className="text-xs text-[#6E6A65]">Introduce yourself to brands and summarize your creative mission.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1">
                  Creator / Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Archi Aggarwal"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E1D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1">
                  Location (City, Country)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Mumbai, India or London, UK"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E1D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1">
                  Short Bio / Description
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a short bio describing your passion, storytelling style, and the themes you explore..."
                  className="w-full px-4 py-3 rounded-xl border border-[#E7E1D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A] resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Question 6: Brand Collaborations */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">What kind of brand collaborations are you interested in?</h2>
              <p className="text-xs text-[#6E6A65]">Select all collaboration formats you are excited to deliver.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {COLLAB_TYPES.map((type) => {
                const selected = collabTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleSelect(collabTypes, type, setCollabTypes)}
                    className={`py-3 px-3.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      selected
                        ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A] shadow-soft scale-[1.01]'
                        : 'bg-white border-[#E7E1D8] text-[#1F1F1F] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <span className="mr-2">{selected ? '✓' : '+'}</span> {type}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question 7: Uniqueness / Value Proposition */}
        {step === 7 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] mb-1">What makes your content unique?</h2>
              <p className="text-xs text-[#6E6A65]">Tell brands what makes your content, voice, or audience connection special.</p>
            </div>

            <div className="pt-2">
              <textarea
                rows={5}
                value={uniqueValue}
                onChange={(e) => setUniqueValue(e.target.value)}
                placeholder="e.g. I break down complex concepts into engaging, highly relatable short reels with high retention. My community trusts my honest reviews and actively asks for recommendations."
                className="w-full px-4 py-3 rounded-xl border border-[#E7E1D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A] resize-none"
              />
            </div>
          </div>
        )}

        {/* Validation Error */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-[#E7E1D8]">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || saving}
            className="px-5 py-2.5 rounded-xl border border-[#E7E1D8] text-xs font-bold text-[#1F1F1F] hover:bg-[#F8EFF3] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#1F1F1F] text-white text-xs font-bold hover:opacity-90 transition-all shadow-soft disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <span>Saving...</span>
            ) : step === 7 ? (
              <span>Complete Profile ✨</span>
            ) : (
              <span>Continue →</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
