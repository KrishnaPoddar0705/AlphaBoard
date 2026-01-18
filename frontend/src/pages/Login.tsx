import { SignedIn, SignedOut, SignIn, UserButton, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Login() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const isMobile = useIsMobile();

  // Redirect to home if user is already signed in
  useEffect(() => {
    if (isLoaded && user) {
      navigate('/');
    }
  }, [user, isLoaded, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-primary)]">
            Welcome to AlphaBoard
          </h2>
          <p className="mt-2 text-center text-sm text-[var(--text-secondary)]">
            Sign in or create an account to get started
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <SignedOut>
            <SignIn
              // Force same-tab redirect flow on mobile to avoid popup/new-tab behavior.
              oauthFlow={isMobile ? 'redirect' : 'auto'}
              routing="path"
              path="/login"
              signUpUrl="/sign-up"
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
    </div>
  );
}

