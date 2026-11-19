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
  gst_subtotal: number;
  tax_amount: number;
  extra_charges?: number;
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
 * Generates a Sale Receipt PDF using jspdf and jspdf-autotable
 * in black-and-white with page border, centered Sale Receipt title,
 * firm details, Sale Date & Generated on, enlarged bold Sale & Dealer details,
 * HSN code column, Bank Details, Totals with Extra Amount,
 * Transportation Details (bottom left), and Authorised Signatory (bottom right),
 * then triggers download and opens the PDF in a new tab (target = _blank).
 */
export function downloadSaleReceipt(data: SaleReceiptData): void {
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

  const generatedTimestamp = new Date().toLocaleString('en-IN');

  // White background and Black text throughout
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Top Middle: "Sale Receipt"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Sale Receipt', pageWidth / 2, 16.5, { align: 'center' });

  // Subtle divider under top title
  doc.setLineWidth(0.25);
  doc.line(margin, 20, pageWidth - margin, 20);

  // Header Left: Firm Name, GST Number, 3-line Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(data.firm_name || 'Sridevi Traders', margin, 27.5);

  doc.setFontSize(9);
  drawLabelAndValue(
    doc,
    'GST Number:',
    `${data.firm_gst || '-'}${data.firm_phone ? `  |  Ph: ${data.firm_phone}` : ''}`,
    margin,
    33.5,
    { boldValue: true, fontSize: 9 }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Address: 36-1-62/1, Surya Nagar,', margin, 39);
  doc.text('Kommula vari st, Pydiparru,', margin, 44);
  doc.text('Tanuku - 534211, W.G, A.P', margin, 49);

  // Header Right: Sale Date & Generated on
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Sale Date: ${data.date || '-'}`, pageWidth - margin, 27.5, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Generated on: ${generatedTimestamp}`, pageWidth - margin, 33.5, {
    align: 'right',
  });

  // Header divider line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(margin, 53.5, pageWidth - margin, 53.5);

  // Sale Details & Dealer Details Box (increased text size & bold important values)
  let currentY = 59.5;
  const fullDealerAddress = [data.dealer_address, data.dealer_city]
    .filter((v) => Boolean(v && v.trim()))
    .join(', ');
  const midX = pageWidth / 2 + 4;
  const maxDealerAddrWidth = pageWidth - margin - midX - 4;
  doc.setFontSize(10);
  const addressPrefix = 'Address: ';
  doc.setFont('helvetica', 'bold');
  const addressPrefixWidth = doc.getTextWidth(addressPrefix);
  doc.setFont('helvetica', 'normal');
  const wrappedDealerAddress = doc.splitTextToSize(
    fullDealerAddress || '-',
    Math.max(30, maxDealerAddrWidth - addressPrefixWidth - 1.5)
  ) as string[];

  const extraAddressLines = Math.max(0, wrappedDealerAddress.length - 1);
  const infoBoxHeight = 32 + extraAddressLines * 5;

  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, pageWidth - margin * 2, infoBoxHeight, 'FD');

  // Vertical divider inside info box
  doc.line(pageWidth / 2, currentY, pageWidth / 2, currentY + infoBoxHeight);

  // Left Column: Sale Details
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SALE DETAILS', margin + 4, currentY + 7.5);

  drawLabelAndValue(doc, 'Sale No:', data.sale_number || '-', margin + 4, currentY + 15, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(
    doc,
    'Invoice No:',
    data.invoice_number || '-',
    margin + 4,
    currentY + 21.5,
    { boldValue: true, fontSize: 10 }
  );
  drawLabelAndValue(doc, 'Sale Date:', data.date || '-', margin + 4, currentY + 28, {
    boldValue: true,
    fontSize: 10,
  });

  // Right Column: Dealer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DEALER DETAILS', midX, currentY + 7.5);

  drawLabelAndValue(doc, 'Dealer:', data.dealer_name || '-', midX, currentY + 15, {
    boldValue: true,
    fontSize: 10,
  });
  drawLabelAndValue(doc, 'Phone:', data.dealer_phone || '-', midX, currentY + 21.5, {
    boldValue: true,
    fontSize: 10,
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(addressPrefix, midX, currentY + 28);
  doc.setFont('helvetica', 'normal');
  wrappedDealerAddress.forEach((line, idx) => {
    doc.text(line, midX + addressPrefixWidth + 1.5, currentY + 28 + idx * 5);
  });

  currentY += infoBoxHeight + 8;

  // Items Table (HSN Code before Product, no GST labels, black & white only)
  const tableHead = [
    [
      '#',
      'HSN Code',
      'Product',
      'Variant',
      'Qty',
      'Base Qty',
      'Unit Price',
      'Disc %',
      'Disc Amt',
      'Tax %',
      'Tax Amt',
      'Total',
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
      item.hsn_code?.trim() || '-',
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
    margin: { top: 14, bottom: 22, left: margin, right: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: 2.4,
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
      fontSize: 7.4,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'left', cellWidth: 26 },
      3: { halign: 'left', cellWidth: 21 },
      4: { halign: 'right', cellWidth: 10 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 11 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'right', cellWidth: 10 },
      10: { halign: 'right', cellWidth: 15 },
      11: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
    },
  });

  const tableEndY = doc.lastAutoTable?.finalY ?? currentY + 24;
  let summaryY = tableEndY + 10;

  const hasNotes = Boolean(data.notes && data.notes.trim());
  const wrappedNotes = hasNotes
    ? (doc.splitTextToSize(data.notes!.trim(), pageWidth - margin * 2) as string[])
    : [];
  const notesBlockHeight = hasNotes ? 9 + wrappedNotes.length * 4.5 : 0;
  const summaryBoxHeight = 39;
  const bottomBlockHeight = 36;
  const bottomLimitY = pageHeight - borderBottomMargin - 6;

  // Prevent Bank Details + Totals + Notes overflow
  if (summaryY + summaryBoxHeight + notesBlockHeight > bottomLimitY) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    summaryY = 16;
  }

  // Right Box: Subtotal, Tax Amount, Extra Amount, Total Amount
  const totalsBoxWidth = 78;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;

  // Left Box: Bank Details (left of Subtotal / Tax / Extra / Total)
  const bankBoxWidth = pageWidth - margin * 2 - totalsBoxWidth - 6;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(margin, summaryY, bankBoxWidth, summaryBoxHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bank Details', margin + 4, summaryY + 7);

  drawLabelAndValue(
    doc,
    'Account Name:',
    'SRIDEVI Traders & CO',
    margin + 4,
    summaryY + 14.5,
    { boldValue: true, fontSize: 9 }
  );
  drawLabelAndValue(
    doc,
    'Account Number:',
    '120031141040',
    margin + 4,
    summaryY + 21,
    { boldValue: true, fontSize: 9 }
  );
  drawLabelAndValue(doc, 'IFSC:', 'CNRB0002776', margin + 4, summaryY + 27.5, {
    boldValue: true,
    fontSize: 9,
  });
  drawLabelAndValue(
    doc,
    'Bank Name:',
    'CANARA BANK, TANUKU BRANCH',
    margin + 4,
    summaryY + 34,
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

  doc.text('Subtotal:', totalsBoxX + 4, summaryY + 7.5);
  doc.text(formatRs(data.gst_subtotal), totalsBoxX + totalsBoxWidth - 4, summaryY + 7.5, {
    align: 'right',
  });

  doc.text('Tax Amount:', totalsBoxX + 4, summaryY + 14.5);
  doc.text(formatRs(data.tax_amount), totalsBoxX + totalsBoxWidth - 4, summaryY + 14.5, {
    align: 'right',
  });

  doc.text('Extra Amount:', totalsBoxX + 4, summaryY + 21.5);
  doc.text(
    formatRs(data.extra_charges || 0),
    totalsBoxX + totalsBoxWidth - 4,
    summaryY + 21.5,
    { align: 'right' }
  );

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(totalsBoxX + 4, summaryY + 25.5, totalsBoxX + totalsBoxWidth - 4, summaryY + 25.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Total Amount:', totalsBoxX + 4, summaryY + 33.5);
  doc.text(formatRs(data.gst_total), totalsBoxX + totalsBoxWidth - 4, summaryY + 33.5, {
    align: 'right',
  });

  let afterSummaryY = summaryY + summaryBoxHeight;

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

  // Bottom Section: Transportation Details (Bottom Left) & Authorised Signatory (Bottom Right)
  // Positioned cleanly above the raised bottom page border line
  let bottomBlockY = pageHeight - borderBottomMargin - bottomBlockHeight - 4;
  if (afterSummaryY + 8 > bottomBlockY) {
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    bottomBlockY = pageHeight - borderBottomMargin - bottomBlockHeight - 4;
  }

  // Bottom Left Box: Transportation Details (Name, Vehicle Number)
  const transportBoxWidth = 96;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(margin, bottomBlockY, transportBoxWidth, bottomBlockHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Transportation Details', margin + 4, bottomBlockY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Name:', margin + 4, bottomBlockY + 17);
  doc.setLineWidth(0.2);
  doc.line(margin + 17, bottomBlockY + 17.5, margin + transportBoxWidth - 4, bottomBlockY + 17.5);

  doc.text('Vehicle Number:', margin + 4, bottomBlockY + 27.5);
  doc.line(margin + 33, bottomBlockY + 28, margin + transportBoxWidth - 4, bottomBlockY + 28);

  // Bottom Right Box: Authorised Signatory (Name, Date, Sign)
  const signBoxWidth = 78;
  const signBoxX = pageWidth - margin - signBoxWidth;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.rect(signBoxX, bottomBlockY, signBoxWidth, bottomBlockHeight, 'FD');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Authorised Signatory', signBoxX + 4, bottomBlockY + 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Name:', signBoxX + 4, bottomBlockY + 15.5);
  doc.setLineWidth(0.2);
  doc.line(signBoxX + 17, bottomBlockY + 16, signBoxX + signBoxWidth - 4, bottomBlockY + 16);

  doc.text('Date:', signBoxX + 4, bottomBlockY + 23);
  doc.line(signBoxX + 15, bottomBlockY + 23.5, signBoxX + signBoxWidth - 4, bottomBlockY + 23.5);

  doc.text('Sign:', signBoxX + 4, bottomBlockY + 30.5);
  doc.line(signBoxX + 15, bottomBlockY + 31, signBoxX + signBoxWidth - 4, bottomBlockY + 31);

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
