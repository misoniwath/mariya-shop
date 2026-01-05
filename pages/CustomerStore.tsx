import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Package,
  Store,
  CreditCard,
  Truck,
  QrCode,
  AlertCircle,
  Mail,
  Phone,
  User as UserIcon,
  MapPin,
  X,
} from "lucide-react";
import { supabaseService } from "../services/supabaseService";
import { Product, CartItem, CustomerInfo } from "../types";

const CustomerStore: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"delivery" | "qr">(
    "delivery"
  );
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<
    "all" | "night cream" | "serum" | "foam" | "sunscreen" | "mask"
  >("all");
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseService.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(
            1,
            Math.min(item.quantity + delta, item.stock)
          );
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const deliveryFee = subtotal >= 50 ? 0 : 1.5;
  const total = subtotal + deliveryFee;

  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category.toLowerCase() === activeCategory);
  }, [products, activeCategory]);

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!customer.name || !customer.phone || !customer.address) {
      setError("Please fill in Name, Phone, and Address.");
      return;
    }
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setError(null);
    setIsCheckingOut(true);
    try {
      const order = await supabaseService.placeOrderSecure(
        customer,
        cart,
        paymentMethod
      );
      setOrderComplete(order.id);
      setCart([]);
      loadProducts();
    } catch (err: any) {
      setError(err.message || "Failed to place order");
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-3xl shadow-2xl text-center animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 p-5 rounded-full border-4 border-green-50">
            <CheckCircle className="text-green-600 w-14 h-14" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold mb-2 text-slate-800">
          Order Confirmed!
        </h2>
        <p className="text-slate-500 mb-6">
          Order ID:{" "}
          <span className="font-mono font-bold text-indigo-600 px-2 py-1 bg-indigo-50 rounded-lg">
            {orderComplete}
          </span>
        </p>
        <div className="bg-slate-50 p-4 rounded-2xl mb-8 text-sm text-slate-600 text-left space-y-2">
          <p className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" /> Stock has been
            updated.
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" /> Shop owner
            notified via Telegram.
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle size={14} className="text-green-500" /> Preparation in
            progress.
          </p>
        </div>
        <button
          onClick={() => {
            setOrderComplete(null);
            setPaymentMethod("delivery");
          }}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all hover:shadow-lg active:scale-95">
          Return to Store
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col lg:flex-row gap-10">
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Store className="text-indigo-600" />
            Skincare Collection
          </h1>
          <div className="text-sm text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            {products.length} Products Available
          </div>
        </div>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: "all", label: "All" },
            { id: "night cream", label: "Night Cream" },
            { id: "serum", label: "Serum" },
            { id: "foam", label: "Foam" },
            { id: "sunscreen", label: "Sunscreen" },
            { id: "mask", label: "Mask" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeCategory === cat.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
              }`}>
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-80 bg-slate-200 rounded-2xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all group relative flex flex-col">
                <div
                  className="relative h-56 overflow-hidden cursor-pointer"
                  onClick={() => setSelectedProduct(product)}>
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-indigo-600 shadow-sm uppercase tracking-wider border border-indigo-100">
                      {product.category}
                    </span>
                  </div>
                  {product.stock === 0 ? (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[2px]">
                      <span className="bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-sm tracking-tighter shadow-xl">
                        OUT OF STOCK
                      </span>
                    </div>
                  ) : product.stock < 10 ? (
                    <div className="absolute bottom-3 right-3 bg-red-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold animate-pulse shadow-sm">
                      Only {product.stock} left!
                    </div>
                  ) : null}
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <h3
                      className="text-lg font-bold text-slate-800 line-clamp-1 cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => setSelectedProduct(product)}>
                      {product.name}
                    </h3>
                    <span className="text-indigo-600 font-black whitespace-nowrap ml-2">
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2 h-10 leading-relaxed flex-grow">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="text-xs font-bold text-indigo-600 hover:underline">
                      View Details
                    </button>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                      className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-100">
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Cart Toggle */}
      {!isCartOpen && cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-500/50 animate-bounce">
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-indigo-600">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          </div>
        </button>
      )}

      {/* Checkout Sidebar */}
      <div
        className={`fixed inset-0 z-50 lg:static lg:z-auto bg-white lg:bg-transparent lg:w-[420px] w-full transition-transform duration-300 ${
          isCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } ${isCartOpen ? "block" : "hidden lg:block"}`}>
        <div className="h-full lg:h-auto overflow-y-auto lg:overflow-visible bg-white lg:bg-transparent lg:rounded-3xl lg:border lg:border-slate-200 p-6 lg:p-8 lg:sticky lg:top-24 shadow-2xl lg:shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black flex items-center gap-3 text-slate-800">
              <ShoppingCart size={24} className="text-indigo-600" />
              Order
            </h2>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow-lg shadow-indigo-100 uppercase tracking-widest">
                {cart.reduce((a, b) => a + b.quantity, 0)} Items
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="lg:hidden p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Package className="mx-auto text-slate-200 w-16 h-16 mb-4" />
              <p className="text-slate-400 font-medium">Your basket is empty</p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-4 text-indigo-600 text-sm font-bold hover:underline lg:hidden">
                Browse Products
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Item List */}
              <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center group">
                    <div className="relative">
                      <img
                        src={item.image_url}
                        className="w-14 h-14 rounded-2xl object-cover bg-slate-100 border border-slate-100"
                      />
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 rounded-md hover:bg-white transition shadow-sm">
                            <Minus size={12} />
                          </button>
                          <span className="text-[10px] font-black w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded-md hover:bg-white transition shadow-sm">
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-xs font-bold text-indigo-600/80">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-200 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-6 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Subtotal</span>
                  <span className="text-slate-800 font-bold">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">
                    Delivery Fee
                  </span>
                  <span
                    className={`font-bold ${
                      deliveryFee === 0 ? "text-green-600" : "text-slate-800"
                    }`}>
                    {deliveryFee === 0 ? "Free" : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="border-t border-slate-200 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-800 font-black">Total</span>
                  <span className="text-2xl font-black text-indigo-600">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Truck size={18} className="text-indigo-600" /> Delivery
                  Details
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <UserIcon
                      size={14}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      placeholder="Full Name"
                      value={customer.name}
                      onChange={(e) =>
                        setCustomer({ ...customer, name: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Mail
                      size={14}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      placeholder="Email Address (optional)"
                      type="email"
                      value={customer.email}
                      onChange={(e) =>
                        setCustomer({ ...customer, email: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none"
                    />
                  </div>
                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      placeholder="Phone Number"
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none"
                    />
                  </div>
                  <div className="relative">
                    <MapPin
                      size={14}
                      className="absolute left-4 top-4 text-slate-400"
                    />
                    <textarea
                      placeholder="Shipping Address"
                      rows={2}
                      value={customer.address}
                      onChange={(e) =>
                        setCustomer({ ...customer, address: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={18} className="text-indigo-600" /> Payment
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("delivery")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                      paymentMethod === "delivery"
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                        : "border-slate-100 text-slate-400 hover:bg-slate-50"
                    }`}>
                    <Truck size={24} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                      COD Delivery
                    </span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("qr")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                      paymentMethod === "qr"
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                        : "border-slate-100 text-slate-400 hover:bg-slate-50"
                    }`}>
                    <QrCode size={24} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                      ABA QR Pay
                    </span>
                  </button>
                </div>
              </div>

              {/* Payment Flow */}
              {paymentMethod === "qr" && (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-3xl text-center border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-center gap-2 text-[10px] font-black text-indigo-700 mb-6 bg-white py-1 px-3 rounded-full border border-indigo-100 inline-flex mx-auto">
                    <QrCode size={12} /> SCAN WITH ABA MOBILE
                  </div>
                  <div className="bg-white p-5 rounded-3xl inline-block shadow-xl border border-indigo-50 mb-6 group relative">
                    <div className="w-40 h-60 bg-slate-50 flex items-center justify-center border-4 border-slate-50 rounded-2xl overflow-hidden">
                      <img
                        src="/mariya-shop-qr.jpg"
                        alt="ABA QR Code"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-indigo-600 font-medium mb-6 flex items-start justify-center gap-2 bg-indigo-50/50 p-4 rounded-2xl text-left border border-indigo-100/50">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Scan the QR above and pay{" "}
                      <b className="font-black text-indigo-800">
                        ${total.toFixed(2)}
                      </b>
                      . Once finished, click "I have paid" below to notify the
                      shop owner.
                    </span>
                  </div>
                  <button
                    onClick={() => handleCheckout()}
                    disabled={isCheckingOut}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3">
                    {isCheckingOut ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>{" "}
                        Verifying Payment...
                      </span>
                    ) : (
                      <>
                        <CheckCircle size={20} /> I HAVE PAID
                      </>
                    )}
                  </button>
                </div>
              )}

              {paymentMethod === "delivery" && (
                <button
                  onClick={() => handleCheckout()}
                  disabled={isCheckingOut}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3">
                  {isCheckingOut ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>{" "}
                      Placing Order...
                    </span>
                  ) : (
                    <>Confirm Order (${total.toFixed(2)})</>
                  )}
                </button>
              )}

              <p className="text-[10px] text-slate-400 text-center font-medium">
                By ordering, you agree to our Terms of Service.
                <br />
                Stock and notifications update in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
            <div className="md:w-1/2 h-64 md:h-auto relative bg-slate-100">
              <img
                src={selectedProduct.image_url}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 left-4 bg-white/80 backdrop-blur p-2 rounded-full text-slate-600 hover:bg-white transition-colors md:hidden">
                <X size={20} />
              </button>
            </div>
            <div className="md:w-1/2 p-8 flex flex-col relative">
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors hidden md:block">
                <X size={24} />
              </button>

              <div className="mb-auto">
                <span className="inline-block bg-indigo-50 text-indigo-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                  {selectedProduct.category}
                </span>
                <h2 className="text-2xl font-black text-slate-800 mb-2">
                  {selectedProduct.name}
                </h2>
                <div className="text-2xl font-black text-indigo-600 mb-6">
                  ${selectedProduct.price.toFixed(2)}
                </div>
                <div className="prose prose-sm text-slate-500 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {selectedProduct.description}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-500">
                    Availability
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      selectedProduct.stock > 0
                        ? "text-green-600"
                        : "text-red-500"
                    }`}>
                    {selectedProduct.stock > 0
                      ? `${selectedProduct.stock} in stock`
                      : "Out of Stock"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  disabled={selectedProduct.stock === 0}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-95 flex items-center justify-center gap-2">
                  <Plus size={20} />
                  {selectedProduct.stock === 0 ? "Out of Stock" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerStore;
