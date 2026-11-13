import { SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';

export default function InlineLogin() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center bg-paper py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold font-mono text-ink">
            Welcome to AlphaBoard
          </h2>
          <p className="mt-2 text-center text-sm font-mono text-ink-muted">
            Sign in or create an account to get started
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <SignedOut>
            <div className="space-y-3">
              {isMobile ? (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-paper-light bg-ink hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink font-mono transition-colors"
                  >
                    Sign In
                  </button>

                  <button
                    onClick={() => navigate('/sign-up')}
                    className="group relative w-full flex justify-center py-3 px-4 border border-ink text-sm font-medium rounded-lg text-ink bg-paper-light hover:bg-paper-alt focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink font-mono transition-colors"
                  >
                    Create Account
                  </button>
                </>
              ) : (
                <>
                  <SignInButton mode="modal">
                    <button className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-paper-light bg-ink hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink font-mono transition-colors">
                      Sign In
                    </button>
                  </SignInButton>

                  <SignUpButton mode="modal">
                    <button className="group relative w-full flex justify-center py-3 px-4 border border-ink text-sm font-medium rounded-lg text-ink bg-paper-light hover:bg-paper-alt focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink font-mono transition-colors">
                      Create Account
                    </button>
                  </SignUpButton>
                </>
              )}
            </div>
          </SignedOut>
        </div>
      </div>
    </div>
  );
}

