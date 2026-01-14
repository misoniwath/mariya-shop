import { supabase } from "../lib/supabaseClient";
import { Product, Order, CustomerInfo, CartItem } from "../types";

// Simple in-memory cache
const cache = {
  products: { data: null as Product[] | null, timestamp: 0 },
  productsPublic: { data: null as Product[] | null, timestamp: 0 },
  ordersByKey: new Map<string, { data: Order[]; timestamp: number }>(),
};

const inFlight = {
  ordersByKey: new Map<string, Promise<Order[]>>(),
};

const CACHE_DURATION = 60000; // 1 minute cache for orders
const PRODUCT_CACHE_DURATION = 5 * 60000; // 5 minutes for products

const MAX_ORDERS_PER_QUERY = 2000;

type OrdersPageParams = {
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

type OrdersPageResult = {
  data: Order[];
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type DashboardMetrics = {
  financialStats: {
    revenue: number;
    profit: number;
    margin: number;
    growth: number;
  };
  salesData: { date: string; amount: number }[];
  salesByCategory: { name: string; value: number }[];
  topProducts: { product: Product; count: number }[];
};

function ordersCacheKey(startDate?: string, endDate?: string): string {
  return `${startDate ?? ""}..${endDate ?? ""}`;
}

export const supabaseService = {
  // ----------------------------------------------------------------
  // PRODUCT MANAGEMENT
  // ----------------------------------------------------------------

  async getProductsPublic(forceRefresh = false): Promise<Product[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      cache.productsPublic.data &&
      now - cache.productsPublic.timestamp < PRODUCT_CACHE_DURATION
    ) {
      return cache.productsPublic.data;
    }

    // Customer-facing product list: only fetch fields needed for the store UI.
    // Avoid shipping cost_price (sensitive) and reduce payload size.
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, stock, category, description, image_url")
      .order("name");

    if (error) throw new Error(error.message);

    cache.productsPublic = { data: data || [], timestamp: now };
    return data || [];
  },

  async getProducts(forceRefresh = false): Promise<Product[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      cache.products.data &&
      now - cache.products.timestamp < PRODUCT_CACHE_DURATION
    ) {
      return cache.products.data;
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);

    // Update Cache
    cache.products = { data: data || [], timestamp: now };
    return data || [];
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Invalidate Cache
    cache.products.data = null;
    cache.productsPublic.data = null;
    return data;
  },

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Invalidate Cache
    cache.products.data = null;
    cache.productsPublic.data = null;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) throw new Error(error.message);

    // Invalidate Cache
    cache.products.data = null;
    cache.productsPublic.data = null;
  },

  // ----------------------------------------------------------------
  // ORDER PROCESSING
  // ----------------------------------------------------------------

  async placeOrder(
    customer: CustomerInfo,
    cart: CartItem[],
    paymentMethod: "delivery" | "qr"
  ): Promise<Order> {
    // 1. Calculate Totals
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const deliveryFee = subtotal >= 50 ? 0 : 1.5;
    const total = subtotal + deliveryFee;

    // 2. Prepare Order Object
    const orderId = `ORD-${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;

    const newOrderPayload = {
      id: orderId,
      customer_info: customer,
      items: cart, // Stores full snapshot including cost_price
      total,
      payment_method: paymentMethod,
      status: paymentMethod === "qr" ? "completed" : "pending",
      created_at: new Date().toISOString(),
    };

    // 3. Check Stock & Update
    for (const item of cart) {
      const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock, name")
        .eq("id", item.id)
        .single();

      if (fetchError || !product)
        throw new Error(`Product ${item.name} not found`);

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Only ${product.stock} left.`
        );
      }
    }

    // 4. Insert Order
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert(newOrderPayload)
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    // 5. Decrement Stock
    for (const item of cart) {
      const { error: updateError } = await supabase.rpc("decrement_stock", {
        row_id: item.id,
        quantity: item.quantity,
      });

      // Fallback if RPC doesn't exist (Manual Update)
      if (updateError) {
        const { data: current } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.id)
          .single();
        if (current) {
          await supabase
            .from("products")
            .update({ stock: current.stock - item.quantity })
            .eq("id", item.id);
        }
      }
    }

    // 6. Trigger Notification (Fire and forget)
    // fetch("/api/notify-telegram", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ order: orderData }),
    // }).catch(console.error);

    // Invalidate Caches
    cache.ordersByKey.clear();
    cache.products.data = null;
    cache.productsPublic.data = null;

    return orderData as Order;
  },

  // 🔒 SECURE ORDER PLACEMENT (Uses Edge Function)
  async placeOrderSecure(
    customer: CustomerInfo,
    cart: CartItem[],
    paymentMethod: "delivery" | "qr"
  ): Promise<Order> {
    const { data, error } = await supabase.functions.invoke("create-order", {
      body: { customer, cart, paymentMethod },
    });

    if (error) throw new Error(error.message);

    // Invalidate Caches
    cache.ordersByKey.clear();
    cache.products.data = null;
    cache.productsPublic.data = null;

    return data as Order;
  },

  async getOrders(
    startDate?: string,
    endDate?: string,
    forceRefresh = false
  ): Promise<Order[]> {
    const now = Date.now();
    const key = ordersCacheKey(startDate, endDate);

    const cached = cache.ordersByKey.get(key);
    if (!forceRefresh && cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const pending = inFlight.ordersByKey.get(key);
    if (!forceRefresh && pending) {
      return pending;
    }

    const request = this.fetchOrdersFromDb(startDate, endDate)
      .then((fresh) => {
        cache.ordersByKey.set(key, { data: fresh, timestamp: Date.now() });
        return fresh;
      })
      .finally(() => {
        inFlight.ordersByKey.delete(key);
      });

    inFlight.ordersByKey.set(key, request);
    return request;
  },

  async getOrdersPage(
    params: OrdersPageParams = {}
  ): Promise<OrdersPageResult> {
    const { startDate, endDate, search, limit = 50, offset = 0 } = params;

    let query = supabase
      .from("orders")
      .select(
        "id, created_at, customer_info, items, total, payment_method, status",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const trimmed = (search || "").trim();
    if (trimmed) {
      // Search by order id OR customer name (stored in JSON).
      // Note: PostgREST JSON path filter syntax works with `customer_info->>name`.
      const escaped = trimmed.replace(/,/g, "\\,");
      query = query.or(
        `id.ilike.%${escaped}%,customer_info->>name.ilike.%${escaped}%`
      );
    }

    const from = Math.max(0, offset);
    const to = from + Math.max(1, limit) - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []) as Order[];
    const total = typeof count === "number" ? count : null;
    const hasMore =
      total === null ? rows.length === limit : from + rows.length < total;

    return {
      data: rows,
      total,
      limit,
      offset: from,
      hasMore,
    };
  },

  async getDashboardMetrics(
    startDate: string,
    endDate: string,
    topLimit: number = 5
  ): Promise<DashboardMetrics> {
    const { data, error } = await supabase.rpc("dashboard_metrics", {
      start_date: startDate,
      end_date: endDate,
      top_limit: topLimit,
    });

    if (error) throw new Error(error.message);

    const safe = (data || {}) as Partial<DashboardMetrics>;
    return {
      financialStats: safe.financialStats || {
        revenue: 0,
        profit: 0,
        margin: 0,
        growth: 0,
      },
      salesData: safe.salesData || [],
      salesByCategory: safe.salesByCategory || [],
      topProducts: safe.topProducts || [],
    };
  },

  filterOrdersInMemory(
    orders: Order[],
    startDate?: string,
    endDate?: string
  ): Order[] {
    return orders.filter((order) => {
      const orderDate = new Date(order.created_at);
      if (startDate) {
        const start = new Date(startDate);
        if (orderDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      return true;
    });
  },

  async fetchOrdersFromDb(
    startDate?: string,
    endDate?: string
  ): Promise<Order[]> {
    let query = supabase
      .from("orders")
      .select(
        "id, created_at, customer_info, items, total, payment_method, status"
      )
      .order("created_at", { ascending: false });

    // Optional: Keep DB filtering if we ever want to do a direct fetch outside cache mechanism
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    // SAFETY LIMIT: Always cap rows to prevent statement timeouts on large tables.
    // If you need full exports, implement a server-side export with pagination.
    query = query.limit(MAX_ORDERS_PER_QUERY);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  // ----------------------------------------------------------------
  // ANALYTICS & DASHBOARD
  // ----------------------------------------------------------------

  async getSalesData(
    startDate?: string,
    endDate?: string
  ): Promise<{ date: string; amount: number }[]> {
    const orders = await this.getOrders(startDate, endDate);

    const grouped = orders.reduce((acc, order) => {
      const date = new Date(order.created_at).toLocaleDateString();
      acc[date] = (acc[date] || 0) + order.total;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([date, amount]) => ({
      date,
      amount: amount as number,
    }));
  },

  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    const products = await this.getProducts();
    return products
      .filter((p) => p.stock < threshold)
      .sort((a, b) => a.stock - b.stock);
  },

  async getTopSellingProducts(
    limit: number = 5,
    startDate?: string,
    endDate?: string
  ): Promise<{ product: Product; count: number }[]> {
    const orders = await this.getOrders(startDate, endDate);

    const productSales: Record<string, { product: Product; count: number }> =
      {};

    orders.forEach((order) => {
      const items = order.items as CartItem[];
      items.forEach((item) => {
        if (!productSales[item.id]) {
          productSales[item.id] = { product: item, count: 0 };
        }
        productSales[item.id].count += item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  async getSlowMovingProducts(days: number = 30): Promise<Product[]> {
    const products = await this.getProducts(); // Use Cached Products

    // FETCH DIRECTLY FROM DB for efficiency (avoid fetching all orders if cache is partial)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: orders, error } = await supabase
      .from("orders")
      .select("items")
      .gte("created_at", cutoffDate.toISOString())
      .limit(MAX_ORDERS_PER_QUERY);

    if (error) throw new Error(error.message);

    const soldProductIds = new Set<string>();
    orders?.forEach((order) => {
      const items = order.items as CartItem[];
      items.forEach((item) => soldProductIds.add(item.id));
    });

    return products.filter((p) => !soldProductIds.has(p.id));
  },

  async getReturningCustomerRate(): Promise<number> {
    const orders = await this.getOrders(); // Use Cached Orders
    if (!orders || orders.length === 0) return 0;

    const customers = orders.map(
      (o) => (o.customer_info as CustomerInfo).phone
    );
    const uniqueCustomers = new Set(customers).size;
    const totalOrders = customers.length;

    return uniqueCustomers === 0
      ? 0
      : ((totalOrders - uniqueCustomers) / totalOrders) * 100;
  },

  async getReturningCustomerRateForRange(
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    const orders = await this.getOrders(startDate, endDate);
    if (!orders || orders.length === 0) return 0;

    const customers = orders.map(
      (o) => (o.customer_info as CustomerInfo).phone
    );
    const uniqueCustomers = new Set(customers).size;
    const totalOrders = customers.length;

    return uniqueCustomers === 0
      ? 0
      : ((totalOrders - uniqueCustomers) / totalOrders) * 100;
  },

  async getSalesByCategory(
    startDate?: string,
    endDate?: string
  ): Promise<{ name: string; value: number }[]> {
    const orders = await this.getOrders(startDate, endDate);
    const categorySales: Record<string, number> = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const cat = item.category || "Uncategorized";
        categorySales[cat] =
          (categorySales[cat] || 0) + item.price * item.quantity;
      });
    });

    return Object.entries(categorySales).map(([name, value]) => ({
      name,
      value,
    }));
  },

  async getFinancialStats(
    startDate?: string,
    endDate?: string
  ): Promise<{
    revenue: number;
    profit: number;
    margin: number;
    growth: number;
  }> {
    const orders = await this.getOrders(startDate, endDate);

    let revenue = 0;
    let cost = 0;

    orders.forEach((order) => {
      revenue += order.total;
      order.items.forEach((item) => {
        const itemCost = item.cost_price || 0;
        cost += itemCost * item.quantity;
      });
    });

    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const growth = 0;

    return { revenue, profit, margin, growth };
  },

  async testTelegram(): Promise<boolean> {
    // Deprecated: Telegram notifications are now handled by the Edge Function
    return true;
  },
};
