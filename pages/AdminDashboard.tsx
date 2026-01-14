import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import { supabaseService } from "../services/supabaseService";
import { useNavigate } from "react-router-dom";
import type { Order, Product } from "../types";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesData, setSalesData] = useState<
    { date: string; amount: number }[]
  >([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<
    { product: Product; count: number }[]
  >([]);
  const [slowMovers, setSlowMovers] = useState<Product[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<
    { name: string; value: number }[]
  >([]);
  const [financialStats, setFinancialStats] = useState<{
    revenue: number;
    profit: number;
    margin: number;
    growth: number;
  }>({ revenue: 0, profit: 0, margin: 0, growth: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  const handlePresetChange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersPage, lowStockRes, slowRes] = await Promise.all([
        supabaseService.getOrdersPage({
          startDate: dateRange.start,
          endDate: dateRange.end,
          limit: 200,
          offset: 0,
        }),
        supabaseService.getLowStockProducts(10),
        supabaseService.getSlowMovingProducts(30),
      ]);

      setOrders(ordersPage.data);
      setLowStockProducts(lowStockRes);
      setSlowMovers(slowRes);

      // Prefer server-side metrics (fast for large datasets)
      try {
        const metrics = await supabaseService.getDashboardMetrics(
          dateRange.start,
          dateRange.end,
          5
        );
        setSalesData(metrics.salesData);
        setSalesByCategory(metrics.salesByCategory);
        setTopProducts(metrics.topProducts);
        setFinancialStats(metrics.financialStats);
      } catch {
        // Fallback so the dashboard still works before SQL RPC is deployed.
        const [salesRes, topRes, categoryRes, financialRes] = await Promise.all(
          [
            supabaseService.getSalesData(dateRange.start, dateRange.end),
            supabaseService.getTopSellingProducts(
              5,
              dateRange.start,
              dateRange.end
            ),
            supabaseService.getSalesByCategory(dateRange.start, dateRange.end),
            supabaseService.getFinancialStats(dateRange.start, dateRange.end),
          ]
        );

        setSalesData(salesRes);
        setTopProducts(topRes);
        setSalesByCategory(categoryRes);
        setFinancialStats(financialRes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Order ID", "Date", "Customer", "Total", "Status"];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.created_at).toLocaleDateString(),
      o.customer_info.name,
      o.total.toFixed(2),
      o.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `sales_report_${dateRange.start}_${dateRange.end}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = [
    {
      label: "Total Revenue",
      value: `$${financialStats.revenue.toFixed(2)}`,
      subValue: (
        <span
          className={`flex items-center text-xs font-bold ${
            financialStats.growth >= 0 ? "text-emerald-600" : "text-red-600"
          }`}>
          {financialStats.growth >= 0 ? (
            <ArrowUpRight size={12} />
          ) : (
            <ArrowDownRight size={12} />
          )}
          {Math.abs(financialStats.growth).toFixed(1)}%
        </span>
      ),
      icon: DollarSign,
      color: "indigo",
    },
    {
      label: "Net Profit",
      value: `$${financialStats.profit.toFixed(2)}`,
      subValue: <span className="text-xs text-slate-400">After costs</span>,
      icon: Wallet,
      color: "emerald",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Shop Performance
          </h1>
          <p className="text-slate-500">Real-time overview of your business.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Presets */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => handlePresetChange(7)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition">
              7D
            </button>
            <button
              onClick={() => handlePresetChange(30)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition">
              30D
            </button>
            <button
              onClick={() => handlePresetChange(90)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition">
              3M
            </button>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
              className="text-sm text-slate-600 outline-none bg-transparent w-28 md:w-32"
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
              className="text-sm text-slate-600 outline-none bg-transparent w-28 md:w-32"
            />
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              title="Export CSV">
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {error && (
          <div className="md:col-span-2 lg:col-span-4 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-indigo-100 transition">
            <div className={`p-3 rounded-xl bg-slate-50 text-indigo-600`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stat.value}
              </h3>
              {stat.subValue}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Revenue Trend</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366f1"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAmt)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Mix (Pie Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4">Revenue by Category</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value">
                  {salesByCategory.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Shop Health Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ShieldAlert className="text-amber-500" size={20} />
            Low Stock Alerts
          </h3>
          <div className="space-y-3">
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                All stock levels healthy.
              </p>
            ) : (
              lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[150px]">
                    {p.name}
                  </span>
                  <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-1 rounded-full">
                    {p.stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="text-emerald-500" size={20} />
            Top Sellers
          </h3>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No sales data yet.
              </p>
            ) : (
              topProducts.map((item, idx) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">
                      {item.product.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    {item.count} sold
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow Movers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <ShoppingBag className="text-slate-400" size={20} />
            Slow Movers (30d)
          </h3>
          <div className="space-y-3">
            {slowMovers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Everything is selling!
              </p>
            ) : (
              slowMovers.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg transition">
                  <span className="text-sm text-slate-600 truncate max-w-[180px]">
                    {p.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">
                    Stock: {p.stock}
                  </span>
                </div>
              ))
            )}
            {slowMovers.length > 5 && (
              <p className="text-xs text-center text-indigo-600 font-medium cursor-pointer hover:underline">
                + {slowMovers.length - 5} more items
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="font-bold text-lg">Recent Transactions</h3>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition"
            />
            <button
              onClick={() => navigate("/admin/orders")}
              className="text-indigo-600 font-semibold text-sm hover:underline whitespace-nowrap">
              View All History
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">#</th>
                <th className="px-6 py-4 font-semibold">Order ID</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.filter(
                (o) =>
                  o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  o.customer_info.name
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
              ).length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-slate-400 italic">
                    {orders.length === 0
                      ? "No orders recorded yet."
                      : "No matching orders found."}
                  </td>
                </tr>
              ) : (
                orders
                  .filter(
                    (o) =>
                      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.customer_info.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                  )
                  .slice(0, 6)
                  .map((order, i) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 font-semibold">
                        {i + 1}
                      </td>
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
                        {new Date(order.created_at).toLocaleDateString()}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
