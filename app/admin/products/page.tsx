import { redirect } from 'next/navigation';

export default function AdminProductsRootPage() {
  redirect('/admin/products/dashboard');
}
