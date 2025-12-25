import { useNavigate } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

/**
 * NotFound Page
 * 
 * Displays a user-friendly 404 error page when a route is not found.
 * Provides a button to navigate back to the homepage.
 */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold text-[var(--text-primary)] mb-4">404</h1>
        
        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
          Page Not Found
        </h2>
        
        <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. 
          Let's get you back on track.
        </p>
        
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
        >
          <Home className="w-5 h-5" />
          Go to Homepage
        </button>
      </div>
    </div>
  );
}

