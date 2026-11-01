import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  url: string;
  children: ReactNode;
}

/**
 * Keeps a viewer failure (a chunk that would not load, a PDF.js error) inside the preview pane
 * instead of the app-wide error page, and still offers the file.
 */
export default class PdfErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PdfViewer] preview failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="p-6 text-sm text-[#1C1B17]">
        <p>The preview could not be shown here.</p>
        <a href={this.props.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[#1D4ED8] underline">Open the PDF in a new tab</a>
      </div>
    );
  }
}
