import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Search,
  Plus,
  Trash2,
  Edit2,
  BrainCircuit,
  X,
  Save,
} from "lucide-react";
import { supabaseService } from "../services/supabaseService";
import { geminiService } from "../services/geminiService";
import { Product } from "../types";

const InventoryManagement: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const CATEGORY_OPTIONS = [
    "night cream",
    "serum",
    "foam",
    "sunscreen",
    "mask",
  ] as const;

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.name || !editingProduct.category) {
      setError("Name and category are required.");
      return;
    }
    if (editingProduct.price === undefined || editingProduct.price < 0) {
      setError("Price must be zero or higher.");
      return;
    }
    if (
      editingProduct.cost_price === undefined ||
      editingProduct.cost_price < 0
    ) {
      setError("Cost Price must be zero or higher.");
      return;
    }
    if (editingProduct.stock === undefined || editingProduct.stock < 0) {
      setError("Stock must be zero or higher.");
      return;
    }
    if (!editingProduct.image_url) {
      setError("Please select a product image.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingProduct.id) {
        await supabaseService.updateProduct(editingProduct.id, editingProduct);
      } else {
        await supabaseService.addProduct(editingProduct as Omit<Product, "id">);
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!editingProduct?.name) return;
    setIsGenerating(true);
    const desc = await geminiService.generateDescription(editingProduct.name);
    setEditingProduct({ ...editingProduct, description: desc });
    setIsGenerating(false);
  };

  const openAddModal = () => {
    setEditingProduct({
      name: "",
      price: 0,
      cost_price: 0,
      stock: 0,
      category: "",
      description: "",
      image_url: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this product?")) {
      setError(null);
      try {
        await supabaseService.deleteProduct(id);
        loadProducts();
      } catch (err: any) {
        setError(err.message || "Failed to delete product");
      }
    }
  };

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Inventory Control
          </h1>
          <p className="text-slate-500">
            Manage stock levels and product details.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
          <Plus size={20} />
          Add New Product
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="flex-grow relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-50 text-red-700 text-sm font-medium border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Cost</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">In Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? [1, 2, 3].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 bg-slate-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                : filteredProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <img
                            src={p.image_url}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                          />
                          <div>
                            <div className="font-bold text-slate-800">
                              {p.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate max-w-xs">
                              {p.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        ${(p.cost_price || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.stock < 5 ? "bg-red-500" : "bg-green-500"
                            }`}></span>
                          <span
                            className={`text-sm font-bold ${
                              p.stock < 5 ? "text-red-600" : "text-slate-700"
                            }`}>
                            {p.stock} units
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition">
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h2 className="text-xl font-bold">
                {editingProduct.id ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition">
                <X />
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 overflow-hidden">
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Product Name
                  </label>
                  <input
                    required
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Price ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Cost Price ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={editingProduct.cost_price || 0}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        cost_price: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Initial Stock
                  </label>
                  <input
                    required
                    type="number"
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Category
                  </label>
                  <select
                    required
                    value={editingProduct.category || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="" disabled>
                      Select a category
                    </option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string | null;
                        if (result) {
                          setEditingProduct({
                            ...editingProduct,
                            image_url: result,
                          });
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {editingProduct.image_url && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-1">Preview:</p>
                      <img
                        src={editingProduct.image_url}
                        alt="Preview"
                        className="w-32 h-32 rounded-xl object-cover border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-slate-700">
                      Description
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !editingProduct.name}
                      className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-50">
                      <BrainCircuit size={14} />
                      {isGenerating ? "Generating..." : "AI Generate"}
                    </button>
                  </div>
                  <textarea
                    required
                    rows={4}
                    value={editingProduct.description}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4 flex-shrink-0">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-grow bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                  <Save size={20} />
                  {saving ? "Saving..." : "Save Product"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-grow bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;
