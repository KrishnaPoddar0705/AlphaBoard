import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeContext'
import { SearchProvider } from './contexts/SearchContext'
import { validateCurrentOrigin } from './config/allowedOrigins'
import ErrorBoundary from './components/ErrorBoundary'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Clerk Publishable Key: VITE_CLERK_PUBLISHABLE_KEY was not set at ' +
    'build time. Vite inlines VITE_* variables during `npm run build`, so it ' +
    'must exist in the build environment (Cloudflare Pages > Settings > ' +
    'Environment variables) before the build runs, and the site must be ' +
    'redeployed afterwards.'
  )
}

// A publishable key starts with pk_. A key starting with sk_ is the SECRET key,
// which authenticates against the Clerk Backend API: it can list every user
// with their email, create and delete users, and mint sessions for any account.
//
// This is not hypothetical — VITE_CLERK_PUBLISHABLE_KEY was once set to an
// sk_live_ value, and because Vite inlines these variables into the JS bundle,
// the production secret key was served publicly to every visitor until it was
// rotated. Clerk itself rejects the key (throwInvalidPublishableKeyError), but
// only after the bundle has already shipped and been downloaded.
//
// Fail the build-time-configured value loudly instead, and never interpolate
// the key into the message.
if (PUBLISHABLE_KEY.startsWith('sk_')) {
  throw new Error(
    'VITE_CLERK_PUBLISHABLE_KEY is set to a Clerk SECRET key (sk_...). ' +
    'Secret keys must never reach the frontend — Vite inlines this value into ' +
    'the public JS bundle. Rotate that key in the Clerk dashboard immediately, ' +
    'then set VITE_CLERK_PUBLISHABLE_KEY to the publishable key (pk_...).'
  )
}

if (!PUBLISHABLE_KEY.startsWith('pk_')) {
  throw new Error(
    'VITE_CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key ' +
    '(expected it to start with "pk_").'
  )
}

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Validate origin in development
if (import.meta.env.DEV) {
  validateCurrentOrigin()
}

// Handle server 404 errors - check if we're on a 404 page before React loads
const checkFor404 = () => {
  // Check if document body contains "Not Found" text (server 404 page)
  if (document.body && document.body.innerText) {
    const bodyText = document.body.innerText.toLowerCase();
    const is404Page = bodyText.includes('not found') &&
      !document.getElementById('root')?.hasChildNodes();

    if (is404Page) {
      // Redirect to index.html so React Router can handle it
      const currentPath = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;

      // Only redirect if we're not already on index.html
      if (currentPath !== '/index.html' && currentPath !== '/') {
        window.location.replace('/index.html' + search + hash);
        return true;
      }
    }
  }
  return false;
};

// Run check before React renders
if (!checkFor404()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            afterSignOutUrl="/"
            afterSignInUrl="/"
            afterSignUpUrl="/"
          >
            <ThemeProvider>
              <SearchProvider>
                <App />
              </SearchProvider>
            </ThemeProvider>
          </ClerkProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}
