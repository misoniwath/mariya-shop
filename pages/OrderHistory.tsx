import React, { useState, useEffect } from "react";
import { supabaseService } from "../services/supabaseService";
import { Order } from "../types";
import { Calendar, Search } from "lucide-react";

const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  useEffect(() => {
    fetchOrders();
  }, [dateFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // If dates are provided, use them. Otherwise, fetch all (or recent large batch)
      const data = await supabaseService.getOrders(
        dateFilter.start || undefined,
        dateFilter.end || undefined
      );
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_info.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Order History</h1>
          <p className="text-slate-500 text-sm">
            View and search all past transactions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            Loading orders...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Order ID</th>
                  <th className="px-6 py-4 font-semibold">Customer</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Items</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-slate-400 italic">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-bold">
                        {order.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold">
                          {order.customer_info.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {order.customer_info.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm max-w-xs">
                        <div className="line-clamp-2 text-slate-600 text-xs">
                          {order.items
                            .map((i) => `${i.name} (x${i.quantity})`)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">
                        ${order.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            order.payment_method === "qr"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                          {order.payment_method === "qr" ? "ABA QR" : "COD"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
