'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import { getFirms, Firm } from '@/lib/firmsStore';
import { getDealers, Dealer } from '@/lib/dealersStore';
import { getProducts, Product } from '@/lib/productsStore';
import { getAllProductVariants, ProductVariant } from '@/lib/productvariantsStore';
import { getUnits, Unit } from '@/lib/unitsStore';
import {
  addSaleBill,
  applySaleStockAndMovements,
  generateSaleNumber,
  generateSaleInvoiceNumber,
  getLast5PurchaseItemsForProduct,
  RecentPurchaseRate,
  SaleBillItemInput,
  UnitPriceFactor,
} from '@/lib/salesStore';
import {
  getDealerGstBalances,
  recordSaleDealerTransaction,
} from '@/lib/dealertrasacationsStore';
import { downloadSaleReceipt, SaleReceiptItem } from '@/lib/downloadSaleReceipt';
import { getStoredAuthUser } from '@/lib/auth';
import {
  ArrowLeft,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Package,
  History,
  Download,
} from 'lucide-react';

interface SaleItemRow {
  keyId: string;
  product_id: string;
  product_variant_id: string;
  quantity: string;
  sale_unit: string;
  conversion_factor: string;
  base_quantity: string;
  gst_unit_price: string;
  gst_unit_price_factor: UnitPriceFactor;
  mrp: string;
  discount_rate: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  gst_total_price: string;
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptySaleItemRow(): SaleItemRow {
  return {
    keyId: 'sitem-' + Math.random().toString(36).substring(2, 9),
    product_id: '',
    product_variant_id: '',
    quantity: '1',
    sale_unit: '',
    conversion_factor: '1',
    base_quantity: '1',
    gst_unit_price: '0',
    gst_unit_price_factor: 'qty',
    mrp: '0',
    discount_rate: '0',
    discount_amount: '0',
    tax_rate: '0',
    tax_amount: '0',
    gst_total_price: '0',
  };
}

function recalculateSaleItemAmounts(row: SaleItemRow): SaleItemRow {
  const qty = Math.max(0, Number(row.quantity) || 0);
  const conv = Math.max(0, Number(row.conversion_factor) || 0);
  const baseQty = qty * conv;

  const unitPrice = Math.max(0, Number(row.gst_unit_price) || 0);
  const discRate = Math.min(100, Math.max(0, Number(row.discount_rate) || 0));
  const taxRate = Math.max(0, Number(row.tax_rate) || 0);
  const factorQty = row.gst_unit_price_factor === 'base_qty' ? baseQty : qty;

  const gross = factorQty * unitPrice;
  const discAmt = (gross * discRate) / 100;
  const taxable = Math.max(0, gross - discAmt);
  const taxAmt = (taxable * taxRate) / 100;
  const totalPrice = taxable + taxAmt;

  return {
    ...row,
    base_quantity: Number.isFinite(baseQty) ? String(Number(baseQty.toFixed(3))) : '0',
    discount_amount: discAmt.toFixed(2),
    tax_amount: taxAmt.toFixed(2),
    gst_total_price: totalPrice.toFixed(2),
  };
}

export default function AddSalePage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin');

