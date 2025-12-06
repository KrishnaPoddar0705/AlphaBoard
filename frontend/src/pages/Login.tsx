import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Login() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();

  // Redirect to home if user is already signed in
  useEffect(() => {
    if (isLoaded && user) {
      navigate('/');
    }
  }, [user, isLoaded, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to AlphaBoard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in or create an account to get started
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <SignedOut>
            <div className="space-y-3">
              <SignInButton mode="modal">
                <button className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Sign In
                </button>
              </SignInButton>
              
              <SignUpButton mode="modal">
                <button className="group relative w-full flex justify-center py-3 px-4 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="text-center space-y-4">
              <p className="text-gray-600">You are signed in!</p>
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

