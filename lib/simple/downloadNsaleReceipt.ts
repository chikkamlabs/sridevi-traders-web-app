import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface NSaleReceiptItem {
  product_name: string;
  product_code?: string;
  hsn_code?: string;
  variant_name: string;
  variant_code?: string;
  quantity: number;
  sale_unit?: string | null;
  conversion_factor: number;
  base_quantity: number;
  base_unit_name?: string;
  n_gst_unit_price: number;
  n_gst_total_price: number;
}

export interface NSaleReceiptData {
  sale_number: string;
  invoice_number: string;
  date: string;
  firm_name: string;
  firm_phone?: string | null;
  firm_address?: string | null;
  dealer_name: string;
  dealer_phone?: string | null;
  dealer_address?: string | null;
  dealer_city?: string | null;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  n_gst_subtotal: number;
  n_gst_total: number;
  old_n_gst_balance?: number;
  current_n_gst_balance?: number;
  notes?: string | null;
  items: NSaleReceiptItem[];
}

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

function formatRs(value: number): string {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
}

function drawLabelAndValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  options?: { boldValue?: boolean; fontSize?: number }
): void {
  const fontSize = options?.fontSize ?? 10;
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);
  const labelWidth = doc.getTextWidth(label);
  doc.setFont('helvetica', options?.boldValue ? 'bold' : 'normal');
  doc.text(value, x + labelWidth + 1.5, y);
}

async function loadLogoForPdf(
  src: string
): Promise<{ dataUrl: string; aspectRatio: number } | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const maxDim = 400;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          aspectRatio: w / h,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generates an Invoice PDF using jspdf and jspdf-autotable.
 */
