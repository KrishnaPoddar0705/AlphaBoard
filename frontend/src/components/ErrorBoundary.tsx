import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Home, AlertCircle } from 'lucide-react';
import { getUserFriendlyError } from '../lib/errorSanitizer';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // If it's a 404 error from the server, try to redirect
        if (error.message.includes('404') || error.message.includes('Not Found')) {
            // Let React Router handle it
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
                    <div className="max-w-md w-full text-center">
                        <div className="mb-8 flex justify-center">
                            <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                <AlertCircle className="w-12 h-12 text-indigo-400" />
                            </div>
                        </div>

                        <h1 className="text-6xl font-bold text-[var(--text-primary)] mb-4">Error</h1>

                        <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-3">
                            Something went wrong
                        </h2>

                        <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
                            {this.state.error ? getUserFriendlyError(this.state.error) : 'An unexpected error occurred.'}
                        </p>

                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.href = '/';
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
                        >
                            <Home className="w-5 h-5" />
                            Go to Homepage
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Wrapper component to use hooks
export default function ErrorBoundary({ children }: Props) {
    return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}

