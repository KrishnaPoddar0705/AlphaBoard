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
  throw new Error('Missing Clerk Publishable Key')
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
