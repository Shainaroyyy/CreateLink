import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useCreatorStore } from '../stores/creatorStore';
import { uploadReelFile, saveReel } from '../services/reelsService';

export default function PortfolioPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { creator, loadCreator } = useCreatorStore();
  const [showDropdown, setShowDropdown] = useState(false);

  // Upload state hooks
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('beauty');
  const [toastMessage, setToastMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      loadCreator(currentUser.id);
    }
  }, [currentUser, loadCreator]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      alert('Please select a video or image file.');
      return;
    }
    setPendingFile(file);
    setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
    setUploadDesc('');
    setUploadCategory('beauty');
    setShowUploadModal(true);
    e.target.value = '';
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    setIsUploading(true);
    try {
      const creatorId = creator?.id || `creator-${currentUser?.id || 'me'}`;
      // 1. Upload file to Supabase Storage
      const videoUrl = await uploadReelFile(creatorId, pendingFile);

      // 2. Save metadata to Supabase DB
      const isVideo = pendingFile.type.startsWith('video/');
      const isImage = pendingFile.type.startsWith('image/');

      const saved = await saveReel(creatorId, {
        title: uploadTitle.trim() || pendingFile.name.replace(/\.[^.]+$/, ''),
        description: uploadDesc.trim() || 'Uploaded portfolio item',
        category: uploadCategory,
        thumbnailUrl: '', // Will show first frame or fallback
        videoUrl: isVideo ? videoUrl : '',
        metrics: { views: 0, likes: 0, comments: 0, engagementRate: 0 },
        campaignId: null,
      });

      // Synchronize sessionStorage allReels
      const savedReels = localStorage.getItem(`reels-${creatorId}`);
      if (savedReels) {
        sessionStorage.setItem('allReels', savedReels);
      }

      setPendingFile(null);
      setShowUploadModal(false);
      setToastMessage('Portfolio item uploaded successfully! 🎉');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(err.message || 'Failed to upload portfolio item.');
    } finally {
      setIsUploading(false);
    }
  };

  const portfolios = [
    {
      title: 'Beauty Campaigns',
      category: 'Beauty',
      campaigns: 8,
      brands: 5,
      engagement: '9.4%',
      image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800'
    },
    {
      title: 'Lifestyle Content',
      category: 'Lifestyle',
      campaigns: 12,
      brands: 7,
      engagement: '8.8%',
      image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800'
    },
    {
      title: 'Tech Reviews',
      category: 'Tech',
      campaigns: 6,
      brands: 3,
      engagement: '7.1%',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'
    }
  ];

  return (
    <div className="p-6 md:p-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1F1F1F]">
            My Portfolios
          </h1>
          <p className="text-[#6E6A65] mt-2">
            Showcase your best work and brand collaborations.
          </p>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="bg-[#1F1F1F] text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            + Create Portfolio
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="video/*,image/*" 
            className="hidden" 
          />
          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#E7E1D8] shadow-lg py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    navigate('/creator/me/ai-portfolio');
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-3 text-sm text-[#1F1F1F] font-bold hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors"
                >
                  <span>✨</span>
                  <span>Generate with AI</span>
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-3 text-sm text-[#1F1F1F] font-bold hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors border-t border-[#F0EBE3]"
                >
                  <span>📁</span>
                  <span>Upload from Media</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Portfolios" value="3" />
        <StatCard title="Campaigns" value="26" />
        <StatCard title="Brands Worked" value="15" />
        <StatCard title="Avg Engagement" value="8.4%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {portfolios.map((portfolio) => (
          <div
            key={portfolio.title}
            className="bg-white rounded-3xl border border-[#E7E1D8] overflow-hidden shadow-sm"
          >
            <img
              src={portfolio.image}
              alt={portfolio.title}
              className="w-full h-48 object-cover"
            />

            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg text-[#1F1F1F]">
                  {portfolio.title}
                </h2>

                <span className="bg-[#F8EFF3] text-[#A8678A] text-xs px-3 py-1 rounded-full">
                  {portfolio.category}
                </span>
              </div>

              <div className="space-y-2 text-sm text-[#6E6A65]">
                <p>{portfolio.campaigns} Campaigns</p>
                <p>{portfolio.brands} Brand Collaborations</p>
                <p>{portfolio.engagement} Avg Engagement</p>
              </div>

              <button 
                onClick={() => navigate(`/creator/${currentUser?.id || 'me'}`)}
                className="mt-5 w-full border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] py-2 rounded-xl font-semibold transition-colors"
              >
                View Portfolio
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Details Modal */}
      {showUploadModal && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1F1F]/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E7E1D8] rounded-[24px] p-6 sm:p-8 max-w-md w-full shadow-card relative">
            <button 
              onClick={() => { setShowUploadModal(false); setPendingFile(null); }}
              className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] bg-[#F8EFF3] rounded-xl p-1.5 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg font-black text-[#1F1F1F] mb-1">
              Upload from Media
            </h3>
            <p className="text-xs text-[#6E6A65] mb-5">
              Add details for "{pendingFile.name}" to publish to your portfolio.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1.5">Title</label>
                <input 
                  type="text" 
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Give your portfolio item a title..."
                  className="w-full px-4 py-3 bg-[#F8EFF3] border border-[#E7E1D8] focus:border-[#A8678A] focus:outline-none rounded-xl text-sm text-[#1F1F1F] font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1.5">Description</label>
                <textarea 
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Describe this collaboration or showcase piece..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#F8EFF3] border border-[#E7E1D8] focus:border-[#A8678A] focus:outline-none rounded-xl text-sm text-[#1F1F1F] font-semibold resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A65] uppercase tracking-wider mb-1.5">Category</label>
                <select 
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F8EFF3] border border-[#E7E1D8] focus:border-[#A8678A] focus:outline-none rounded-xl text-sm text-[#1F1F1F] font-semibold"
                >
                  <option value="beauty">Beauty</option>
                  <option value="lifestyle">Lifestyle</option>
                  <option value="tech">Tech</option>
                  <option value="fitness">Fitness</option>
                  <option value="food">Food</option>
                  <option value="travel">Travel</option>
                  <option value="gaming">Gaming</option>
                  <option value="finance">Finance</option>
                  <option value="education">Education</option>
                  <option value="fashion">Fashion</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6 border-t border-[#E7E1D8] pt-4 justify-end">
              <button 
                type="button" 
                onClick={() => { setShowUploadModal(false); setPendingFile(null); }}
                className="px-5 py-2.5 rounded-xl border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmUpload}
                className="px-5 py-2.5 rounded-xl bg-[#1F1F1F] text-white hover:opacity-90 text-sm font-semibold transition-colors"
              >
                Publish to Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1F1F] text-white font-bold px-6 py-3.5 rounded-2xl shadow-card flex items-center gap-2.5 animate-bounce">
          <span>🎉</span>
          {toastMessage}
        </div>
      )}

      {/* ── UPLOADING SPINNER OVERLAY ── */}
      {isUploading && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-bold text-sm">Uploading and saving your portfolio item...</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-[#E7E1D8] rounded-2xl p-5">
      <p className="text-sm text-[#6E6A65]">{title}</p>
      <p className="text-2xl font-bold text-[#1F1F1F] mt-1">{value}</p>
    </div>
  );
}