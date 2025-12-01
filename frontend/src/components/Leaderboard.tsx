import React from 'react';
import { leaderboardData } from '../data/mockData';

const Leaderboard = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-8 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-20 w-96 h-96 bg-indigo-500/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>

      {/* Main Container */}
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-8 relative z-10 text-white">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 mb-2">
            Alpha Performers
          </h1>
          <p className="text-blue-200/60 font-light">Top performing employees by Absolute Alpha</p>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 text-sm font-medium text-blue-200/50 uppercase tracking-wider border-b border-white/10">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-5">Employee</div>
          <div className="col-span-3 text-right">Role</div>
          <div className="col-span-3 text-right">Absolute Alpha</div>
        </div>

        {/* Rows */}
        <div className="space-y-3 mt-4">
          {leaderboardData.map((employee, index) => (
            <div 
              key={employee.id}
              className="glass-card rounded-2xl p-4 grid grid-cols-12 gap-4 items-center group cursor-pointer"
            >
              {/* Rank */}
              <div className="col-span-1 flex justify-center">
                <div className={`
                  w-8 h-8 flex items-center justify-center rounded-full font-bold
                  ${index === 0 ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 
                    index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                    index === 2 ? 'bg-orange-400/20 text-orange-300 border border-orange-400/30' :
                    'text-white/60'}
                `}>
                  {index + 1}
                </div>
              </div>

              {/* Employee Info */}
              <div className="col-span-5 flex items-center gap-4">
                <img 
                  src={employee.avatar} 
                  alt={employee.name}
                  className="w-10 h-10 rounded-full border border-white/20 bg-white/5"
                />
                <div>
                  <h3 className="font-semibold text-white group-hover:text-blue-200 transition-colors">
                    {employee.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span className={`
                      ${employee.trend === 'up' ? 'text-green-400' : 
                        employee.trend === 'down' ? 'text-red-400' : 'text-gray-400'}
                    `}>
                      {employee.trend === 'up' && '↑'} 
                      {employee.trend === 'down' && '↓'} 
                      {employee.trend === 'same' && '−'} 
                    </span>
                    <span>vs last month</span>
                  </div>
                </div>
              </div>

              {/* Role */}
              <div className="col-span-3 text-right text-sm text-white/60">
                {employee.role}
              </div>

              {/* Alpha Score */}
              <div className="col-span-3 text-right">
                <div className="font-mono font-bold text-xl text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                  {employee.alpha > 0 ? '+' : ''}{employee.alpha}%
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Leaderboard;

