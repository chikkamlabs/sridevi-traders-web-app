import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface SaleReceiptItem {
  product_name: string;
  product_code?: string;
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
  dealer_gst?: string | null;
  dealer_city?: string | null;
  gst_subtotal: number;
  tax_amount: number;
  gst_total: number;
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

/**
 * Generates a GST Sale Receipt PDF using jspdf and jspdf-autotable
 * containing important information and ONLY GST columns,
 * then triggers download and opens the PDF in a new tab (target = _blank).
 */
export function downloadSaleReceipt(data: SaleReceiptData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPDFWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header Banner
  doc.setFillColor(20, 83, 45); // Deep green matching brand palette
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.firm_name || 'Sridevi Traders', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const firmMetaParts: string[] = [];
  if (data.firm_gst) firmMetaParts.push(`GSTIN: ${data.firm_gst}`);
  if (data.firm_phone) firmMetaParts.push(`Ph: ${data.firm_phone}`);
  if (firmMetaParts.length > 0) {
    doc.text(firmMetaParts.join('  |  '), margin, 20);
  }
  if (data.firm_address) {
    doc.text(data.firm_address.slice(0, 85), margin, 25.5);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GST SALE RECEIPT', pageWidth - margin, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${data.date || '-'}`, pageWidth - margin, 21, {
    align: 'right',
  });

  // Important Information Section
  let currentY = 38;
  doc.setDrawColor(210, 224, 215);
  doc.setFillColor(246, 250, 247);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 2, 2, 'FD');

  // Left Column: Bill Details
  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('SALE DETAILS', margin + 4, currentY + 6.5);

  doc.setTextColor(35, 45, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Sale No: ${data.sale_number || '-'}`, margin + 4, currentY + 13);
  doc.text(`Invoice No: ${data.invoice_number || '-'}`, margin + 4, currentY + 18.5);
  doc.text(`Sale Date: ${data.date || '-'}`, margin + 4, currentY + 24);

  // Right Column: Dealer Details
  const midX = pageWidth / 2 + 4;
  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('DEALER DETAILS', midX, currentY + 6.5);

  doc.setTextColor(35, 45, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Dealer: ${data.dealer_name || '-'}`, midX, currentY + 13);
  doc.text(
    `Phone: ${data.dealer_phone || '-'}`,
    midX,
    currentY + 18.5
  );
  const dealerExtra: string[] = [];
  if (data.dealer_city) dealerExtra.push(data.dealer_city);
  if (data.dealer_gst) dealerExtra.push(`GSTIN: ${data.dealer_gst}`);
  doc.text(
    dealerExtra.length > 0 ? dealerExtra.join(' | ') : 'Billing Type: GST',
    midX,
    currentY + 24
  );

  currentY += 34;

  // GST Items Table (ONLY GST columns)
  const tableHead = [
    [
      '#',
      'Product',
      'Variant',
      'Qty',
      'Base Qty',
      'Unit Price (GST)',
      'Disc %',
      'Disc Amt',
      'Tax %',
      'Tax Amt',
      'Total (GST)',
    ],
  ];

  const tableBody = data.items.map((item, idx) => {
    const prodLabel = item.product_code
      ? `${item.product_name}\n(${item.product_code})`
      : item.product_name;
    const varLabel = item.variant_code
      ? `${item.variant_name} (${item.variant_code})`
      : item.variant_name;
    const baseQtyLabel = item.base_unit_name
      ? `${item.base_quantity} ${item.base_unit_name}`
      : `${item.base_quantity}`;

    return [
      String(idx + 1),
      prodLabel,
      varLabel,
      String(item.quantity),
      baseQtyLabel,
      formatRs(item.gst_unit_price),
      `${Number(item.discount_rate || 0)}%`,
      formatRs(item.discount_amount),
      `${Number(item.tax_rate || 0)}%`,
      formatRs(item.tax_amount),
      formatRs(item.gst_total_price),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 35],
      lineColor: [215, 226, 219],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [20, 83, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 252, 249],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'left', cellWidth: 32 },
      2: { halign: 'left', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 11 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 21 },
      6: { halign: 'right', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 16 },
      8: { halign: 'right', cellWidth: 11 },
      9: { halign: 'right', cellWidth: 16 },
      10: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? currentY + 20;
  let summaryY = tableEndY + 8;

  // Prevent summary box overflow near bottom of page
  if (summaryY + 42 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    summaryY = 20;
  }

  // Notes (Left) + GST Totals Box (Right)
  if (data.notes && data.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 83, 45);
    doc.text('Notes:', margin, summaryY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 70, 65);
    const wrappedNotes = doc.splitTextToSize(data.notes.trim(), 90);
    doc.text(wrappedNotes, margin, summaryY + 9.5);
  }

  const boxWidth = 76;
  const boxX = pageWidth - margin - boxWidth;
  doc.setDrawColor(20, 83, 45);
  doc.setFillColor(246, 250, 247);
  doc.roundedRect(boxX, summaryY, boxWidth, 27, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 60, 54);
  doc.text('GST Subtotal:', boxX + 4, summaryY + 7);
  doc.text(formatRs(data.gst_subtotal), boxX + boxWidth - 4, summaryY + 7, {
    align: 'right',
  });

  doc.text('Tax Amount:', boxX + 4, summaryY + 13.5);
  doc.text(formatRs(data.tax_amount), boxX + boxWidth - 4, summaryY + 13.5, {
    align: 'right',
  });

  doc.setDrawColor(200, 218, 206);
  doc.line(boxX + 4, summaryY + 16.5, boxX + boxWidth - 4, summaryY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(20, 83, 45);
  doc.text('Total (GST):', boxX + 4, summaryY + 23);
  doc.text(formatRs(data.gst_total), boxX + boxWidth - 4, summaryY + 23, {
    align: 'right',
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 124);
  doc.text(
    `Generated on ${new Date().toLocaleString('en-IN')}`,
    margin,
    footerY
  );
  doc.text('Authorised Signatory', pageWidth - margin, footerY, {
    align: 'right',
  });

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
