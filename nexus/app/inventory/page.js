"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { FiAlertTriangle, FiCheckCircle, FiTrendingDown, FiPackage, FiSearch, FiRefreshCw, FiTrendingUp } from "react-icons/fi";

function mapItem(raw) {
  const onHand = raw?.quantity?.onHand ?? 0;
  const min = raw?.minimumStock ?? 0;
  const max = raw?.maximumStock ?? Math.max(min * 2, onHand, 1);
  let status = "Good";
  if (onHand <= 0) status = "Out";
  else if (onHand <= min) status = "Low";
  return { id: raw._id, name: raw.product?.name || "Unknown", sku: raw.product?.sku || "—", currentStock: onHand, minStock: min, maxStock: max, status, lastUpdated: raw.updatedAt ? new Date(raw.updatedAt).toLocaleString() : "—", value: (raw.cost?.unitCost || 0) * onHand };
}

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [adjustId, setAdjustId] = useState("");
  const [adjustChange, setAdjustChange] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/inventory?limit=100", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load inventory");
      setItems((json.data || []).map(mapItem));
    } catch (e) { setError(e.message); setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)) : items;
  }, [items, search]);

  const summary = useMemo(() => {
    let inStock = 0, low = 0, out = 0, totalValue = 0;
    for (const i of items) {
      if (i.status === "Good") inStock++; else if (i.status === "Low") low++; else out++;
      totalValue += i.value || 0;
    }
    return { inStock, low, out, totalValue };
  }, [items]);

  async function onAdjust(e) {
    e.preventDefault(); setMsg(null);
    try {
      const res = await fetch("/api/inventory/adjust", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: adjustId, change: Number(adjustChange), reason: adjustReason || "UI stock update" }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Adjust failed");
      setMsg({ ok: true, text: "Stock updated" }); setAdjustChange(""); setAdjustReason(""); await load();
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  }

  const bar = (c, m) => Math.min((c / (m || 1)) * 100, 100);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-2xl font-bold text-gray-900">Inventory</h1><p className="text-gray-600">Monitor and manage your stock levels</p></div>
          <button type="button" onClick={load} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm rounded-md bg-white hover:bg-gray-50"><FiRefreshCw className="mr-2 h-4 w-4" />Refresh</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[{l:"In Stock",v:summary.inStock,c:"text-green-600",b:"bg-green-100",i:<FiCheckCircle className="h-6 w-6 text-green-600"/>},{l:"Low Stock",v:summary.low,c:"text-yellow-600",b:"bg-yellow-100",i:<FiAlertTriangle className="h-6 w-6 text-yellow-600"/>},{l:"Out of Stock",v:summary.out,c:"text-red-600",b:"bg-red-100",i:<FiTrendingDown className="h-6 w-6 text-red-600"/>},{l:"Total Value",v:`$${summary.totalValue.toLocaleString(undefined,{maximumFractionDigits:0})}`,c:"text-blue-600",b:"bg-blue-100",i:<FiTrendingUp className="h-6 w-6 text-blue-600"/>}].map((x)=>(
            <div key={x.l} className="bg-white rounded-lg shadow-sm p-6"><div className="flex items-center"><div className={`p-2 ${x.b} rounded-lg`}>{x.i}</div><div className="ml-4"><p className="text-sm font-medium text-gray-600">{x.l}</p><p className="text-2xl font-bold text-gray-900">{x.v}</p></div></div></div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4"><div className="relative"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" /><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search inventory..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md" /></div></div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden"><table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50"><tr>{["Product","Current Stock","Min/Max","Stock Level","Status","Last Updated"].map(h=><th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">Loading inventory…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">No inventory items yet. Create via POST /api/inventory.</td></tr>
            : filtered.map((item)=>(
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center"><FiPackage className="h-5 w-5 text-gray-500"/></div><div className="ml-4"><div className="text-sm font-medium text-gray-900">{item.name}</div><div className="text-sm text-gray-500">{item.sku}</div></div></div></td>
                <td className="px-6 py-4 text-sm text-gray-900">{item.currentStock}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{item.minStock} / {item.maxStock}</td>
                <td className="px-6 py-4"><div className="w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${item.status==="Good"?"bg-green-500":item.status==="Low"?"bg-yellow-500":"bg-red-500"}`} style={{width:`${bar(item.currentStock,item.maxStock)}%`}}/></div></td>
                <td className="px-6 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.status==="Good"?"text-green-600 bg-green-100":item.status==="Low"?"text-yellow-600 bg-yellow-100":"text-red-600 bg-red-100"}`}>{item.status==="Good"?"In Stock":item.status==="Low"?"Low Stock":"Out of Stock"}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <form onSubmit={onAdjust} className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Quick stock adjustment</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select value={adjustId} onChange={(e)=>setAdjustId(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm" required><option value="">Select item…</option>{items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}</select>
            <input type="number" value={adjustChange} onChange={(e)=>setAdjustChange(e.target.value)} placeholder="Change (+/-)" className="border border-gray-300 rounded-md px-3 py-2 text-sm" required />
            <input type="text" value={adjustReason} onChange={(e)=>setAdjustReason(e.target.value)} placeholder="Reason" className="border border-gray-300 rounded-md px-3 py-2 text-sm" required />
            <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Apply</button>
          </div>
          {msg && <p className={`text-sm ${msg.ok?"text-green-700":"text-red-700"}`}>{msg.text}</p>}
        </form>
        {summary.low > 0 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center"><FiAlertTriangle className="h-5 w-5 text-yellow-400 mr-3" /><div><h3 className="text-sm font-medium text-yellow-800">Low Stock Alert</h3><p className="mt-1 text-sm text-yellow-700">{summary.low} item(s) running low.</p></div></div>}
      </div>
    </AuthenticatedLayout>
  );
}
