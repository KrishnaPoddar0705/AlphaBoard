import { useState, useRef } from 'react';
import { X, Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SectorDropdown from '../ui/SectorDropdown';
import TickerInput from '../ui/TickerInput';

interface UploadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Energy',
  'Consumer Discretionary',
  'Consumer Staples',
  'Industrials',
  'Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
  'Metals & Mining',
  'IT Services',
  'Automotive',
  'Defense',
  'Logistics'
];

export default function UploadReportModal({ isOpen, onClose, onSuccess }: UploadReportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [sector, setSector] = useState('');
  const [tickers, setTickers] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    setFile(selectedFile);
    setError('');

    // Auto-populate title from filename if empty
    if (!title) {
      const filename = selectedFile.name.replace('.pdf', '');
      setTitle(filename);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setUploading(true);
    setError('');
    setUploadStatus('Uploading file...');

    try {
      // Get Supabase session (synced from Clerk authentication)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error('Not authenticated. Please log in first.');
      }


      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('sector', sector);
      formData.append('tickers', tickers.join(','));

      // Upload to Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const uploadUrl = `${supabaseUrl}/functions/v1/upload-research-report`;

      setUploadStatus('Uploading to server...');

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.details || `Upload failed (${response.status})`);
      }

      const result = await response.json();

      setUploadStatus('File uploaded! Indexing and parsing...');


      // Wait a moment to show success message
      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
        onSuccess();
        handleClose();
      }, 2000);

    } catch (err: any) {
      const { getUserFriendlyError } = await import('../../lib/errorSanitizer');
      setError(getUserFriendlyError(err));
      setUploading(false);
      setUploadStatus('');
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setTitle('');
      setSector('');
      setTickers([]);
      setError('');
      setUploadStatus('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-xl border border-white/10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Upload Research Report</h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${file
              ? 'border-green-500/50 bg-green-500/10'
              : 'border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
              disabled={uploading}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-green-400" />
                <div className="text-left">
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-sm text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">
                  Drop your PDF here or click to browse
                </p>
                <p className="text-sm text-gray-400">Maximum file size: 50MB</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Report Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Goldman Sachs Metals & Mining Q4 2024"
              disabled={uploading}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sector
            </label>
            <SectorDropdown
              value={sector}
              onChange={setSector}
              options={SECTORS}
              disabled={uploading}
              placeholder="Select sector..."
            />
          </div>

          {/* Tickers */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tickers
            </label>
            <TickerInput
              value={tickers}
              onChange={setTickers}
              disabled={uploading}
              placeholder="e.g., AAPL, MSFT, GOOGL"
            />
          </div>

          {/* Status */}
          {uploadStatus && (
            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              {uploading ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
              <p className="text-sm text-white">{uploadStatus}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

