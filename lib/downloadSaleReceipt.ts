import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SaleReceiptItem {
  product_name: string;
  product_code?: string;
  hsn_code?: string;
  variant_name: string;
  variant_code?: string;
  quantity: number;
  conversion_factor: number;
  base_quantity: number;
  base_unit_name?: string;
  gst_unit_price: number;
  mrp?: number;
  discount_rate: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  gst_total_price: number;
}

export interface SaleReceiptData {
  sale_number: string;
  invoice_number: string;
  date: string;
  firm_name: string;
  firm_gst?: string | null;
  firm_phone?: string | null;
  firm_address?: string | null;
  dealer_name: string;
  dealer_phone?: string | null;
  dealer_address?: string | null;
  dealer_gst?: string | null;
  dealer_city?: string | null;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  gst_subtotal: number;
  tax_amount: number;
  sgst_rate?: number;
  sgst_amount?: number;
  cgst_rate?: number;
  cgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  extra_charges?: number;
  gst_total: number;
  old_gst_balance?: number;
  current_gst_balance?: number;
  notes?: string | null;
  items: SaleReceiptItem[];
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
 * Generates a Tax Invoice PDF using jspdf and jspdf-autotable.
 */
export async function downloadSaleReceipt(data: SaleReceiptData): Promise<void> {
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

  // Top Center: Small "Tax Invoice", then SRIDEVI TRADERS & CO, Address lines, Mobile & GST
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Tax Invoice', pageWidth / 2, 14.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SRIDEVI TRADERS & CO', pageWidth / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text('Ground Floor, Flat no. 36-3-142/7, SriRam Nagar', pageWidth / 2, 28, {
    align: 'center',
  });
  doc.text('Mandapaka Road, Pydiparru, Tanuku, W.G DT, AP - 534211', pageWidth / 2, 33, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    'Mobile number: 9866802833 | GST Number: 37PLQPS2138F1ZD',
    pageWidth / 2,
    38.5,
    { align: 'center' }
  );

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

  // Items Table (#, HSN Code, Product, Base Qty, Total)
  const tableHead = [['#', 'HSN Code', 'Product', 'Base Qty', 'Total']];

  const tableBody = data.items.map((item, idx) => {
    const prodLabel = item.product_name;
    const baseQtyLabel = item.base_unit_name
      ? `${item.base_quantity} ${item.base_unit_name}`
      : `${item.base_quantity}`;

    return [
      String(idx + 1),
      item.hsn_code?.trim() || '-',
      prodLabel,
      baseQtyLabel,
      formatRs(item.gst_total_price),
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
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 84 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? currentY + 24;
  let summaryY = tableEndY + 10;

  const hasNotes = Boolean(data.notes && data.notes.trim());
  const wrappedNotes = hasNotes
    ? (doc.splitTextToSize(data.notes!.trim(), pageWidth - margin * 2) as string[])
    : [];
  const notesBlockHeight = hasNotes ? 9 + wrappedNotes.length * 4.5 : 0;
  const summaryBoxHeight = 47;
  const financialsGap = 5;
  const financialsBoxHeight = 20;
  const bottomBlockHeight = 36;
  const bottomLimitY = pageHeight - borderBottomMargin - 6;

  // Prevent Bank Details + Totals + Financials + Notes overflow
  if (
    summaryY +
      summaryBoxHeight +
      financialsGap +
      financialsBoxHeight +
      notesBlockHeight >
    bottomLimitY
  ) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    summaryY = 16;
  }

  // Right Box: Subtotal, SGST, CGST, IGST, Extra Charges, Total Amount
  const totalsBoxWidth = 82;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;

  // Left Box: Bank Details (left of Totals box)
  const bankBoxWidth = pageWidth - margin * 2 - totalsBoxWidth - 6;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(margin, summaryY, bankBoxWidth, summaryBoxHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bank Details', margin + 4, summaryY + 8);

  drawLabelAndValue(
    doc,
    'Account Name:',
    'SRIDEVI Traders & CO',
    margin + 4,
    summaryY + 16.5,
    { boldValue: true, fontSize: 9 }
  );
  drawLabelAndValue(
    doc,
    'Account Number:',
    '120031141040',
    margin + 4,
    summaryY + 24,
    { boldValue: true, fontSize: 9 }
  );
  drawLabelAndValue(doc, 'IFSC:', 'CNRB0002776', margin + 4, summaryY + 31.5, {
    boldValue: true,
    fontSize: 9,
  });
  drawLabelAndValue(
    doc,
    'Bank Name:',
    'CANARA BANK, TANUKU BRANCH',
    margin + 4,
    summaryY + 39,
    { boldValue: false, fontSize: 9 }
  );

  // Totals Box (Right)
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(totalsBoxX, summaryY, totalsBoxWidth, summaryBoxHeight, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);

  doc.text('Subtotal:', totalsBoxX + 4, summaryY + 7);
  doc.text(formatRs(data.gst_subtotal), totalsBoxX + totalsBoxWidth - 4, summaryY + 7, {
    align: 'right',
  });

  const sgstRate = Number(data.sgst_rate || 0);
  const sgstAmount = Number(data.sgst_amount || 0);
  doc.text(`SGST (${sgstRate}%):`, totalsBoxX + 4, summaryY + 13);
  doc.text(formatRs(sgstAmount), totalsBoxX + totalsBoxWidth - 4, summaryY + 13, {
    align: 'right',
  });

  const cgstRate = Number(data.cgst_rate || 0);
  const cgstAmount = Number(data.cgst_amount || 0);
  doc.text(`CGST (${cgstRate}%):`, totalsBoxX + 4, summaryY + 19);
  doc.text(formatRs(cgstAmount), totalsBoxX + totalsBoxWidth - 4, summaryY + 19, {
    align: 'right',
  });

  const igstRate = Number(data.igst_rate || 0);
  const igstAmount = Number(data.igst_amount || 0);
  doc.text(`IGST (${igstRate}%):`, totalsBoxX + 4, summaryY + 25);
  doc.text(formatRs(igstAmount), totalsBoxX + totalsBoxWidth - 4, summaryY + 25, {
    align: 'right',
  });

  doc.text('Extra Charges:', totalsBoxX + 4, summaryY + 31);
  doc.text(
    formatRs(data.extra_charges || 0),
    totalsBoxX + totalsBoxWidth - 4,
    summaryY + 31,
    { align: 'right' }
  );

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(totalsBoxX + 4, summaryY + 35, totalsBoxX + totalsBoxWidth - 4, summaryY + 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Total Amount:', totalsBoxX + 4, summaryY + 42);
  doc.text(formatRs(data.gst_total), totalsBoxX + totalsBoxWidth - 4, summaryY + 42, {
    align: 'right',
  });

  const oldGstBalance = Number(data.old_gst_balance ?? 0);
  const currentGstBalance = Number(
    data.current_gst_balance ?? oldGstBalance + Number(data.gst_total || 0)
  );

  const financialsY = summaryY + summaryBoxHeight + financialsGap;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(margin, financialsY, pageWidth - margin * 2, financialsBoxHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Financials', margin + 4, financialsY + 6);

  const col1X = margin + 4;
  const plusX = margin + 62;
  const col2X = margin + 70;
  const eqX = margin + 124;
  const col3X = margin + 132;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Old Balance', col1X, financialsY + 11.5);
  doc.text('Bill Amount', col2X, financialsY + 11.5);
  doc.text('Final Balance', col3X, financialsY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(formatRs(oldGstBalance), col1X, financialsY + 17);
  doc.text('+', plusX, financialsY + 15);
  doc.text(formatRs(data.gst_total), col2X, financialsY + 17);
  doc.text('=', eqX, financialsY + 15);
  doc.text(formatRs(currentGstBalance), col3X, financialsY + 17);

  let afterSummaryY = financialsY + financialsBoxHeight;

  // Optional Notes below Bank Details & Totals
  if (hasNotes) {
    const notesY = afterSummaryY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Notes:', margin, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(wrappedNotes, margin, notesY + 5);
    afterSummaryY = notesY + 5 + wrappedNotes.length * 4.5;
  }

  // Bottom Right Box: Empty Signature box with For, SRIDEVI TRADERS & CO and Signature
  let bottomBlockY = pageHeight - borderBottomMargin - bottomBlockHeight - 4;
  if (afterSummaryY + 8 > bottomBlockY) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    bottomBlockY = pageHeight - borderBottomMargin - bottomBlockHeight - 4;
  }

  const signBoxWidth = 78;
  const signBoxX = pageWidth - margin - signBoxWidth;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(signBoxX, bottomBlockY, signBoxWidth, bottomBlockHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('For, SRIDEVI TRADERS & CO', signBoxX + signBoxWidth / 2, bottomBlockY + 7.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Signature', signBoxX + signBoxWidth / 2, bottomBlockY + bottomBlockHeight - 5, {
    align: 'center',
  });

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
