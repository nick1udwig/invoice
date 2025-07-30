import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Set worker source - using CDN for simplicity
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  pdfData: Uint8Array;
  fileName: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfData, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderedPages, setRenderedPages] = useState<number[]>([]);

  const renderPage = async (pageNum: number, pdf: PDFDocumentProxy, canvas: HTMLCanvasElement) => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const renderAllPages = async (pdf: PDFDocumentProxy) => {
    if (!containerRef.current) return;

    // Clear existing content
    containerRef.current.innerHTML = '';
    
    const newRenderedPages: number[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto 20px';
      canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      
      containerRef.current.appendChild(canvas);
      await renderPage(pageNum, pdf, canvas);
      newRenderedPages.push(pageNum);
    }
    
    setRenderedPages(newRenderedPages);
  };

  useEffect(() => {
    const loadPDF = async () => {
      try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        await renderAllPages(pdf);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPDF();
  }, [pdfData]);

  useEffect(() => {
    if (pdfDoc) {
      renderAllPages(pdfDoc);
    }
  }, [scale, pdfDoc]);

  const zoomIn = () => {
    setScale(scale + 0.25);
  };

  const zoomOut = () => {
    if (scale > 0.5) {
      setScale(scale - 0.25);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        backgroundColor: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', flex: 1 }}>{fileName}</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {totalPages} page{totalPages !== 1 ? 's' : ''}
          </span>
          <button 
            onClick={zoomOut} 
            style={{ 
              padding: '5px 10px',
              backgroundColor: 'var(--background)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            −
          </button>
          <span style={{ color: 'var(--text-primary)', minWidth: '50px', textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={zoomIn} 
            style={{ 
              padding: '5px 10px',
              backgroundColor: 'var(--background)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            +
          </button>
        </div>
      </div>
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          backgroundColor: 'var(--background)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      />
    </div>
  );
};

export default PDFViewer;