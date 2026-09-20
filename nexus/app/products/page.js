"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiPackage, FiRefreshCw } from "react-icons/fi";

function deriveStatus(p) {
  const stock = p?.inventory?.currentStock ?? 0;
  const min = p?.inventory?.minimumStock ?? 0;
  if (stock <= 0 || p?.status === "out_of_stock") return "Out of Stock";
  if (stock <= min) return "Low Stock";
  return "In Stock";
}

function formatPrice(p) {
  const price = p?.pricing?.sellingPrice ?? p?.pricing?.retailPrice;
  if (price == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: p?.pricing?.currency || "USD" }).format(price);
  } catch {
    return `$${Number(price).toFixed(2)}`;
  }
}

const statusColor = {
  "In Stock": "text-green-600 bg-green-100",
  "Low Stock": "text-yellow-600 bg-yellow-100",
  "Out of Stock": "text-red-600 bg-red-100",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/products?${params}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load products");
      setProducts(Array.isArray(json.data) ? json.data : []);
      setPagination(json.meta?.pagination || { total: 0, page: 1, limit: 20, pages: 0 });
    } catch (e) {
      setError(e.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const range = useMemo(() => {
    if (!pagination.total) return "0 results";
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `Showing ${start} to ${end} of ${pagination.total} results`;
  }, [pagination]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600">Manage your product inventory</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm rounded-md bg-white hover:bg-gray-50 cursor-pointer">
              <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
            </button>
            <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer">
              <FiPlus className="mr-2 h-5 w-5" /> Add Product
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input type="text" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search products..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Product", "SKU", "Category", "Stock", "Price", "Status", "Actions"].map((h) => (
                  <th key={h} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">Loading products…</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">No products found. Create via POST /api/products.</td></tr>
              ) : products.map((product) => {
                const status = deriveStatus(product);
                const categoryName = typeof product.category === "object" ? product.category?.name : product.category || "—";
                return (
                  <tr key={product._id || product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><FiPackage className="h-5 w-5 text-gray-500" /></div>
                        <div className="ml-4 text-sm font-medium text-gray-900">{product.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{categoryName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product?.inventory?.currentStock ?? 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatPrice(product)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor[status] || "text-gray-600 bg-gray-100"}`}>{status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="text-indigo-600 hover:text-indigo-900 cursor-pointer"><FiEdit className="h-5 w-5" /></button>
                        <button type="button" className="text-red-600 hover:text-red-900 cursor-pointer"><FiTrash2 className="h-5 w-5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
          <div className="text-sm text-gray-700">{range}</div>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Previous</button>
            <button type="button" disabled={page >= (pagination.pages || 1) || loading} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">Next</button>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
