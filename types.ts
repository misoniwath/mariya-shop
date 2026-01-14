export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  cost_price?: number; // Admin-only field; optional for customer-facing fetches
  stock: number;
  category: string;
  image_url: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface Order {
  id: string;
  customer_info: CustomerInfo;
  items: CartItem[];
  total: number;
  payment_method: "delivery" | "qr";
  status: "pending" | "completed" | "cancelled";
  created_at: string;
}

export interface SalesRecord {
  date: string;
  amount: number;
  orders: number;
}

export enum UserRole {
  CUSTOMER = "customer",
  ADMIN = "admin",
}
