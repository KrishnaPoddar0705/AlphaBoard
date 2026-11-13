import { useState, useRef } from 'react';
import { Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SectorDropdown from '../ui/SectorDropdown';
import TickerInput from '../ui/TickerInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

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

      await response.json();

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && !uploading && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Research Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer transition-all ${
              file
                ? 'border-positive bg-positive/5'
                : 'border-border-editorial hover:border-link hover:bg-link/5'
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
                <FileText className="w-6 h-6 md:w-8 md:h-8 text-positive" />
                <div className="text-left">
                  <p className="text-ink font-medium text-sm md:text-base">{file.name}</p>
                  <p className="text-xs md:text-sm text-ink-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 md:w-12 md:h-12 text-ink-muted mx-auto mb-3" />
                <p className="text-ink font-medium mb-1 text-sm md:text-base">
                  Drop your PDF here or click to browse
                </p>
                <p className="text-xs md:text-sm text-ink-muted">Maximum file size: 50MB</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-ink">
              Report Title *
            </Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Goldman Sachs Metals & Mining Q4 2024"
              disabled={uploading}
            />
          </div>

          {/* Sector */}
          <div className="space-y-2">
            <Label className="text-ink">Sector</Label>
            <SectorDropdown
              value={sector}
              onChange={setSector}
              options={SECTORS}
              disabled={uploading}
              placeholder="Select sector..."
            />
          </div>

          {/* Tickers */}
          <div className="space-y-2">
            <Label className="text-ink">Tickers</Label>
            <TickerInput
              value={tickers}
              onChange={setTickers}
              disabled={uploading}
              placeholder="e.g., AAPL, MSFT, GOOGL"
            />
            <p className="text-xs text-ink-muted">
              Enter ticker symbols separated by commas or search
            </p>
          </div>

          {/* Status */}
          {uploadStatus && (
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              uploading
                ? 'bg-link/10 border-link/20'
                : 'bg-positive/10 border-positive/20'
            }`}>
              {uploading ? (
                <Loader2 className="w-5 h-5 text-link animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5 text-positive" />
              )}
              <p className="text-sm text-ink font-medium">{uploadStatus}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-negative/10 border border-negative/20 rounded-lg">
              <p className="text-sm text-negative font-medium">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
            className="text-ink border-border-editorial hover:bg-paper-light"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Uploading...</span>
                <span className="sm:hidden">Uploading</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload Report</span>
                <span className="sm:hidden">Upload</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

