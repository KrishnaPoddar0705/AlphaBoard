import React, { useState } from 'react';
import { Sparkles, Download, RefreshCw, TrendingUp, TrendingDown, Scale, AlertTriangle, Zap, Loader } from 'lucide-react';
import { generateThesis } from '../lib/api';
import jsPDF from 'jspdf';

interface ThesisData {
  ticker: string;
  generated_at: string;
  bull_case: string;
  bear_case: string;
  base_case: string;
  risks: string[];
  catalysts: string[];
  data_summary: {
    current_price: number;
    market_cap: number;
    pe_ratio: number;
    price_change_1y_pct: number;
  };
}

interface AIInvestmentThesisProps {
  ticker: string;
  companyName?: string;
}

export default function AIInvestmentThesis({ ticker, companyName }: AIInvestmentThesisProps) {
  const [thesis, setThesis] = useState<ThesisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateThesis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateThesis(ticker);
      setThesis(data);
    } catch (err: any) {
      console.error('Failed to generate thesis:', err);
      setError(err.response?.data?.detail || 'Failed to generate investment thesis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!thesis) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const lineHeight = 7;
    let yPosition = 20;

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, fontSize: number = 11, fontStyle: string = 'normal', maxWidth?: number) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, maxWidth || pageWidth - 2 * margin);
      doc.text(lines, x, yPosition);
      yPosition += lines.length * lineHeight;
    };

    // Add header
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    addText('AI-Generated Investment Thesis', margin, 18, 'bold');
    yPosition = 30;
    addText(`${ticker}${companyName ? ' - ' + companyName : ''}`, margin, 12);
    
    yPosition = 50;
    doc.setTextColor(0, 0, 0);

    // Add generated date
    addText(`Generated: ${new Date(thesis.generated_at).toLocaleString()}`, margin, 9, 'normal');
    yPosition += 5;

    // Add data summary if available
    if (thesis.data_summary) {
      const summary = thesis.data_summary;
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 25, 'F');
      yPosition += 7;
      doc.setFontSize(9);
      doc.text(`Current Price: ₹${summary.current_price?.toFixed(2) || 'N/A'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`P/E Ratio: ${summary.pe_ratio?.toFixed(2) || 'N/A'}`, margin + 5, yPosition);
      yPosition += 6;
      doc.text(`1Y Return: ${summary.price_change_1y_pct?.toFixed(2) || 'N/A'}%`, margin + 5, yPosition);
      yPosition += 12;
    }

    // Bull Case
    doc.setFillColor(220, 252, 231); // Light green
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    yPosition += 6;
    addText('🐂 Bull Case', margin + 2, 12, 'bold');
    yPosition += 2;
    addText(thesis.bull_case, margin + 2, 10, 'normal');
    yPosition += 8;

    // Bear Case
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFillColor(254, 226, 226); // Light red
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    yPosition += 6;
    addText('🐻 Bear Case', margin + 2, 12, 'bold');
    yPosition += 2;
    addText(thesis.bear_case, margin + 2, 10, 'normal');
    yPosition += 8;

    // Base Case
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFillColor(219, 234, 254); // Light blue
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    yPosition += 6;
    addText('⚖️ Base Case', margin + 2, 12, 'bold');
    yPosition += 2;
    addText(thesis.base_case, margin + 2, 10, 'normal');
    yPosition += 8;

    // Risks
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }
    addText('⚠️ Key Risks', margin, 12, 'bold');
    yPosition += 2;
    thesis.risks.forEach((risk, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      addText(`${index + 1}. ${risk}`, margin + 5, 10, 'normal');
      yPosition += 3;
    });
    yPosition += 5;

    // Catalysts
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }
    addText('⚡ Potential Catalysts', margin, 12, 'bold');
    yPosition += 2;
    thesis.catalysts.forEach((catalyst, index) => {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      addText(`${index + 1}. ${catalyst}`, margin + 5, 10, 'normal');
      yPosition += 3;
    });

    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated by AI Investment Thesis Tool - Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `${ticker}_Investment_Thesis_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Investment Thesis</h2>
            <p className="text-sm text-gray-400">Powered by GPT-4</p>
          </div>
        </div>

        <div className="flex gap-3">
          {thesis && (
            <>
              <button
                onClick={handleGenerateThesis}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Regenerate Thesis"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-all"
                title="Export to PDF"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!thesis && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Generate AI-Powered Analysis</h3>
          <p className="text-gray-400 text-center mb-6 max-w-md">
            Get comprehensive investment analysis including bull/bear cases, risks, and catalysts based on fundamental data.
          </p>
          <button
            onClick={handleGenerateThesis}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-white font-medium transition-all shadow-lg shadow-indigo-500/30"
          >
            <Sparkles className="w-5 h-5" />
            Generate Thesis
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
          <p className="text-white font-medium">Analyzing {ticker}...</p>
          <p className="text-gray-400 text-sm mt-2">This may take 10-15 seconds</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={handleGenerateThesis}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-300 transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      {thesis && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Data Summary */}
          {thesis.data_summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-gray-400 text-xs uppercase mb-1">Current Price</div>
                <div className="text-white font-bold text-lg">₹{thesis.data_summary.current_price?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-gray-400 text-xs uppercase mb-1">P/E Ratio</div>
                <div className="text-white font-bold text-lg">{thesis.data_summary.pe_ratio?.toFixed(2) || 'N/A'}</div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-gray-400 text-xs uppercase mb-1">Market Cap</div>
                <div className="text-white font-bold text-lg">
                  {thesis.data_summary.market_cap ? `₹${(thesis.data_summary.market_cap / 10000000).toFixed(0)}Cr` : 'N/A'}
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-gray-400 text-xs uppercase mb-1">1Y Return</div>
                <div className={`font-bold text-lg ${thesis.data_summary.price_change_1y_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {thesis.data_summary.price_change_1y_pct >= 0 ? '+' : ''}{thesis.data_summary.price_change_1y_pct?.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* Bull Case */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-600/10 border border-emerald-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-emerald-300">Bull Case</h3>
            </div>
            <p className="text-gray-200 leading-relaxed">{thesis.bull_case}</p>
          </div>

          {/* Bear Case */}
          <div className="bg-gradient-to-br from-rose-500/10 to-red-600/10 border border-rose-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-xl font-bold text-rose-300">Bear Case</h3>
            </div>
            <p className="text-gray-200 leading-relaxed">{thesis.bear_case}</p>
          </div>

          {/* Base Case */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Scale className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-blue-300">Base Case</h3>
            </div>
            <p className="text-gray-200 leading-relaxed">{thesis.base_case}</p>
          </div>

          {/* Risks and Catalysts Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Key Risks */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Key Risks</h3>
              </div>
              <ul className="space-y-3">
                {thesis.risks.map((risk, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Potential Catalysts */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Potential Catalysts</h3>
              </div>
              <ul className="space-y-3">
                {thesis.catalysts.map((catalyst, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="flex-shrink-0 w-6 h-6 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{catalyst}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">
              Generated on {new Date(thesis.generated_at).toLocaleString()} • 
              This analysis is AI-generated and should not be considered as financial advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
