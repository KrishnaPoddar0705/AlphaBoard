import { SignedIn, SignedOut, SignUp, UserButton, useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isLoaded && user) {
      navigate('/');
    }
  }, [user, isLoaded, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <SignedOut>
          <SignUp
            // Force same-tab redirect flow on mobile to avoid popup/new-tab behavior.
            oauthFlow={isMobile ? 'redirect' : 'auto'}
            routing="path"
            path="/sign-up"
            signInUrl="/login"
            fallbackRedirectUrl="/"
          />
        </SignedOut>

        <SignedIn>
          <div className="text-center space-y-4">
            <p className="text-[var(--text-secondary)]">You are signed in!</p>
            <UserButton />
            <button
              onClick={() => navigate('/')}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Dashboard
            </button>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}

