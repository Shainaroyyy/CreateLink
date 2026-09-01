import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email') ?? '';
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuthStore();

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (token) {
      const performVerification = async () => {
        setStatus('verifying');
        try {
          await verifyEmail(token, email || undefined);
          setStatus('success');
          // Automatically redirect after a short latency to the onboarding page
          setTimeout(() => {
            navigate('/feed');
          }, 3000);
        } catch (err) {
          setStatus('error');
          setErrorMessage((err as Error).message || 'Verification failed. The link might be expired or invalid.');
        }
      };
      performVerification();
    }
  }, [token, verifyEmail, navigate]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendStatus('sending');
    try {
      await resendVerification(resendEmail);
      setResendStatus('success');
    } catch (err) {
      setResendStatus('error');
      setErrorMessage((err as Error).message || 'Failed to resend verification email.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F2E8] px-4">
      <div className="max-w-md w-full bg-white border border-[#E7E1D8] rounded-[20px] p-8 shadow-card relative overflow-hidden">
        {/* Glow effect removed */}

        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#F8EFF3] flex items-center justify-center border border-[#E7E1D8] text-[#A8678A]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>

          {token ? (
            <div>
              {status === 'verifying' && (
                <div>
                  <h2 className="text-2xl font-bold mb-3 text-[#1F1F1F]">Verifying Email Address</h2>
                  <p className="text-[#6E6A65] mb-6">Please wait while we secure your account details...</p>
                  <div className="w-8 h-8 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              )}

              {status === 'success' && (
                <div>
                  <h2 className="text-2xl font-bold text-[#1F1F1F] mb-3">Email Verified!</h2>
                  <p className="text-[#6E6A65] mb-6">Your account is now active. Redirecting you to the workspace...</p>
                  <div className="w-12 h-12 bg-[#F8EFF3] border border-[#E7E1D8] rounded-full flex items-center justify-center text-[#A8678A] mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div>
                  <h2 className="text-2xl font-bold text-[#1F1F1F] mb-3">Verification Failed</h2>
                  <p className="text-[#A8678A] mb-6">{errorMessage}</p>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-2.5 rounded-xl bg-[#1F1F1F] text-white hover:opacity-90 font-semibold transition-all duration-200"
                  >
                    Return to Login
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-3 text-[#1F1F1F]">Verify Your Email</h2>
              <p className="text-[#6E6A65] mb-6">
                We've sent a verification link to your email. Click it to activate your account and start your journey.
              </p>

              {resendStatus === 'idle' && (
                <form onSubmit={handleResend} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Enter email to resend link"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-3 text-[#1F1F1F] placeholder-[#6E6A65] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A]"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#1F1F1F] text-white font-bold hover:opacity-90 shadow-soft transition-all duration-200"
                  >
                    Resend Verification Link
                  </button>
                </form>
              )}

              {resendStatus === 'sending' && (
                <div className="py-4 text-[#6E6A65]">
                  <div className="w-6 h-6 border-2 border-[#A8678A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Sending...
                </div>
              )}

              {resendStatus === 'success' && (
                <div>
                  <p className="text-[#A8678A] font-semibold mb-4">Verification link sent successfully!</p>
                  <button
                    onClick={() => setResendStatus('idle')}
                    className="w-full py-2.5 rounded-xl bg-white border border-[#E7E1D8] hover:bg-[#F8EFF3] text-[#1F1F1F] font-semibold transition-all duration-200"
                  >
                    Resend Again
                  </button>
                </div>
              )}

              {resendStatus === 'error' && (
                <div>
                  <p className="text-[#A8678A] mb-4">{errorMessage}</p>
                  <button
                    onClick={() => setResendStatus('idle')}
                    className="w-full py-2.5 rounded-xl bg-white border border-[#E7E1D8] hover:bg-[#F8EFF3] text-[#1F1F1F] font-semibold transition-all duration-200"
                  >
                    Try Again
                  </button>
                </div>
              )}

              <p className="text-xs text-[#6E6A65] mt-6">
                Already verified?{' '}
                <button onClick={() => navigate('/login')} className="text-[#A8678A] hover:underline">
                  Log in here
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
