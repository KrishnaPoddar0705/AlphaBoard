import { useState, useEffect } from 'react';
import { getTeamJoinRequests, approveTeamJoinRequest, rejectTeamJoinRequest } from '../../lib/edgeFunctions';
import { Check, X, Clock, Users } from 'lucide-react';

interface TeamJoinRequest {
  id: string;
  teamId: string;
  teamName: string;
  userId: string;
  username: string;
  email: string | null;
  requestedAt: string;
}

interface TeamJoinRequestsProps {
  orgId: string;
  onRequestProcessed?: () => void;
}

export default function TeamJoinRequests({ orgId, onRequestProcessed }: TeamJoinRequestsProps) {
  const [requests, setRequests] = useState<TeamJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      fetchRequests();
    }
  }, [orgId]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTeamJoinRequests(orgId);
      setRequests(response.requests || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch join requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setProcessingId(requestId);
      await approveTeamJoinRequest(requestId);
      await fetchRequests();
      onRequestProcessed?.();
    } catch (err: any) {
      alert(err.message || 'Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this join request?')) {
      return;
    }

    try {
      setProcessingId(requestId);
      await rejectTeamJoinRequest(requestId);
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-gray-400 text-center py-4">Loading join requests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-red-600 text-center py-4">{error}</div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No pending join requests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">Pending Join Requests</h2>
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
            {requests.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-gray-900">{request.username}</span>
                  <span className="text-sm text-gray-500">wants to join</span>
                  <span className="font-semibold text-blue-600">{request.teamName}</span>
                </div>
                {request.email && (
                  <div className="text-sm text-gray-500 ml-6">{request.email}</div>
                )}
                <div className="text-xs text-gray-400 ml-6 mt-1">
                  Requested {new Date(request.requestedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(request.id)}
                  disabled={processingId === request.id}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}




