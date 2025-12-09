import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTeam: (name: string) => Promise<void>;
  orgId: string;
}

export default function CreateTeamModal({ isOpen, onClose, onCreateTeam, orgId }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    setLoading(true);
    try {
      await onCreateTeam(teamName.trim());
      setTeamName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
            disabled={loading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-2">
              Team Name
            </label>
            <input
              id="teamName"
              type="text"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setError(null);
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors text-gray-900 placeholder:text-gray-400 bg-white ${
                error 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="Enter team name"
              disabled={loading}
              autoFocus
              maxLength={50}
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
            {teamName.length > 0 && !error && (
              <p className="mt-1 text-xs text-gray-500">{teamName.length}/50 characters</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading || !teamName.trim()}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Creating...
                </>
              ) : (
                'Create Team'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

