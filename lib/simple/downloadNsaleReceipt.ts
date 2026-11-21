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

/**
 * Generates an Invoice PDF using jspdf and jspdf-autotable.
 */
export function downloadNsaleReceipt(data: NSaleReceiptData): void {
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

  // Top Middle: "Invoice"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Invoice', pageWidth / 2, 16.5, { align: 'center' });

  // Subtle divider under top title
  doc.setLineWidth(0.25);
  doc.line(margin, 20, pageWidth - margin, 20);

  // Header Left: Firm Name, 3-line Address, and Mobile number below address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(data.firm_name || 'Sridevi Traders', margin, 27.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Address: 36-1-62/1, Surya Nagar,', margin, 33.5);
  doc.text('Kommula vari st, Pydiparru,', margin, 38.5);
  doc.text('Tanuku - 534211, W.G, A.P', margin, 43.5);

  drawLabelAndValue(doc, 'Mobile number:', '9866802833', margin, 49, {
    boldValue: true,
    fontSize: 9,
  });

  // Header Right: Date (dd-mm-yyyy) & Invoice no
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Date: ${formatDateDDMMYYYY(data.date)}`, pageWidth - margin, 27.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Invoice no: ${data.invoice_number || '-'}`, pageWidth - margin, 33.5, {
    align: 'right',
  });

  // Header divider line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(margin, 53.5, pageWidth - margin, 53.5);

  // Dealer Details Single Block
  let currentY = 59.5;
  const boxX = margin;
  const boxWidth = pageWidth - margin * 2;
  const textX = boxX + 4;
  const maxDealerAddrWidth = boxWidth - 8;

  doc.setFontSize(10);
  const addressPrefix = 'Address: ';
  doc.setFont('helvetica', 'bold');
  const addressPrefixWidth = doc.getTextWidth(addressPrefix);
  doc.setFont('helvetica', 'normal');
  const wrappedDealerAddress = doc.splitTextToSize(
    data.dealer_address?.trim() || '-',
    Math.max(40, maxDealerAddrWidth - addressPrefixWidth - 1.5)
  ) as string[];

  const extraAddressLines = Math.max(0, wrappedDealerAddress.length - 1);
  const infoBoxHeight = 37 + extraAddressLines * 5;

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(boxX, currentY, boxWidth, infoBoxHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DEALER DETAILS', textX, currentY + 7.5);

  drawLabelAndValue(doc, 'Dealer:', data.dealer_name || '-', textX, currentY + 14.5, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(doc, 'Phone:', data.dealer_phone || '-', textX, currentY + 20.5, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(doc, 'City:', data.dealer_city || '-', textX, currentY + 26.5, {
    boldValue: true,
    fontSize: 10,
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(addressPrefix, textX, currentY + 32.5);
  doc.setFont('helvetica', 'normal');
  wrappedDealerAddress.forEach((line, idx) => {
    doc.text(line, textX + addressPrefixWidth + 1.5, currentY + 32.5 + idx * 5);
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

  let summaryY = tableEndY + 13;

  const hasNotes = Boolean(data.notes && data.notes.trim());
  const wrappedNotes = hasNotes
    ? (doc.splitTextToSize(data.notes!.trim(), pageWidth - margin * 2) as string[])
    : [];
  const notesBlockHeight = hasNotes ? 9 + wrappedNotes.length * 4.5 : 0;
  const summaryBoxHeight = 32;
  const financialsGap = 5;
  const financialsBoxHeight = 20;
  const bottomBlockHeight = 36;
  const bottomLimitY = pageHeight - borderBottomMargin - 6;

  // Prevent Totals + Financials + Notes overflow
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

  // Right Box: Subtotal, Total Amount
  const totalsBoxWidth = 78;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;

  // Totals Box (Right): Subtotal and Total only
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(totalsBoxX, summaryY, totalsBoxWidth, summaryBoxHeight, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  doc.text('Subtotal:', totalsBoxX + 4, summaryY + 10);
  doc.text(formatRs(data.n_gst_subtotal), totalsBoxX + totalsBoxWidth - 4, summaryY + 10, {
    align: 'right',
  });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(totalsBoxX + 4, summaryY + 15.5, totalsBoxX + totalsBoxWidth - 4, summaryY + 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Total:', totalsBoxX + 4, summaryY + 24.5);
  doc.text(formatRs(data.n_gst_total), totalsBoxX + totalsBoxWidth - 4, summaryY + 24.5, {
    align: 'right',
  });

  // Financials Box: Old Balance + Bill Amount = Final Balance
  const oldNGstBalance = Number(data.old_n_gst_balance ?? 0);
  const currentNGstBalance = Number(
    data.current_n_gst_balance ?? oldNGstBalance + Number(data.n_gst_total || 0)
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
  doc.text(formatRs(oldNGstBalance), col1X, financialsY + 17);
  doc.text('+', plusX, financialsY + 15);
  doc.text(formatRs(data.n_gst_total), col2X, financialsY + 17);
  doc.text('=', eqX, financialsY + 15);
  doc.text(formatRs(currentNGstBalance), col3X, financialsY + 17);

  let afterSummaryY = financialsY + financialsBoxHeight;

  // Optional Notes below Financials
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

  // Bottom Right Box: Empty box
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
