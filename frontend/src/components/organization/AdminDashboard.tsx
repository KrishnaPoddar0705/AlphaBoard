import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { getOrganizationUsers, getOrganizationPerformance } from '../../lib/edgeFunctions';
import { Users, TrendingUp, BarChart3, ArrowRight, Trash2, ChevronDown, ChevronUp, FileText, Target, ImageIcon } from 'lucide-react';

interface OrganizationUser {
  userId: string;
  username: string | null;
  email: string | null;
  role: 'admin' | 'analyst';
  joinedAt: string;
}

interface Recommendation {
  id: string;
  ticker: string;
  position: string;
  entry_price: number;
  thesis: string;
  created_at: string;
  screenshots?: string[];
}

interface PriceTarget {
  id: string;
  ticker: string;
  target_price: number;
  target_date: string | null;
  created_at: string;
}

interface AnalystPerformance {
  userId: string;
  username: string | null;
  returns: {
    '1M': number;
    '3M': number;
    '6M': number;
    '12M': number;
  };
  sharpe: number;
  volatility: number;
  drawdown: number;
  totalRecommendations: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
}

export default function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [performance, setPerformance] = useState<AnalystPerformance[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [expandedAnalyst, setExpandedAnalyst] = useState<string | null>(null);
  const [analystRecommendations, setAnalystRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [analystPriceTargets, setAnalystPriceTargets] = useState<Record<string, PriceTarget[]>>({});

  useEffect(() => {
    if (session?.user?.id) {
      fetchOrganizationData();
    } else {
      setLoading(false);
      setError('You must be logged in to access this page');
    }
  }, [session]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's organization membership
      const { data: membership, error: membershipError } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', session!.user!.id)
        .single();

      if (membershipError || !membership) {
        console.error('Membership error:', membershipError);
        setError('You are not a member of any organization');
        setLoading(false);
        return;
      }

      if (membership.role !== 'admin') {
        setError('Only organization admins can access this page');
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      const org = membership.organizations as any;
      const orgId = membership.organization_id;
      setOrganizationId(orgId);
      setOrganizationName(org?.name || 'Unknown Organization');

      console.log('Fetching data for organization:', orgId);

      // Fetch organization details to get join code
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('join_code')
        .eq('id', orgId)
        .single();

      if (!orgError && orgData) {
        setJoinCode(orgData.join_code);
        console.log('Join code fetched');
      } else {
        console.error('Error fetching join code:', orgError);
      }

      // Fetch all members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('user_organization_membership')
        .select('user_id, role, joined_at')
        .eq('organization_id', orgId);

      console.log('Members data:', membersData, 'Error:', membersError);

      if (membersError) {
        console.error('Error fetching members:', membersError);
      }

      if (membersData && membersData.length > 0) {
        // Fetch profiles for all members separately with email
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', membersData.map((m: any) => m.user_id));

        console.log('Profiles data:', profilesData, 'Error:', profilesError);

        const profilesMap = new Map();
        const emailsMap = new Map();
        
        profilesData?.forEach((p: any) => {
          profilesMap.set(p.id, p.username);
          emailsMap.set(p.id, p.email);
        });

        const usersList = membersData.map((m: any) => ({
          userId: m.user_id,
          username: profilesMap.get(m.user_id) || 'Unknown User',
          email: emailsMap.get(m.user_id) || 'No email on record',
          role: m.role,
          joinedAt: m.joined_at,
        }));

        console.log('Final users list:', usersList);
        setUsers(usersList);

        // Fetch performance data for all members
        if (membersData.length > 0) {
          const { data: perfData, error: perfError } = await supabase
            .from('performance')
            .select('user_id, total_ideas, win_rate, total_return_pct, alpha_pct')
            .in('user_id', membersData.map((m: any) => m.user_id));

          console.log('Performance data:', perfData, 'Error:', perfError);

          // Create performance list for ALL members, even if no performance data yet
          const performanceList = membersData.map((m: any) => {
            const perf = perfData?.find((p: any) => p.user_id === m.user_id);
            return {
              userId: m.user_id,
              username: profilesMap.get(m.user_id) || 'Unknown',
              returns: {
                '1M': perf?.total_return_pct || 0,
                '3M': perf?.total_return_pct || 0,
                '6M': perf?.total_return_pct || 0,
                '12M': perf?.total_return_pct || 0,
              },
              sharpe: 0,
              volatility: 0,
              drawdown: 0,
              totalRecommendations: perf?.total_ideas || 0,
              openPositions: 0,
              closedPositions: 0,
              winRate: perf?.win_rate || 0,
            };
          });
          setPerformance(performanceList);
        }
      } else {
        console.log('No members found or empty result');
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Error in fetchOrganizationData:', err);
      setError(err.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const handleRemoveUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from the organization?`)) {
      return;
    }

    try {
      // Delete the user's membership
      const { error } = await supabase
        .from('user_organization_membership')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error removing user:', error);
        alert('Failed to remove user: ' + error.message);
        return;
      }

      // Update profiles to remove organization_id
      await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', userId);

      // Refresh the data
      alert(`${username} has been removed from the organization`);
      fetchOrganizationData();
    } catch (err: any) {
      console.error('Error removing user:', err);
      alert('Failed to remove user: ' + err.message);
    }
  };

  const toggleAnalystDetails = async (userId: string) => {
    if (expandedAnalyst === userId) {
      setExpandedAnalyst(null);
      return;
    }

    setExpandedAnalyst(userId);

    // Fetch recommendations and price targets if not already loaded
    if (!analystRecommendations[userId]) {
      try {
        console.log('Fetching recommendations for user:', userId, 'in organization:', organizationId);
        
        // Fetch recommendations with all details
        // Don't filter by organization_id - fetch all recommendations for this user
        const { data: recs, error: recsError } = await supabase
          .from('recommendations')
          .select('id, ticker, action, entry_price, exit_price, status, thesis, entry_date, images, final_return_pct, final_alpha_pct')
          .eq('user_id', userId)
          .order('entry_date', { ascending: false });

        console.log('Recommendations for user:', userId, 'Count:', recs?.length, 'Data:', recs, 'Error:', recsError);

        if (!recsError && recs) {
          setAnalystRecommendations(prev => ({ ...prev, [userId]: recs }));
        } else {
          // Set empty array even if error to prevent retrying
          setAnalystRecommendations(prev => ({ ...prev, [userId]: [] }));
        }

        // Fetch all price targets for this user
        const { data: targets, error: targetsError } = await supabase
          .from('price_targets')
          .select('id, ticker, target_price, target_date, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        console.log('Price targets for user:', userId, 'Count:', targets?.length, 'Error:', targetsError);

        if (!targetsError && targets) {
          setAnalystPriceTargets(prev => ({ ...prev, [userId]: targets }));
        } else {
          setAnalystPriceTargets(prev => ({ ...prev, [userId]: [] }));
        }
      } catch (err) {
        console.error('Error fetching analyst details:', err);
        // Set empty arrays to prevent retrying
        setAnalystRecommendations(prev => ({ ...prev, [userId]: [] }));
        setAnalystPriceTargets(prev => ({ ...prev, [userId]: [] }));
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading organization data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mb-4">{organizationName}</p>
          
          {/* Join Code Section */}
          {joinCode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Organization Join Code</p>
                  <p className="text-xs text-blue-700 mb-2">
                    Share this code with analysts to join your organization
                  </p>
                  {showJoinCode ? (
                    <code className="text-lg font-mono font-bold text-blue-600 bg-white px-3 py-2 rounded border border-blue-300">
                      {joinCode}
                    </code>
                  ) : (
                    <button
                      onClick={() => setShowJoinCode(true)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
                    >
                      Click to reveal join code
                    </button>
                  )}
                </div>
                {showJoinCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(joinCode);
                      alert('Join code copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Copy Code
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Analysts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'analyst').length}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg 12M Return</p>
                <p className="text-2xl font-bold text-gray-900">
                  {performance.length > 0
                    ? formatPercent(
                        performance.reduce((sum, p) => sum + p.returns['12M'], 0) /
                          performance.length
                      )
                    : 'N/A'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Analyst Performance Table */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Analyst Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                    
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Analyst
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Ideas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    12M Return
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sharpe
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {performance.map((analyst) => (
                  <React.Fragment key={analyst.userId}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleAnalystDetails(analyst.userId)}>
                      <td className="px-6 py-4">
                        {expandedAnalyst === analyst.userId ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {analyst.username || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {analyst.totalRecommendations}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {analyst.winRate.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${
                            analyst.returns['12M'] >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatPercent(analyst.returns['12M'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {analyst.sharpe ? analyst.sharpe.toFixed(2) : 'N/A'}
                        </div>
                      </td>
                    </tr>
                    {expandedAnalyst === analyst.userId && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-6">
                            {/* All Recommendations with Details */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                                <FileText className="w-5 h-5" />
                                All Recommendations ({analystRecommendations[analyst.userId]?.length || 0})
                              </h4>
                              
                              {analystRecommendations[analyst.userId]?.length > 0 ? (
                                <div className="space-y-4">
                                  {analystRecommendations[analyst.userId].map((rec) => {
                                    // Get price targets for this ticker
                                    const tickerTargets = analystPriceTargets[analyst.userId]?.filter(
                                      t => t.ticker === rec.ticker
                                    ) || [];
                                    
                                    return (
                                      <div key={rec.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                                        {/* Recommendation Header */}
                                        <div className="flex justify-between items-start mb-4">
                                          <div className="flex items-center gap-3">
                                            <span className="text-xl font-bold text-blue-600">{rec.ticker}</span>
                                            <span className={`px-3 py-1 text-sm font-semibold rounded ${
                                              rec.action === 'BUY' 
                                                ? 'bg-green-100 text-green-800 border border-green-300' 
                                                : 'bg-red-100 text-red-800 border border-red-300'
                                            }`}>
                                              {rec.action || 'BUY'}
                                            </span>
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                                              rec.status === 'OPEN' 
                                                ? 'bg-blue-100 text-blue-800' 
                                                : 'bg-gray-100 text-gray-800'
                                            }`}>
                                              {rec.status || 'OPEN'}
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-xs text-gray-500">Entry Date</div>
                                            <div className="text-sm font-medium text-gray-700">{formatDate(rec.entry_date)}</div>
                                          </div>
                                        </div>

                                        {/* Price Information */}
                                        <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded">
                                          <div>
                                            <div className="text-xs text-gray-600 mb-1">Entry Price</div>
                                            <div className="text-lg font-semibold text-gray-900">${rec.entry_price}</div>
                                          </div>
                                          {rec.exit_price && (
                                            <div>
                                              <div className="text-xs text-gray-600 mb-1">Exit Price</div>
                                              <div className="text-lg font-semibold text-gray-900">${rec.exit_price}</div>
                                            </div>
                                          )}
                                          {tickerTargets.length > 0 && (
                                            <div>
                                              <div className="text-xs text-gray-600 mb-1">Price Targets</div>
                                              <div className="flex gap-2 flex-wrap">
                                                {tickerTargets.map(t => (
                                                  <span key={t.id} className="text-sm font-semibold text-purple-600">
                                                    ${t.target_price}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Thesis */}
                                        {rec.thesis && (
                                          <div className="mb-4">
                                            <div className="text-sm font-semibold text-gray-700 mb-2">Investment Thesis:</div>
                                            <div className="text-sm text-gray-800 bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                                              {rec.thesis}
                                            </div>
                                          </div>
                                        )}

                                        {/* Price Target Timeline */}
                                        {tickerTargets.length > 0 && (
                                          <div className="mb-4">
                                            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                              <Target className="w-4 h-4" />
                                              Price Target Timeline:
                                            </div>
                                            <div className="flex gap-3 overflow-x-auto pb-2">
                                              {tickerTargets.map(target => (
                                                <div key={target.id} className="bg-purple-50 p-3 rounded border border-purple-200 min-w-[150px]">
                                                  <div className="text-lg font-bold text-purple-700">${target.target_price}</div>
                                                  {target.target_date && (
                                                    <div className="text-xs text-gray-600 mt-1">
                                                      Target: {formatDate(target.target_date)}
                                                    </div>
                                                  )}
                                                  <div className="text-xs text-gray-500 mt-1">
                                                    Set: {formatDate(target.created_at)}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Screenshots/Images */}
                                        {rec.images && rec.images.length > 0 && (
                                          <div>
                                            <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                              <ImageIcon className="w-4 h-4" />
                                              Attachments ({rec.images.length}):
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                              {rec.images.map((image, idx) => (
                                                <div key={idx} className="relative w-32 h-32 bg-gray-100 rounded border border-gray-300 overflow-hidden hover:opacity-90 cursor-pointer">
                                                  <img 
                                                    src={image} 
                                                    alt={`Attachment ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                    onClick={() => window.open(image, '_blank')}
                                                  />
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500 bg-white rounded border border-gray-200">
                                  No recommendations yet
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {performance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No analyst performance data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Organization Members</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">
                        {user.username || 'Unknown User'}
                      </div>
                      {user.role === 'admin' && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {user.email || 'No email'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Joined {formatDate(user.joinedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.userId !== session?.user?.id && (
                      <button
                        onClick={() => handleRemoveUser(user.userId, user.username || 'this user')}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm flex items-center gap-1 border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

