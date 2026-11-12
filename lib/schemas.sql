-- ============================================================================
-- SRIDEVI TRADERS WHOLESALE MANAGEMENT SYSTEM
-- Supabase / PostgreSQL Production Database Schema
-- Multi-Firm Architecture with RLS & Essential Triggers Only
-- (Business logic & transaction ledgers managed via Backend Code)
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: ENUM TYPES
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'accountant');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
    CREATE TYPE stock_movement_type AS ENUM ('in', 'out');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_reference_type') THEN
    CREATE TYPE stock_reference_type AS ENUM ('purchase', 'sale', 'adjustment', 'return', 'opening_stock');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_adjustment_type') THEN
    CREATE TYPE stock_adjustment_type AS ENUM ('in', 'out');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_transaction_type') THEN
    CREATE TYPE supplier_transaction_type AS ENUM ('purchase', 'payment', 'purchase_return', 'opening_balance', 'adjustment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dealer_transaction_type') THEN
    CREATE TYPE dealer_transaction_type AS ENUM ('sale', 'receipt', 'sales_return', 'opening_balance', 'adjustment');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'cheque', 'card', 'neft');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_mode') THEN
    CREATE TYPE tax_mode AS ENUM ('gst', 'n_gst', 'mixed', 'not_applicable');
  END IF;
END $$;

-- ============================================================================
-- PART 2: TABLE DEFINITIONS (ALL TABLES INCLUDE updated_at)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. firms (Firm / Business Profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  gst_number VARCHAR(20),
  phone VARCHAR(15),
  email TEXT,
  address TEXT,
  logo_url TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_firm_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 2. users (Application Users linked to auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone VARCHAR(15),
  status BOOLEAN NOT NULL DEFAULT true,
  role user_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 3. categories (Shared Master Categories)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cat_code_not_empty CHECK (char_length(trim(category_code)) > 0),
  CONSTRAINT chk_cat_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 4. units (Shared Master Units: KG, Gram, Box, Piece)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  use_name TEXT NOT NULL,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_unit_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 5. products (Shared Master Products)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_code TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  base_unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  minimum_stock DECIMAL(12,3) NOT NULL DEFAULT 0.000 CHECK (minimum_stock >= 0),
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_prod_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 6. product_variants (Shared Packaging Variants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_code VARCHAR(50) NOT NULL UNIQUE,
  barcode VARCHAR(100),
  conversion_to_base DECIMAL(12,4) NOT NULL CHECK (conversion_to_base > 0),
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_variant_name_not_empty CHECK (char_length(trim(variant_name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 7. suppliers (Shared Supplier Master)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  supplier_code VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(15),
  email TEXT,
  gst_number VARCHAR(20),
  address TEXT,
  city TEXT,
  notes TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplier_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 8. dealers (Shared Dealer Master)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone VARCHAR(15),
  email TEXT,
  gst_number VARCHAR(20),
  city TEXT,
  address TEXT,
  notes TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dealer_name_not_empty CHECK (char_length(trim(name)) > 0)
);

-- ----------------------------------------------------------------------------
-- 9. purchases (Firm-Specific Purchases)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) NOT NULL,
  purchase_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  gst_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_subtotal >= 0),
  n_gst_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_subtotal >= 0),
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  gst_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_total >= 0),
  n_gst_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_total >= 0),
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_purchase_number UNIQUE (firm_id, purchase_number)
);

-- ----------------------------------------------------------------------------
-- 10. purchase_items (Firm Purchase Item Lines)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  conversion_factor DECIMAL(12,4) NOT NULL CHECK (conversion_factor > 0),
  base_quantity DECIMAL(12,3) NOT NULL CHECK (base_quantity > 0),
  gst_unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_unit_price >= 0),
  mrp DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (mrp >= 0),
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (discount_rate >= 0 AND discount_rate <= 100),
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  gst_total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_total_price >= 0),
  n_gst_unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_unit_price >= 0),
  n_gst_total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11. sales_bills (Firm-Specific Sales Bills)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  sale_number VARCHAR(100) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  gst_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_subtotal >= 0),
  n_gst_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_subtotal >= 0),
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  gst_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_total >= 0),
  n_gst_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_total >= 0),
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_sale_number UNIQUE (firm_id, sale_number)
);