  // Master Data
  const [firms, setFirms] = useState<Firm[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Sales Bill Fields
  const [firmId, setFirmId] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [saleNumber, setSaleNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [gstSubtotal, setGstSubtotal] = useState('0.00');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [sgstRate, setSgstRate] = useState('0');
  const [sgstAmount, setSgstAmount] = useState('0.00');
  const [cgstRate, setCgstRate] = useState('0');
  const [cgstAmount, setCgstAmount] = useState('0.00');
  const [igstRate, setIgstRate] = useState('0');
  const [igstAmount, setIgstAmount] = useState('0.00');
  const [extraCharges, setExtraCharges] = useState('0.00');
  const [gstTotal, setGstTotal] = useState('0.00');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [notes, setNotes] = useState('');

  // Searchable Firm Picker
  const [firmSearch, setFirmSearch] = useState('');
  const [isFirmPickerOpen, setIsFirmPickerOpen] = useState(false);

  // Searchable Dealer Picker
  const [dealerSearch, setDealerSearch] = useState('');
  const [isDealerPickerOpen, setIsDealerPickerOpen] = useState(false);

  // Sales Bill Items
  const [items, setItems] = useState<SaleItemRow[]>([createEmptySaleItemRow()]);
  const [openProductPickerKey, setOpenProductPickerKey] = useState<string | null>(null);
  const [productSearchByRow, setProductSearchByRow] = useState<Record<string, string>>({});

  // Last 5 Purchase Items reference per product_id
  const [recentPurchasesByProduct, setRecentPurchasesByProduct] = useState<
    Record<string, RecentPurchaseRate[]>
  >({});
  const [openHistoryDropdownKey, setOpenHistoryDropdownKey] = useState<string | null>(null);

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      const [firmsData, dealersData, productsData, variantsData, unitsData] = await Promise.all([
        getFirms(),
        getDealers(),
        getProducts(),
        getAllProductVariants(),
        getUnits(),
      ]);

      const user = getStoredAuthUser();
      if (user?.name) {
        setAdminName(user.name);
      } else if (user?.email) {
        const emailPrefix = user.email.split('@')[0];
        setAdminName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
      }

      setSaleNumber((prev) => prev || generateSaleNumber());
      setInvoiceNumber((prev) => prev || generateSaleInvoiceNumber());
      setFirms(firmsData);
      setDealers(dealersData);
      setProducts(productsData);
      setAllVariants(variantsData);
      setUnits(unitsData);

      if (firmsData.length > 0) setFirmId(firmsData[0].id);
      if (dealersData.length > 0) setDealerId(dealersData[0].id);

      setLoadingOptions(false);
    };

    loadInitial();
  }, []);

  const recalculateBillTotals = (
    subVal: number,
    sRateVal: number,
    cRateVal: number,
    iRateVal: number,
    extraVal: number
  ) => {
    const sub = Math.max(0, Number(subVal.toFixed(2)));
    const sAmt = Number(((sub * Math.max(0, sRateVal)) / 100).toFixed(2));
    const cAmt = Number(((sub * Math.max(0, cRateVal)) / 100).toFixed(2));
    const iAmt = Number(((sub * Math.max(0, iRateVal)) / 100).toFixed(2));
    const ext = Math.max(0, Number(extraVal.toFixed(2)));
    const rawTotal = Number((sub + sAmt + cAmt + iAmt + ext).toFixed(2));
    const roundedTotal = Math.ceil(rawTotal);

    setSgstAmount(sAmt.toFixed(2));
    setCgstAmount(cAmt.toFixed(2));
    setIgstAmount(iAmt.toFixed(2));
    setGstTotal(roundedTotal.toFixed(2));
  };

  const recalculateTotalFromAmounts = (
    subVal: number,
    sAmtVal: number,
    cAmtVal: number,
    iAmtVal: number,
    extraVal: number
  ) => {
    const sub = Math.max(0, Number(subVal.toFixed(2)));
    const sAmt = Math.max(0, Number(sAmtVal.toFixed(2)));
    const cAmt = Math.max(0, Number(cAmtVal.toFixed(2)));
    const iAmt = Math.max(0, Number(iAmtVal.toFixed(2)));
    const ext = Math.max(0, Number(extraVal.toFixed(2)));
    const rawTotal = Number((sub + sAmt + cAmt + iAmt + ext).toFixed(2));
    setGstTotal(Math.ceil(rawTotal).toFixed(2));
  };

  const syncTotalsFromItems = (nextItems: SaleItemRow[]) => {
    let subTotalSum = 0;
    let taxSum = 0;

    for (const item of nextItems) {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const baseQty = Math.max(0, Number(item.base_quantity) || 0);
      const unitPrice = Math.max(0, Number(item.gst_unit_price) || 0);
      const factorQty = item.gst_unit_price_factor === 'base_qty' ? baseQty : qty;
      const discAmt = Math.max(0, Number(item.discount_amount) || 0);
      const itemTax = Math.max(0, Number(item.tax_amount) || 0);

      subTotalSum += Math.max(0, factorQty * unitPrice - discAmt);
      taxSum += itemTax;
    }

    setGstSubtotal(subTotalSum.toFixed(2));
    setTaxAmount(taxSum.toFixed(2));
    recalculateBillTotals(
      subTotalSum,
      Number(sgstRate) || 0,
      Number(cgstRate) || 0,
      Number(igstRate) || 0,
      Number(extraCharges) || 0
    );
  };

  const handleGstSubtotalChange = (value: string) => {
    setGstSubtotal(value);
    recalculateBillTotals(
      Math.max(0, Number(value) || 0),
      Number(sgstRate) || 0,
      Number(cgstRate) || 0,
      Number(igstRate) || 0,
      Number(extraCharges) || 0
    );
  };

  const handleSgstRateChange = (value: string) => {
    setSgstRate(value);
    recalculateBillTotals(
      Math.max(0, Number(gstSubtotal) || 0),
      Math.max(0, Number(value) || 0),
      Number(cgstRate) || 0,
      Number(igstRate) || 0,
      Number(extraCharges) || 0
    );
  };

  const handleCgstRateChange = (value: string) => {
    setCgstRate(value);
    recalculateBillTotals(
      Math.max(0, Number(gstSubtotal) || 0),
      Number(sgstRate) || 0,
      Math.max(0, Number(value) || 0),
      Number(igstRate) || 0,
      Number(extraCharges) || 0
    );
  };

  const handleIgstRateChange = (value: string) => {
    setIgstRate(value);
    recalculateBillTotals(
      Math.max(0, Number(gstSubtotal) || 0),
      Number(sgstRate) || 0,
      Number(cgstRate) || 0,
      Math.max(0, Number(value) || 0),
      Number(extraCharges) || 0
    );
  };

  const handleExtraChargesChange = (value: string) => {
    setExtraCharges(value);
    recalculateTotalFromAmounts(
      Math.max(0, Number(gstSubtotal) || 0),
      Math.max(0, Number(sgstAmount) || 0),
      Math.max(0, Number(cgstAmount) || 0),
      Math.max(0, Number(igstAmount) || 0),
      Math.max(0, Number(value) || 0)
    );
  };

  const filteredFirms = useMemo(() => {
    const q = firmSearch.trim().toLowerCase();
    if (!q) return firms;
    return firms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.gst_number && f.gst_number.toLowerCase().includes(q))
    );
  }, [firms, firmSearch]);

  const filteredDealers = useMemo(() => {
    const q = dealerSearch.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q))
    );
  }, [dealers, dealerSearch]);

  const selectedFirm = firms.find((f) => f.id === firmId);
  const selectedDealer = dealers.find((d) => d.id === dealerId);

  const handleAddItemRow = () => {
    const next = [...items, createEmptySaleItemRow()];
    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) {
      setError('At least one product item is required for a sale.');
      return;
    }
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleSelectProduct = async (rowIndex: number, productId: string) => {
    const prodVariants = allVariants.filter((v) => v.product_id === productId);
    const defaultVariant = prodVariants[0];

    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const conv = defaultVariant ? String(defaultVariant.conversion_to_base) : '1';
      const updated: SaleItemRow = {
        ...row,
        product_id: productId,
        product_variant_id: defaultVariant ? defaultVariant.id : '',
        conversion_factor: conv,
      };
      return recalculateSaleItemAmounts(updated);
    });

    setItems(next);
    syncTotalsFromItems(next);
    setOpenProductPickerKey(null);

    // Fetch last 5 purchase details for the selected product (Just Show)
    if (!recentPurchasesByProduct[productId]) {
      const history = await getLast5PurchaseItemsForProduct(productId);
      setRecentPurchasesByProduct((prev) => ({
        ...prev,
        [productId]: history,
      }));
    }
  };

  const handleSelectVariant = (rowIndex: number, variantId: string) => {
    const variant = allVariants.find((v) => v.id === variantId);
    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const conv = variant ? String(variant.conversion_to_base) : row.conversion_factor;
      const updated: SaleItemRow = {
        ...row,
        product_variant_id: variantId,
        conversion_factor: conv,
      };
      return recalculateSaleItemAmounts(updated);
    });

    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleItemFieldChange = (
    rowIndex: number,
    field: keyof SaleItemRow,
    value: string
  ) => {
    const next = items.map((row, idx) => {
      if (idx !== rowIndex) return row;
      const updated = { ...row, [field]: value };

      if (
        field === 'quantity' ||
        field === 'conversion_factor' ||
        field === 'gst_unit_price' ||
        field === 'gst_unit_price_factor' ||
        field === 'discount_rate' ||
        field === 'tax_rate'
      ) {
        return recalculateSaleItemAmounts(updated);
      }

      if (field === 'discount_amount' || field === 'tax_amount') {
        const qty = Math.max(0, Number(updated.quantity) || 0);
        const baseQty = Math.max(0, Number(updated.base_quantity) || 0);
        const unitPrice = Math.max(0, Number(updated.gst_unit_price) || 0);
        const factorQty = updated.gst_unit_price_factor === 'base_qty' ? baseQty : qty;
        const discAmt = Math.max(0, Number(updated.discount_amount) || 0);
        const taxAmt = Math.max(0, Number(updated.tax_amount) || 0);
        const total = Math.max(0, factorQty * unitPrice - discAmt) + taxAmt;
        return {
          ...updated,
          gst_total_price: total.toFixed(2),
        };
      }

      return updated;
    });

    setItems(next);
    syncTotalsFromItems(next);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!firmId) {
      setError('Please select a firm.');
      return;
    }
    if (!dealerId) {
      setError('Please select a dealer.');
      return;
    }
    if (!saleNumber.trim()) {
      setError('Sale number is required.');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required.');
      return;
    }
    if (!date) {
      setError('Please select a sale date.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one product item.');
      return;
    }

    const preparedItems: SaleBillItemInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.product_id) {
        setError(`Item #${i + 1}: Please select a product.`);
        return;
      }
      if (!row.product_variant_id) {
        setError(`Item #${i + 1}: Please select a product variant.`);
        return;
      }

      const qty = Number(row.quantity);
      const conv = Number(row.conversion_factor);
      const baseQty = Number(row.base_quantity);
      const unitPrice = Number(row.gst_unit_price);
      const discRate = Number(row.discount_rate);
      const discAmt = Number(row.discount_amount);
      const tRate = Number(row.tax_rate);
      const tAmt = Number(row.tax_amount);
      const totalPrice = Number(row.gst_total_price);

      if (isNaN(qty) || qty <= 0) {
        setError(`Item #${i + 1}: Quantity must be greater than 0.`);
        return;
      }
      if (isNaN(conv) || conv <= 0) {
        setError(`Item #${i + 1}: Conversion factor must be greater than 0.`);
        return;
      }
      if (isNaN(baseQty) || baseQty <= 0) {
        setError(`Item #${i + 1}: Base quantity must be greater than 0.`);
        return;
      }

      preparedItems.push({
        product_id: row.product_id,
        product_variant_id: row.product_variant_id,
        quantity: qty,
        sale_unit: row.sale_unit.trim() || null,
        conversion_factor: conv,
        base_quantity: baseQty,
        gst_unit_price: isNaN(unitPrice) ? 0 : unitPrice,
        gst_unit_price_factor: row.gst_unit_price_factor || 'qty',
        discount_rate: isNaN(discRate) ? 0 : discRate,
        discount_amount: isNaN(discAmt) ? 0 : discAmt,
        tax_rate: isNaN(tRate) ? 0 : tRate,
        tax_amount: isNaN(tAmt) ? 0 : tAmt,
        gst_total_price: isNaN(totalPrice) ? 0 : totalPrice,
      });
    }

    const totalNum = Math.ceil(Number((Number(gstTotal) || 0).toFixed(2)));
    const subtotalNum = Number(gstSubtotal);
    const taxNum = Number(taxAmount);
    const sgstRateNum = Math.max(0, Number(sgstRate) || 0);
    const sgstAmountNum = Math.max(0, Number(sgstAmount) || 0);
    const cgstRateNum = Math.max(0, Number(cgstRate) || 0);
    const cgstAmountNum = Math.max(0, Number(cgstAmount) || 0);
    const igstRateNum = Math.max(0, Number(igstRate) || 0);
    const igstAmountNum = Math.max(0, Number(igstAmount) || 0);
    const extraChargesNum = Math.max(0, Number(extraCharges) || 0);

    if (isNaN(totalNum) || totalNum <= 0) {
      setError('Total (gst_total) must be greater than 0.');
      return;
    }

    setIsSaving(true);

    try {
      // Check existing firm dealer gst_balance before adding this bill
      const existingBalances = await getDealerGstBalances(dealerId);
      const existingFirmBal = existingBalances.find((b) => b.firm_id === firmId);
      const gstOldBalance = Number(existingFirmBal?.gst_balance || 0);
      const gstNewBalance = gstOldBalance + totalNum;

      // 1. Insert sales_bills & sales_bill_items
      const { data: savedSale, error: saleErr } = await addSaleBill(
        {
          firm_id: firmId,
          dealer_id: dealerId,
          sale_number: saleNumber.trim(),
          invoice_number: invoiceNumber.trim(),
          date,
          gst_subtotal: isNaN(subtotalNum) ? 0 : subtotalNum,
          tax_amount: isNaN(taxNum) ? 0 : taxNum,
          sgst_rate: sgstRateNum,
          sgst_amount: sgstAmountNum,
          cgst_rate: cgstRateNum,
          cgst_amount: cgstAmountNum,
          igst_rate: igstRateNum,
          igst_amount: igstAmountNum,
          extra_charges: isNaN(extraChargesNum) ? 0 : extraChargesNum,
          gst_total: totalNum,
          grand_total: totalNum,
          gst_old_balance: gstOldBalance,
          gst_new_balance: gstNewBalance,
          vehicle_number: vehicleNumber.trim() || null,
          transporter_name: transporterName.trim() || null,
          notes: notes.trim(),
        },
        preparedItems
      );

      if (saleErr || !savedSale) {
        setError(saleErr || 'Failed to save sale bill.');
        setIsSaving(false);
        return;
      }

      // 2. Insert dealer_transactions (transaction_type = 'sale', payment_method = 'NA', amount = gst_total)
      //    and increment firm_dealer_balances.gst_balance
      const { error: txErr } = await recordSaleDealerTransaction({
        firm_id: firmId,
        dealer_id: dealerId,
        sales_bill_id: savedSale.id,
        sale_number: savedSale.sale_number,
        invoice_number: savedSale.invoice_number,
        amount: totalNum,
        transaction_date: date,
        notes: notes.trim() || undefined,
      });

      if (txErr) {
        setError(txErr);
        setIsSaving(false);
        return;
      }

      // 3. Decrement products.quantity and insert stock_movements (movement_type = 'out', remaining_quantity = products.quantity - base_quantity, reference_type = 'sale')
      const { error: stockErr } = await applySaleStockAndMovements({
        firm_id: firmId,
        sales_bill_id: savedSale.id,
        sale_number: savedSale.sale_number,
        items: preparedItems,
      });

      if (stockErr) {
        setError(stockErr);
        setIsSaving(false);
        return;
      }

      setSuccessMsg(
        `Sale ${savedSale.sale_number} saved, dealer balance & stock updated! Redirecting...`
      );
      setIsSaving(false);

      setTimeout(() => {
        router.push('/admin/sales/dashboard');
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error saving sale.';
      setError(msg);
      setIsSaving(false);
    }
  };

  const handleDownloadReceipt = () => {
    setError(null);

    if (!firmId || !selectedFirm) {
      setError('Please select a firm before downloading the receipt.');
      return;
    }
    if (!dealerId || !selectedDealer) {
      setError('Please select a dealer before downloading the receipt.');
      return;
    }

    const validItems = items.filter((row) => row.product_id && row.product_variant_id);
    if (validItems.length === 0) {
      setError('Please select at least one product and variant to download the receipt.');
      return;
    }

    const receiptItems: SaleReceiptItem[] = validItems.map((row) => {
      const prod = products.find((p) => p.id === row.product_id);
      const variant = allVariants.find((v) => v.id === row.product_variant_id);
      return {
        product_name: prod?.name || 'Product',
        product_code: prod?.product_code || '',
        hsn_code: prod?.hsn_code || '',
        variant_name: variant?.variant_name || 'Variant',
        variant_code: variant?.variant_code || '',
        quantity: Number(row.quantity) || 0,
        conversion_factor: Number(row.conversion_factor) || 0,
        base_quantity: Number(row.base_quantity) || 0,
        base_unit_name: prod?.unit_name || '',
        gst_unit_price: Number(row.gst_unit_price) || 0,
        mrp: Number(row.mrp) || 0,
        discount_rate: Number(row.discount_rate) || 0,
        discount_amount: Number(row.discount_amount) || 0,
        tax_rate: Number(row.tax_rate) || 0,
        tax_amount: Number(row.tax_amount) || 0,
        gst_total_price: Number(row.gst_total_price) || 0,
      };
    });

    downloadSaleReceipt({
      sale_number: saleNumber.trim() || 'sale_receipt',
      invoice_number: invoiceNumber.trim() || '-',
      date: date || getTodayDateString(),
      firm_name: selectedFirm.name,
      firm_gst: selectedFirm.gst_number || null,
      firm_phone: selectedFirm.phone || null,
      firm_address: selectedFirm.address || null,
      dealer_name: selectedDealer.name,
      dealer_phone: selectedDealer.phone || null,
      dealer_address: selectedDealer.address || null,
      dealer_gst: selectedDealer.gst_number || null,
      dealer_city: selectedDealer.city || null,
      vehicle_number: vehicleNumber.trim() || null,
      transporter_name: transporterName.trim() || null,
      gst_subtotal: Number(gstSubtotal) || 0,
      tax_amount: Number(taxAmount) || 0,
      sgst_rate: Math.max(0, Number(sgstRate) || 0),
      sgst_amount: Math.max(0, Number(sgstAmount) || 0),
      cgst_rate: Math.max(0, Number(cgstRate) || 0),
      cgst_amount: Math.max(0, Number(cgstAmount) || 0),
      igst_rate: Math.max(0, Number(igstRate) || 0),
      igst_amount: Math.max(0, Number(igstAmount) || 0),
      extra_charges: Math.max(0, Number(extraCharges) || 0),
      gst_total: Math.ceil(Number((Number(gstTotal) || 0).toFixed(2))),
      notes: notes.trim() || null,
      items: receiptItems,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)]" suppressHydrationWarning>
      <AdminHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        adminName={adminName}
      />

      <div className="flex flex-1 w-full relative">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Back Navigation */}
            <div className="flex items-center justify-between">
              <Link
                href="/admin/sales/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-deep-green)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sales</span>
              </Link>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)] text-sm flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-danger)]" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {successMsg && (
              <div className="p-4 rounded-lg bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] text-sm flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[var(--color-brand-deep-green)]" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSale} className="space-y-6">
              {/* Sales Bill Master Card */}
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-5 border-b border-[var(--color-border)]">
                  <div className="p-2.5 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      Add Sale
                    </h1>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5">
                      Enter sales bill details, add items, and automatically update dealer ledger balances.
                    </p>
                  </div>
                </div>

                {/* Row 1: Firm (Search & Select) and Dealer (Search & Select) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Firm Picker */}
                  <div className="form-group mb-0 relative">
                    <label className="form-label">
                      Firm <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFirmPickerOpen((prev) => !prev);
                        setIsDealerPickerOpen(false);
                      }}
                      disabled={isSaving || loadingOptions}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] cursor-pointer"
                    >
                      <span className="text-sm truncate">
                        {selectedFirm ? selectedFirm.name : 'Select a firm...'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {isFirmPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={firmSearch}
                            onChange={(e) => setFirmSearch(e.target.value)}
                            placeholder="Search firms..."
                            className="input-field py-1.5 pl-8 text-xs"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                          {filteredFirms.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setFirmId(f.id);
                                setIsFirmPickerOpen(false);
                                setFirmSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                firmId === f.id
                                  ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div>{f.name}</div>
                              {f.gst_number && (
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                  GST: {f.gst_number}
                                </div>
                              )}
                            </button>
                          ))}
                          {filteredFirms.length === 0 && (
                            <div className="p-3 text-center text-[var(--color-text-muted)]">
                              No firms found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dealer Picker */}
                  <div className="form-group mb-0 relative">
                    <label className="form-label">
                      Dealer <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDealerPickerOpen((prev) => !prev);
                        setIsFirmPickerOpen(false);
                      }}
                      disabled={isSaving || loadingOptions}
                      className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] cursor-pointer"
                    >
                      <span className="text-sm truncate">
                        {selectedDealer
                          ? `${selectedDealer.name}${selectedDealer.city ? ` (${selectedDealer.city})` : ''}`
                          : 'Select a dealer...'}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">▼</span>
                    </button>

                    {isDealerPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={dealerSearch}
                            onChange={(e) => setDealerSearch(e.target.value)}
                            placeholder="Search dealers..."
                            className="input-field py-1.5 pl-8 text-xs"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                          {filteredDealers.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setDealerId(d.id);
                                setIsDealerPickerOpen(false);
                                setDealerSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                dealerId === d.id
                                  ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                              }`}
                            >
                              <div>{d.name}</div>
                              {(d.phone || d.city) && (
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                  {[d.phone, d.city].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </button>
                          ))}
                          {filteredDealers.length === 0 && (
                            <div className="p-3 text-center text-[var(--color-text-muted)]">
                              No dealers found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Sale Number, Invoice Number, Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Sale Number (auto filled sale_XXXXX) */}
                  <div className="form-group mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="sale-number" className="form-label mb-0">
                        Sale Number <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setSaleNumber(generateSaleNumber())}
                        className="text-[11px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        title="Generate new sale number"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regen</span>
                      </button>
                    </div>
                    <input
                      id="sale-number"
                      type="text"
                      required
                      value={saleNumber}
                      onChange={(e) => setSaleNumber(e.target.value)}
                      className="input-field text-sm font-mono font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Invoice Number (auto filled ymmddXXX) */}
                  <div className="form-group mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="sale-invoice-number" className="form-label mb-0">
                        Invoice Number <span className="text-[var(--color-danger)]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setInvoiceNumber(generateSaleInvoiceNumber())}
                        className="text-[11px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        title="Generate new invoice number"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regen</span>
                      </button>
                    </div>
                    <input
                      id="sale-invoice-number"
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="input-field text-sm font-mono font-semibold text-[var(--color-brand-deep-green)] bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Date */}
                  <div className="form-group mb-0">
                    <label htmlFor="sale-date" className="form-label">
                      Date <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="sale-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Row 3: Subtotal (gst_subtotal), Tax Amount, Extra Charges, Total (gst_total) */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="form-group mb-0">
                    <label htmlFor="sale-gst-subtotal" className="form-label">
                      Subtotal (gst_subtotal) <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="sale-gst-subtotal"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={gstSubtotal}
                      onChange={(e) => handleGstSubtotalChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-tax-amount" className="form-label">
                      Tax Amount <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="sale-tax-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-extra-charges" className="form-label">
                      Extra Charges
                    </label>
                    <input
                      id="sale-extra-charges"
                      type="number"
                      step="0.01"
                      min="0"
                      value={extraCharges}
                      onChange={(e) => handleExtraChargesChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-gst-total" className="form-label">
                      Total (gst_total) <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <input
                      id="sale-gst-total"
                      type="number"
                      step="1"
                      min="0.01"
                      required
                      value={gstTotal}
                      onChange={(e) => setGstTotal(e.target.value)}
                      className="input-field text-sm font-bold text-[var(--color-brand-deep-green)]"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Row 4: SGST, CGST, IGST Rates & Auto-calculated Amounts */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                  <div className="form-group mb-0">
                    <label htmlFor="sale-sgst-rate" className="form-label">
                      SGST Rate (%)
                    </label>
                    <input
                      id="sale-sgst-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={sgstRate}
                      onChange={(e) => handleSgstRateChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-sgst-amount" className="form-label">
                      SGST Amount
                    </label>
                    <input
                      id="sale-sgst-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={sgstAmount}
                      onChange={(e) => {
                        setSgstAmount(e.target.value);
                        recalculateTotalFromAmounts(
                          Math.max(0, Number(gstSubtotal) || 0),
                          Math.max(0, Number(e.target.value) || 0),
                          Math.max(0, Number(cgstAmount) || 0),
                          Math.max(0, Number(igstAmount) || 0),
                          Math.max(0, Number(extraCharges) || 0)
                        );
                      }}
                      className="input-field text-sm bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-cgst-rate" className="form-label">
                      CGST Rate (%)
                    </label>
                    <input
                      id="sale-cgst-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={cgstRate}
                      onChange={(e) => handleCgstRateChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-cgst-amount" className="form-label">
                      CGST Amount
                    </label>
                    <input
                      id="sale-cgst-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={cgstAmount}
                      onChange={(e) => {
                        setCgstAmount(e.target.value);
                        recalculateTotalFromAmounts(
                          Math.max(0, Number(gstSubtotal) || 0),
                          Math.max(0, Number(sgstAmount) || 0),
                          Math.max(0, Number(e.target.value) || 0),
                          Math.max(0, Number(igstAmount) || 0),
                          Math.max(0, Number(extraCharges) || 0)
                        );
                      }}
                      className="input-field text-sm bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-igst-rate" className="form-label">
                      IGST Rate (%)
                    </label>
                    <input
                      id="sale-igst-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={igstRate}
                      onChange={(e) => handleIgstRateChange(e.target.value)}
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-igst-amount" className="form-label">
                      IGST Amount
                    </label>
                    <input
                      id="sale-igst-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={igstAmount}
                      onChange={(e) => {
                        setIgstAmount(e.target.value);
                        recalculateTotalFromAmounts(
                          Math.max(0, Number(gstSubtotal) || 0),
                          Math.max(0, Number(sgstAmount) || 0),
                          Math.max(0, Number(cgstAmount) || 0),
                          Math.max(0, Number(e.target.value) || 0),
                          Math.max(0, Number(extraCharges) || 0)
                        );
                      }}
                      className="input-field text-sm bg-[var(--color-surface-hover)]"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Row 5: Vehicle Number & Transporter Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group mb-0">
                    <label htmlFor="sale-vehicle-number" className="form-label">
                      Vehicle Number
                    </label>
                    <input
                      id="sale-vehicle-number"
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="Enter vehicle number..."
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="form-group mb-0">
                    <label htmlFor="sale-transporter-name" className="form-label">
                      Transporter Name
                    </label>
                    <input
                      id="sale-transporter-name"
                      type="text"
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      placeholder="Enter transporter name..."
                      className="input-field text-sm"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group mb-0">
                  <label htmlFor="sale-notes" className="form-label">
                    Notes
                  </label>
                  <textarea
                    id="sale-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional sale notes, dispatch details, or remarks..."
                    className="textarea-field text-sm min-h-[4.5rem]"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Sales Bill Items Card */}
              <div className="bg-[var(--color-brand-white)] rounded-xl border border-[var(--color-border)] shadow-xs p-6 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)]">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                        Sales Bill Items
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Search and select products, pick variants, check recent purchase prices, and enter pricing & taxes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    disabled={isSaving}
                    className="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-[var(--color-brand-deep-green)] border-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((row, idx) => {
                    const selectedProduct = products.find((p) => p.id === row.product_id);
                    const rowVariants = allVariants.filter(
                      (v) => v.product_id === row.product_id
                    );
                    const rowSearch = productSearchByRow[row.keyId] || '';
                    const filteredProducts = rowSearch.trim()
                      ? products.filter(
                          (p) =>
                            p.name.toLowerCase().includes(rowSearch.trim().toLowerCase()) ||
                            p.product_code
                              .toLowerCase()
                              .includes(rowSearch.trim().toLowerCase()) ||
                            (p.hsn_code &&
                              p.hsn_code
                                .toLowerCase()
                                .includes(rowSearch.trim().toLowerCase()))
                        )
                      : products;
                    const recentRates = row.product_id
                      ? recentPurchasesByProduct[row.product_id] || []
                      : [];

                    return (
                      <div
                        key={row.keyId}
                        className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] space-y-4"
                      >
                        {/* Item Row Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-brand-deep-green)] text-[var(--color-text-inverse)] text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                              Item #{idx + 1}
                            </span>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={isSaving}
                              className="text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] p-1.5 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>

                        {/* Product (Search & Select) and Product Variant */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Searchable Product Selector */}
                          <div className="form-group mb-0 relative">
                            <label className="form-label text-xs">
                              Product <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenProductPickerKey((prev) =>
                                  prev === row.keyId ? null : row.keyId
                                )
                              }
                              disabled={isSaving || loadingOptions}
                              className="w-full input-field text-left flex items-center justify-between gap-2 bg-[var(--color-brand-white)] py-1.5 text-xs cursor-pointer"
                            >
                              <span className="truncate">
                                {selectedProduct
                                  ? `${selectedProduct.name} (${selectedProduct.product_code}${selectedProduct.hsn_code ? ` • HSN: ${selectedProduct.hsn_code}` : ''})`
                                  : 'Search & select product...'}
                              </span>
                              <span className="text-[10px] text-[var(--color-text-muted)]">▼</span>
                            </button>
                            {selectedProduct && (
                              <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-1">
                                HSN Code: {selectedProduct.hsn_code || '—'}
                              </div>
                            )}

                            {openProductPickerKey === row.keyId && (
                              <div className="absolute top-full left-0 mt-1 w-full bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                                <div className="relative mb-2">
                                  <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                  <input
                                    type="text"
                                    value={rowSearch}
                                    onChange={(e) =>
                                      setProductSearchByRow((prev) => ({
                                        ...prev,
                                        [row.keyId]: e.target.value,
                                      }))
                                    }
                                    placeholder="Search product name, code, or HSN..."
                                    className="input-field py-1.5 pl-8 text-xs"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-48 overflow-y-auto divide-y divide-[var(--color-border-subtle)] text-xs">
                                  {filteredProducts.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleSelectProduct(idx, p.id)}
                                      className={`w-full text-left px-3 py-2 rounded-md transition-colors cursor-pointer ${
                                        row.product_id === p.id
                                          ? 'bg-[var(--color-brand-light-green)] text-[var(--color-brand-deep-green)] font-semibold'
                                          : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
                                      }`}
                                    >
                                      <div>{p.name}</div>
                                      <div className="text-[11px] text-[var(--color-text-muted)]">
                                        {p.product_code}
                                        {p.hsn_code ? ` • HSN: ${p.hsn_code}` : ''} • {p.unit_name || 'Unit'}
                                      </div>
                                    </button>
                                  ))}
                                  {filteredProducts.length === 0 && (
                                    <div className="p-3 text-center text-[var(--color-text-muted)]">
                                      No products found
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Product Variant Selector */}
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Product Variant <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <select
                              required
                              value={row.product_variant_id}
                              onChange={(e) => handleSelectVariant(idx, e.target.value)}
                              disabled={isSaving || !row.product_id}
                              className="select-field text-xs py-1.5"
                            >
                              <option value="">
                                {row.product_id
                                  ? rowVariants.length > 0
                                    ? 'Select variant...'
                                    : 'No variants available'
                                  : 'Select product first'}
                              </option>
                              {rowVariants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.variant_name} ({v.variant_code}) — Conv: {v.conversion_to_base}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Quantity, Sale Unit, Conversion Factor, Base Quantity, Unit Price (+ Last 5 Purchase Dropdown), Unit Factor, MRP */}
                        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Quantity <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              required
                              value={row.quantity}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'quantity', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Sale Unit
                            </label>
                            <input
                              type="text"
                              list="sale-unit-suggestions"
                              value={row.sale_unit}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'sale_unit', e.target.value)
                              }
                              placeholder="e.g., Bag, Box, KG"
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Conversion Factor
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              required
                              value={row.conversion_factor}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'conversion_factor', e.target.value)
                              }
                              className="input-field text-xs py-1.5 bg-[var(--color-surface-hover)]"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Base Quantity
                            </label>
                            <input
                              type="number"
                              step="any"
                              readOnly
                              value={row.base_quantity}
                              className="input-field text-xs py-1.5 bg-[var(--color-surface-muted)] font-semibold text-[var(--color-brand-deep-green)]"
                            />
                          </div>

                          {/* Unit price + Last 5 Purchase Details Dropdown (Just Show) */}
                          <div className="form-group mb-0 relative">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <label className="form-label text-xs mb-0">
                                Unit Price (GST) <span className="text-[var(--color-danger)]">*</span>
                              </label>
                              {row.product_id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenHistoryDropdownKey((prev) =>
                                      prev === row.keyId ? null : row.keyId
                                    )
                                  }
                                  className="text-[10px] text-[var(--color-brand-deep-green)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                  title="Show last 5 purchase prices for this product"
                                >
                                  <History className="w-3 h-3" />
                                  <span>Last 5</span>
                                </button>
                              )}
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.gst_unit_price}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'gst_unit_price', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />

                            {/* Read-only Last 5 Purchase Details Dropdown */}
                            {openHistoryDropdownKey === row.keyId && row.product_id && (
                              <div className="absolute top-full right-0 mt-1 w-64 bg-[var(--color-brand-white)] rounded-lg border border-[var(--color-border)] shadow-xl z-30 p-2 animate-fade-in">
                                <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] px-2 py-1 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                                  <span>Last 5 Purchase Rates</span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenHistoryDropdownKey(null)}
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {recentRates.length === 0 ? (
                                  <div className="p-2.5 text-center text-[11px] text-[var(--color-text-muted)]">
                                    No previous purchase items found.
                                  </div>
                                ) : (
                                  <ul className="divide-y divide-[var(--color-border-subtle)] max-h-40 overflow-y-auto text-xs">
                                    {recentRates.map((rate) => (
                                      <li
                                        key={rate.id}
                                        className="px-2 py-1.5 flex items-center justify-between gap-2 text-[var(--color-text-primary)]"
                                      >
                                        <span className="truncate">{rate.variant_name}</span>
                                        <span className="font-semibold text-[var(--color-brand-deep-green)] shrink-0">
                                          ₹
                                          {rate.gst_unit_price.toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Unit Factor</label>
                            <select
                              aria-label="Unit Factor"
                              value={row.gst_unit_price_factor}
                              onChange={(e) =>
                                handleItemFieldChange(
                                  idx,
                                  'gst_unit_price_factor',
                                  e.target.value as UnitPriceFactor
                                )
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            >
                              <option value="qty">qty</option>
                              <option value="base_qty">base_qty</option>
                            </select>
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">MRP</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.mrp}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'mrp', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>
                        </div>

                        {/* Discount Rate, Discount Amount, Tax Rate, Tax Amount, Total Price */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Discount Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={row.discount_rate}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'discount_rate', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Discount Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.discount_amount}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'discount_amount', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Tax Rate (%)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.tax_rate}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'tax_rate', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">Tax Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.tax_amount}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'tax_amount', e.target.value)
                              }
                              className="input-field text-xs py-1.5"
                              disabled={isSaving}
                            />
                          </div>

                          <div className="form-group mb-0">
                            <label className="form-label text-xs">
                              Total Price (GST) <span className="text-[var(--color-danger)]">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={row.gst_total_price}
                              onChange={(e) =>
                                handleItemFieldChange(idx, 'gst_total_price', e.target.value)
                              }
                              className="input-field text-xs py-1.5 font-bold text-[var(--color-brand-deep-green)] bg-[var(--color-primary-light)]"
                              disabled={isSaving}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Product Button */}
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-brand-deep-green)] text-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Product</span>
                </button>

                {/* Save & Cancel Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    Items: <strong className="text-[var(--color-text-primary)]">{items.length}</strong> • Total Amount:{' '}
                    <strong className="text-[var(--color-brand-deep-green)] text-sm">
                      ₹
                      {Number(gstTotal || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Link
                      href="/admin/sales/dashboard"
                      className="btn btn-outline"
                    >
                      Cancel
                    </Link>
                    <button
                      type="button"
                      onClick={handleDownloadReceipt}
                      disabled={isSaving}
                      className="btn btn-outline inline-flex items-center gap-2 border-[var(--color-brand-deep-green)] text-[var(--color-brand-deep-green)] hover:bg-[var(--color-brand-light-green)]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn btn-primary min-w-[150px]"
                    >
                      {isSaving ? 'Saving...' : 'Save Sale'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <datalist id="sale-unit-suggestions">
              {units.map((u) => (
                <option key={u.id} value={u.name} />
              ))}
            </datalist>
          </div>
        </main>
      </div>
    </div>
  );
}
