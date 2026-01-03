import { SignedOut, SignInButton, SignUpButton } from '@clerk/clerk-react';

export default function InlineLogin() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#F1EEE0] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold font-mono text-[#1C1B17]">
            Welcome to AlphaBoard
          </h2>
          <p className="mt-2 text-center text-sm font-mono text-[#6F6A60]">
            Sign in or create an account to get started
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <SignedOut>
            <div className="space-y-3">
              <SignInButton mode="modal">
                <button className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-[#F7F2E6] bg-[#1C1B17] hover:bg-[#1C1B17]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C1B17] font-mono transition-colors">
                  Sign In
                </button>
              </SignInButton>
              
              <SignUpButton mode="modal">
                <button className="group relative w-full flex justify-center py-3 px-4 border border-[#1C1B17] text-sm font-medium rounded-lg text-[#1C1B17] bg-[#F7F2E6] hover:bg-[#FBF7ED] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1C1B17] font-mono transition-colors">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </div>
      </div>
    </div>
  );
}

