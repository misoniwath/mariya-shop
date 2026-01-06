import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  LogOut,
  User,
  Store,
} from "lucide-react";
import CustomerStore from "./pages/CustomerStore";
import AdminDashboard from "./pages/AdminDashboard";
import InventoryManagement from "./pages/InventoryManagement";
import OrderHistory from "./pages/OrderHistory";
import AuthPage from "./pages/AuthPage";
import { UserRole } from "./types";
import { supabase } from "./lib/supabaseClient";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdminAuthenticated(!!session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdminAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Analytics />
      <div className="min-h-screen flex flex-col">
        {/* Simple Navigation Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-indigo-600 p-0.8 rounded-lg">
                <Store className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">
                Mariya<span className="text-indigo-600">Shop</span>
              </span>
            </Link>

            <nav className="flex items-center space-x-6">
              <Link
                to="/"
                className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">
                Store
              </Link>
              {isAdminAuthenticated ? (
                <>
                  <Link
                    to="/admin"
                    className="text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1">
                    <LayoutDashboard size={18} />{" "}
                    <span className="hidden md:inline">Dashboard</span>
                  </Link>
                  <Link
                    to="/inventory"
                    className="text-slate-600 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1">
                    <Package size={18} />{" "}
                    <span className="hidden md:inline">Stock</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-slate-600 hover:text-red-600 font-medium transition-colors flex items-center gap-1">
                    <LogOut size={18} />{" "}
                    <span className="hidden md:inline">Logout</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="text-indigo-600 font-semibold border border-indigo-600 px-4 py-1.5 rounded-full hover:bg-indigo-50 transition-colors">
                  Admin Login
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<CustomerStore />} />
            <Route
              path="/auth"
              element={
                <AuthPage onAuthSuccess={() => setIsAdminAuthenticated(true)} />
              }
            />
            <Route
              path="/admin"
              element={
                isAdminAuthenticated ? (
                  <AdminDashboard />
                ) : (
                  <Navigate to="/auth" />
                )
              }
            />
            <Route
              path="/admin/orders"
              element={
                isAdminAuthenticated ? (
                  <OrderHistory />
                ) : (
                  <Navigate to="/auth" />
                )
              }
            />
            <Route
              path="/inventory"
              element={
                isAdminAuthenticated ? (
                  <InventoryManagement />
                ) : (
                  <Navigate to="/auth" />
                )
              }
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
