import { supabase } from "../lib/supabaseClient";
import { Product, Order, CustomerInfo, CartItem } from "../types";

export const supabaseService = {
  // ----------------------------------------------------------------
  // PRODUCT MANAGEMENT
  // ----------------------------------------------------------------

  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);
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
    return data;
  },

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    const { data, error } = await supabase
      .from("products")
      .insert(product)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) throw new Error(error.message);
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
    return data as Order;
  },

  async getOrders(startDate?: string, endDate?: string): Promise<Order[]> {
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

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
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .lt("stock", threshold)
      .order("stock", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getTopSellingProducts(
    limit: number = 5
  ): Promise<{ product: Product; count: number }[]> {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("items");
    if (error) throw new Error(error.message);

    const productSales: Record<string, { product: Product; count: number }> =
      {};

    orders?.forEach((order) => {
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
    const { data: products } = await supabase.from("products").select("*");
    if (!products) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: orders } = await supabase
      .from("orders")
      .select("items")
      .gte("created_at", cutoffDate.toISOString());

    const soldProductIds = new Set<string>();
    orders?.forEach((order) => {
      const items = order.items as CartItem[];
      items.forEach((item) => soldProductIds.add(item.id));
    });

    return products.filter((p) => !soldProductIds.has(p.id));
  },

  async getReturningCustomerRate(): Promise<number> {
    const { data: orders } = await supabase
      .from("orders")
      .select("customer_info");
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