export async function downloadNsaleReceipt(data: NSaleReceiptData): Promise<void> {
  const logo = await loadLogoForPdf('/st&co_logo.png');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const borderSideMargin = 8;
  const borderTopMargin = 8;
  const borderBottomMargin = 16; // Raised bottom border line
  const margin = 13;

  // White background and Black text throughout
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Top Left: Logo (public/st&co_logo.png)
  if (logo) {
    const maxW = 30;
    const maxH = 29;
    let drawW = maxW;
    let drawH = drawW / logo.aspectRatio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * logo.aspectRatio;
    }
    const logoY = 11 + (maxH - drawH) / 2;
    doc.addImage(logo.dataUrl, 'PNG', margin, logoY, drawW, drawH);
  }

  // Top Center: Small "Invoice", then larger SRIDEVI TRADERS & CO, Address lines, Mobile number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Invoice', pageWidth / 2, 14.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SRIDEVI TRADERS & CO', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Ground Floor, Flat no. 36-3-142/7, Kommula Peddiraju Plaza, Sri Rama Nagar,', pageWidth / 2, 28, {
    align: 'center',
  });
  doc.text('Mandapaka Road, Pydiparru, Tanuku, West Godavari District, Andhra Pradesh - 534211', pageWidth / 2, 33, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('Mobile number: 9866802833', pageWidth / 2, 38.5, { align: 'center' });

  // Header divider line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(margin, 43.5, pageWidth - margin, 43.5);

  // Sale Details (Left) & Dealer Details (Right) Box
  let currentY = 49;
  const boxX = margin;
  const boxWidth = pageWidth - margin * 2;
  const halfWidth = boxWidth / 2;
  const leftX = boxX + 4;
  const midX = pageWidth / 2 + 4;

  // Left column wrapping for Transporter name
  doc.setFontSize(10);
  const transporterPrefix = 'Transporter name: ';
  doc.setFont('helvetica', 'bold');
  const transporterPrefixWidth = doc.getTextWidth(transporterPrefix);
  doc.setFont('helvetica', 'normal');
  const wrappedTransporter = doc.splitTextToSize(
    data.transporter_name?.trim() || '-',
    Math.max(20, halfWidth - 8 - transporterPrefixWidth - 1)
  ) as string[];

  // Right column wrapping for Address
  const addressPrefix = 'Address: ';
  doc.setFont('helvetica', 'bold');
  const addressPrefixWidth = doc.getTextWidth(addressPrefix);
  doc.setFont('helvetica', 'normal');
  const wrappedDealerAddress = doc.splitTextToSize(
    data.dealer_address?.trim() || '-',
    Math.max(25, halfWidth - 8 - addressPrefixWidth - 1)
  ) as string[];

  const extraLines = Math.max(
    0,
    wrappedTransporter.length - 1,
    wrappedDealerAddress.length - 1
  );
  const infoBoxHeight = 37 + extraLines * 5;

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(boxX, currentY, boxWidth, infoBoxHeight, 'FD');

  // Vertical divider inside info box
  doc.line(pageWidth / 2, currentY, pageWidth / 2, currentY + infoBoxHeight);

  // Left Column: Sale Details
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SALE DETAILS', leftX, currentY + 7.5);

  drawLabelAndValue(
    doc,
    'Date:',
    formatDateDDMMYYYY(data.date),
    leftX,
    currentY + 14.5,
    { boldValue: true, fontSize: 10 }
  );
  drawLabelAndValue(
    doc,
    'Invoice no:',
    data.invoice_number || '-',
    leftX,
    currentY + 20.5,
    { boldValue: true, fontSize: 10 }
  );
  drawLabelAndValue(
    doc,
    'Vehicle No.:',
    data.vehicle_number?.trim() || '-',
    leftX,
    currentY + 26.5,
    { boldValue: true, fontSize: 10 }
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(transporterPrefix, leftX, currentY + 32.5);
  doc.setFont('helvetica', 'normal');
  wrappedTransporter.forEach((line, idx) => {
    doc.text(line, leftX + transporterPrefixWidth + 1, currentY + 32.5 + idx * 5);
  });

  // Right Column: Dealer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DEALER DETAILS', midX, currentY + 7.5);

  drawLabelAndValue(doc, 'Dealer:', data.dealer_name || '-', midX, currentY + 14.5, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(doc, 'Phone:', data.dealer_phone || '-', midX, currentY + 20.5, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(doc, 'City:', data.dealer_city || '-', midX, currentY + 26.5, {
    boldValue: true,
    fontSize: 10,
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(addressPrefix, midX, currentY + 32.5);
  doc.setFont('helvetica', 'normal');
  wrappedDealerAddress.forEach((line, idx) => {
    doc.text(line, midX + addressPrefixWidth + 1, currentY + 32.5 + idx * 5);
  });

  currentY += infoBoxHeight + 8;

  // Items Table: #, Product, Quantity, Unit, Unit Price, Total
  const tableHead = [
    [
      '#',
      'Product',
      'Quantity',
      'Unit',
      'Unit Price',
      'Total',
    ],
  ];

  const tableBody = data.items.map((item, idx) => {
    const prodLabel = item.product_name;
    const unitLabel = item.sale_unit?.trim() || '-';

    return [
      String(idx + 1),
      prodLabel,
      String(item.quantity),
      unitLabel,
      formatRs(item.n_gst_unit_price),
      formatRs(item.n_gst_total_price),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    margin: { top: 14, bottom: 22, left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.6,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 74 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 27 },
      5: { halign: 'right', cellWidth: 27, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? currentY + 24;

  // Total products count below products list
  drawLabelAndValue(
    doc,
    'Total products:',
    String(data.items.length),
    margin,
    tableEndY + 6.5,
    { boldValue: true, fontSize: 9.5 }
  );

  // Summary layout
  const summaryY = tableEndY + 12;

  const hasNotes = Boolean(data.notes && data.notes.trim());
  const wrappedNotes = hasNotes
    ? (doc.splitTextToSize(data.notes!.trim(), pageWidth - margin * 2) as string[])
    : [];

  const summaryBoxHeight = 43;
  const totalsBoxWidth = 78;
  const summaryGap = 5;
  const financialsBoxWidth =
    pageWidth - margin * 2 - totalsBoxWidth - summaryGap;

  const financialsBoxX = margin;
  const totalsBoxX = financialsBoxX + financialsBoxWidth + summaryGap;

  const notesBlockHeight = hasNotes
    ? 9 + wrappedNotes.length * 4.5
    : 0;

  const signBoxWidth = 78;
  const signBoxHeight = 30;
  const bottomLimitY = pageHeight - borderBottomMargin - 6;

  // Calculate required space for summary, notes and signature
  const requiredHeight =
    summaryBoxHeight +
    (hasNotes ? 8 + notesBlockHeight : 0) +
    8 +
    signBoxHeight;

  let finalSummaryY = summaryY;

  // Move summary to a new page only when required
  if (finalSummaryY + requiredHeight > bottomLimitY) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    finalSummaryY = 16;
  }

  // ==========================================
  // LEFT BOX: FINANCIALS
  // ==========================================

  const oldNGstBalance = Number(data.old_n_gst_balance ?? 0);

  const currentNGstBalance = Number(
    data.current_n_gst_balance ??
      oldNGstBalance + Number(data.n_gst_total || 0)
  );

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);

  doc.rect(
    financialsBoxX,
    finalSummaryY,
    financialsBoxWidth,
    summaryBoxHeight,
    'FD'
  );

  doc.setTextColor(0, 0, 0);

// Financials heading
doc.setFont('helvetica', 'bold');
doc.setFontSize(9.5);
doc.text('Financials', financialsBoxX + 4, finalSummaryY + 6);

// Old Balance
doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.text('Old Balance', financialsBoxX + 4, finalSummaryY + 13);

doc.setFont('helvetica', 'bold');
doc.text(
  formatRs(oldNGstBalance),
  financialsBoxX + financialsBoxWidth - 4,
  finalSummaryY + 13,
  { align: 'right' }
);

// Bill Amount
doc.setFont('helvetica', 'normal');
doc.text('Bill Amount (+)', financialsBoxX + 4, finalSummaryY + 20);

doc.setFont('helvetica', 'bold');
doc.text(
  formatRs(data.n_gst_total),
  financialsBoxX + financialsBoxWidth - 4,
  finalSummaryY + 20,
  { align: 'right' }
);

// Separator
doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.2);
doc.line(
  financialsBoxX + 4,
  finalSummaryY + 24,
  financialsBoxX + financialsBoxWidth - 4,
  finalSummaryY + 24
);

// Final Balance
doc.setFont('helvetica', 'bold');
doc.setFontSize(9);

doc.text(
  'Final Balance:',
  financialsBoxX + 4,
  finalSummaryY + 34
);

doc.text(
  formatRs(currentNGstBalance),
  financialsBoxX + financialsBoxWidth - 4,
  finalSummaryY + 34,
  { align: 'right' }
);
  // ==========================================
  // RIGHT BOX: SUBTOTAL AND TOTAL
  // ==========================================

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);

  doc.rect(
    totalsBoxX,
    finalSummaryY,
    totalsBoxWidth,
    summaryBoxHeight,
    'FD'
  );

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.text('Subtotal:', totalsBoxX + 4, finalSummaryY + 10);

  doc.text(
    formatRs(data.n_gst_subtotal),
    totalsBoxX + totalsBoxWidth - 4,
    finalSummaryY + 10,
    { align: 'right' }
  );

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  doc.line(
    totalsBoxX + 4,
    finalSummaryY + 15.5,
    totalsBoxX + totalsBoxWidth - 4,
    finalSummaryY + 15.5
  );

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);

  doc.text('Total:', totalsBoxX + 4, finalSummaryY + 24.5);

  doc.text(
    formatRs(data.n_gst_total),
    totalsBoxX + totalsBoxWidth - 4,
    finalSummaryY + 24.5,
    { align: 'right' }
  );

  // ==========================================
  // NOTES BELOW FINANCIALS AND TOTALS
  // ==========================================

  let afterSummaryY = finalSummaryY + summaryBoxHeight;

  if (hasNotes) {
    const notesY = afterSummaryY + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);

    doc.text('Notes:', margin, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text(wrappedNotes, margin, notesY + 5);

    afterSummaryY =
      notesY + 5 + wrappedNotes.length * 4.5;
  }

  // ==========================================
  // SIGNATURE BOX DIRECTLY BELOW CONTENT
  // ==========================================

  const signBoxX = pageWidth - margin - signBoxWidth;
  const signBoxY = afterSummaryY + 8;

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);

  doc.rect(
    signBoxX,
    signBoxY,
    signBoxWidth,
    signBoxHeight,
    'FD'
  );

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);

  doc.text(
    'For, SRIDEVI TRADERS & CO',
    signBoxX + signBoxWidth / 2,
    signBoxY + 8,
    { align: 'center' }
  );

  doc.text(
    'Signature',
    signBoxX + signBoxWidth / 2,
    signBoxY + signBoxHeight - 5,
    { align: 'center' }
  );


  // Draw outer page border on every page (with raised bottom line)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(
      borderSideMargin,
      borderTopMargin,
      pageWidth - borderSideMargin * 2,
      pageHeight - borderTopMargin - borderBottomMargin
    );
  }

  const safeFilename = `${(data.sale_number || 'sale_receipt').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  )}.pdf`;

  // 1. Trigger direct file download
  doc.save(safeFilename);

  // 2. Open PDF in new tab (target = "_blank")
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000);
  }
}