-- ----------------------------------------------------------------------------
-- 12. sales_bill_items (Firm Sales Bill Item Lines)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_bill_id UUID NOT NULL REFERENCES public.sales_bills(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  conversion_factor DECIMAL(12,4) NOT NULL CHECK (conversion_factor > 0),
  base_quantity DECIMAL(12,3) NOT NULL CHECK (base_quantity > 0),
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (discount_rate >= 0 AND discount_rate <= 100),
  gst_unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_unit_price >= 0),
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
  gst_total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (gst_total_price >= 0),
  n_gst_unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_unit_price >= 0),
  n_gst_total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (n_gst_total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 13. stock_movements (Firm Inventory Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  movement_type stock_movement_type NOT NULL,
  quantity_base DECIMAL(12,3) NOT NULL CHECK (quantity_base > 0),
  remaining_quantity DECIMAL(12,3) DEFAULT NULL,
  reference_type stock_reference_type NOT NULL,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 14. stock_adjustments (Firm Stock Corrections)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  adjustment_type stock_adjustment_type NOT NULL,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  conversion_factor DECIMAL(12,4) NOT NULL CHECK (conversion_factor > 0),
  base_quantity DECIMAL(12,3) NOT NULL CHECK (base_quantity > 0),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 15. supplier_transactions (Firm Supplier Payments & Transactions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  transaction_code VARCHAR(100) NOT NULL,
  transaction_type supplier_transaction_type NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'upi',
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  tax_mode tax_mode NOT NULL DEFAULT 'gst',
  reference_type TEXT NOT NULL,
  reference_id UUID,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_supplier_tx_code UNIQUE (firm_id, transaction_code)
);

-- ----------------------------------------------------------------------------
-- 16. dealer_transactions (Firm Dealer Receipts & Transactions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dealer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE RESTRICT,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  transaction_code VARCHAR(100) NOT NULL,
  transaction_type dealer_transaction_type NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  tax_mode tax_mode NOT NULL DEFAULT 'gst',
  reference_type TEXT NOT NULL,
  reference_id UUID,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_dealer_tx_code UNIQUE (firm_id, transaction_code)
);

-- ----------------------------------------------------------------------------
-- 17. firm_supplier_balances (Firm Supplier Outstanding Balances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firm_supplier_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  gst_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  n_gst_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_supplier UNIQUE (firm_id, supplier_id)
);

-- ----------------------------------------------------------------------------
-- 18. firm_dealer_balances (Firm Dealer Outstanding Balances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firm_dealer_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  gst_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  n_gst_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_firm_dealer UNIQUE (firm_id, dealer_id)
);

-- ============================================================================
-- PART 3: PERFORMANCE INDEXES
-- ============================================================================

-- Firms & Users
CREATE INDEX IF NOT EXISTS idx_firms_status ON public.firms(status);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);

-- Shared Masters
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_unit ON public.products(base_unit_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_dealers_phone ON public.dealers(phone);

-- Purchases & Items
CREATE INDEX IF NOT EXISTS idx_purchases_firm_date ON public.purchases(firm_id, date);
CREATE INDEX IF NOT EXISTS idx_purchases_firm_supplier ON public.purchases(firm_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON public.purchase_items(product_id, product_variant_id);

-- Sales Bills & Items
CREATE INDEX IF NOT EXISTS idx_sales_bills_firm_date ON public.sales_bills(firm_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_bills_firm_dealer ON public.sales_bills(firm_id, dealer_id);
CREATE INDEX IF NOT EXISTS idx_sales_bill_items_bill ON public.sales_bill_items(sales_bill_id);
CREATE INDEX IF NOT EXISTS idx_sales_bill_items_product ON public.sales_bill_items(product_id, product_variant_id);

-- Stock Movements & Adjustments
CREATE INDEX IF NOT EXISTS idx_stock_movements_firm_prod ON public.stock_movements(firm_id, product_id, product_variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON public.stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_firm ON public.stock_adjustments(firm_id, product_id);

-- Financial Transactions & Balances
CREATE INDEX IF NOT EXISTS idx_supplier_tx_firm_date ON public.supplier_transactions(firm_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_supplier_tx_firm_supplier ON public.supplier_transactions(firm_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_dealer_tx_firm_date ON public.dealer_transactions(firm_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_dealer_tx_firm_dealer ON public.dealer_transactions(firm_id, dealer_id);
CREATE INDEX IF NOT EXISTS idx_firm_supplier_bal ON public.firm_supplier_balances(firm_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_firm_dealer_bal ON public.firm_dealer_balances(firm_id, dealer_id);

-- ============================================================================
-- PART 4: CORE ESSENTIAL FUNCTIONS ONLY
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Automated updated_at timestamp function (Essential)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Non-recursive Admin role check helper (Essential for RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = true
  );
$$;

-- ============================================================================
-- PART 5: CORE ESSENTIAL TRIGGERS ONLY (updated_at)
-- ============================================================================
-- Keeps all updated_at timestamps synchronized automatically when rows change.
-- Business-logic triggers (stock movements & balance updates) are managed
-- directly via backend code for precise transactional control.

DROP TRIGGER IF EXISTS trg_firms_updated_at ON public.firms;
CREATE TRIGGER trg_firms_updated_at BEFORE UPDATE ON public.firms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_units_updated_at ON public.units;
CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_dealers_updated_at ON public.dealers;
CREATE TRIGGER trg_dealers_updated_at BEFORE UPDATE ON public.dealers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_purchases_updated_at ON public.purchases;
CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_items_updated_at ON public.purchase_items;
CREATE TRIGGER trg_purchase_items_updated_at BEFORE UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_sales_bills_updated_at ON public.sales_bills;
CREATE TRIGGER trg_sales_bills_updated_at BEFORE UPDATE ON public.sales_bills
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_sales_bill_items_updated_at ON public.sales_bill_items;
CREATE TRIGGER trg_sales_bill_items_updated_at BEFORE UPDATE ON public.sales_bill_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_stock_movements_updated_at ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_updated_at BEFORE UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_stock_adjustments_updated_at ON public.stock_adjustments;
CREATE TRIGGER trg_stock_adjustments_updated_at BEFORE UPDATE ON public.stock_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_transactions_updated_at ON public.supplier_transactions;
CREATE TRIGGER trg_supplier_transactions_updated_at BEFORE UPDATE ON public.supplier_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_dealer_transactions_updated_at ON public.dealer_transactions;
CREATE TRIGGER trg_dealer_transactions_updated_at BEFORE UPDATE ON public.dealer_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_firm_supplier_balances_updated_at ON public.firm_supplier_balances;
CREATE TRIGGER trg_firm_supplier_balances_updated_at BEFORE UPDATE ON public.firm_supplier_balances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_firm_dealer_balances_updated_at ON public.firm_dealer_balances;
CREATE TRIGGER trg_firm_dealer_balances_updated_at BEFORE UPDATE ON public.firm_dealer_balances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- PART 6: ROW LEVEL SECURITY (RLS) ENABLEMENT ON ALL TABLES
-- ============================================================================
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_supplier_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_dealer_balances ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 7: RLS POLICIES (ADMIN FULL ACCESS ACROSS ALL MODULES)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users table policies (Self-read + Admin full CRUD)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own record" ON public.users;
CREATE POLICY "Users can read own record" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admin full access on users" ON public.users;
CREATE POLICY "Admin full access on users" ON public.users
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Firms policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on firms" ON public.firms;
CREATE POLICY "Admin full access on firms" ON public.firms
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Shared Master Tables policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on categories" ON public.categories;
CREATE POLICY "Admin full access on categories" ON public.categories
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on units" ON public.units;
CREATE POLICY "Admin full access on units" ON public.units
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on products" ON public.products;
CREATE POLICY "Admin full access on products" ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on product_variants" ON public.product_variants;
CREATE POLICY "Admin full access on product_variants" ON public.product_variants
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on suppliers" ON public.suppliers;
CREATE POLICY "Admin full access on suppliers" ON public.suppliers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on dealers" ON public.dealers;
CREATE POLICY "Admin full access on dealers" ON public.dealers
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Firm-Specific Transactions & Items policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin full access on purchases" ON public.purchases;
CREATE POLICY "Admin full access on purchases" ON public.purchases
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on purchase_items" ON public.purchase_items;
CREATE POLICY "Admin full access on purchase_items" ON public.purchase_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on sales_bills" ON public.sales_bills;
CREATE POLICY "Admin full access on sales_bills" ON public.sales_bills;
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on sales_bill_items" ON public.sales_bill_items;
CREATE POLICY "Admin full access on sales_bill_items" ON public.sales_bill_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on stock_movements" ON public.stock_movements;
CREATE POLICY "Admin full access on stock_movements" ON public.stock_movements
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Admin full access on stock_adjustments" ON public.stock_adjustments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on supplier_transactions" ON public.supplier_transactions;
CREATE POLICY "Admin full access on supplier_transactions" ON public.supplier_transactions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on dealer_transactions" ON public.dealer_transactions;
CREATE POLICY "Admin full access on dealer_transactions" ON public.dealer_transactions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on firm_supplier_balances" ON public.firm_supplier_balances;
CREATE POLICY "Admin full access on firm_supplier_balances" ON public.firm_supplier_balances
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access on firm_dealer_balances" ON public.firm_dealer_balances;
CREATE POLICY "Admin full access on firm_dealer_balances" ON public.firm_dealer_balances
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
