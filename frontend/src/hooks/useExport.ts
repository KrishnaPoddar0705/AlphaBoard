/**
 * useExport Hook
 * 
 * Handles exporting thesis to PDF and Notion.
 */

import { useState, useCallback } from 'react';
import type { Thesis } from '../types/thesis';
import { exportToNotion } from '../lib/api';
import jsPDF from 'jspdf';

interface UseExportReturn {
  isExporting: boolean;
  exportError: string | null;
  exportToPDF: (thesis: Thesis) => Promise<void>;
  exportToNotion: (thesis: Thesis, title?: string) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handlePDFExport = useCallback(async (thesis: Thesis) => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Create PDF using jsPDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      let yPos = margin;

      // Helper function to add text with word wrap
      const addText = (text: string, fontSize: number, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (yPos > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += fontSize * 0.5;
        });
        yPos += 5; // Add spacing after section
      };

      // Header
      addText(`Investment Thesis: ${thesis.ticker}`, 18, true);
      addText(`Generated: ${new Date(thesis.generated_at).toLocaleDateString()}`, 10);
      yPos += 10;

      // Summary
      addText('Summary', 14, true);
      addText(thesis.summary, 11);
      yPos += 5;

      // Rating
      addText(`Rating: ${thesis.rating}`, 14, true);
      addText(thesis.ratingJustification, 11);
      yPos += 10;

      // Bull Case
      addText('Bull Case', 14, true);
      addText(thesis.bullCase, 11);
      yPos += 5;

      // Bear Case
      addText('Bear Case', 14, true);
      addText(thesis.bearCase, 11);
      yPos += 5;

      // Base Case
      addText('Base Case', 14, true);
      addText(thesis.baseCase, 11);
      yPos += 5;

      // Risks
      addText('Key Risks', 14, true);
      thesis.risks.forEach((risk) => {
        addText(`• ${risk}`, 11);
      });
      yPos += 5;

      // Catalysts
      addText('Key Catalysts', 14, true);
      thesis.catalysts.forEach((catalyst) => {
        addText(`• ${catalyst}`, 11);
      });

      // Save PDF
      doc.save(`thesis_${thesis.ticker}_${Date.now()}.pdf`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to export PDF';
      setExportError(errorMessage);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleNotionExport = useCallback(async (thesis: Thesis, title?: string) => {
    setIsExporting(true);
    setExportError(null);

    try {
      await exportToNotion(thesis, title);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to export to Notion';
      setExportError(errorMessage);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    exportError,
    exportToPDF: handlePDFExport,
    exportToNotion: handleNotionExport,
  };
}

