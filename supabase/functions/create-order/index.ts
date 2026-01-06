import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Receive Data from Client
    const { customer, cart, paymentMethod } = await req.json();

    // Initialize Supabase Client (Admin context)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let calculatedTotal = 0;
    const finalItems = [];

    // 2. Loop through cart and fetch REAL prices from DB
    for (const item of cart) {
      const { data: product, error } = await supabaseClient
        .from("products")
        .select("price, stock, name, cost_price")
        .eq("id", item.id)
        .single();

      if (error || !product) {
        throw new Error(`Product not found: ${item.id}`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      // Use the DATABASE price, ignore the client price
      const lineTotal = product.price * item.quantity;
      calculatedTotal += lineTotal;

      // Add to final items list with verified data
      finalItems.push({
        ...item,
        price: product.price, // Overwrite with secure price
        cost_price: product.cost_price,
      });
    }

    // 3. Apply Delivery Fee Logic (Server Side)
    const deliveryFee = calculatedTotal >= 50 ? 0 : 1.5;
    const finalTotal = calculatedTotal + deliveryFee;

    // 4. Generate Order ID
    const orderId = `ORD-${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")}`;

    // 5. Insert Order
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        id: orderId,
        customer_info: customer,
        items: finalItems,
        total: finalTotal,
        payment_method: paymentMethod,
        status: paymentMethod === "qr" ? "completed" : "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 6. Decrement Stock
    for (const item of finalItems) {
      const { error: stockError } = await supabaseClient.rpc(
        "decrement_stock",
        {
          row_id: item.id,
          quantity: item.quantity,
        }
      );

      if (stockError) {
        console.error(
          `Failed to update stock via RPC for item ${item.id}:`,
          stockError
        );
        // Fallback: Direct update
        const { data: currentProduct } = await supabaseClient
          .from("products")
          .select("stock")
          .eq("id", item.id)
          .single();

        if (currentProduct) {
          const newStock = currentProduct.stock - item.quantity;
          await supabaseClient
            .from("products")
            .update({ stock: newStock })
            .eq("id", item.id);
          console.log(
            `Fallback stock update for ${item.id}: ${currentProduct.stock} -> ${newStock}`
          );
        }
      }
    }

    // 7. Send Telegram Notification
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    console.log(
      `Telegram Debug: Token Exists? ${!!telegramBotToken}, ChatID Exists? ${!!telegramChatId}`
    );

    if (telegramBotToken && telegramChatId) {
      const itemsList = finalItems
        .map(
          (i) =>
            `• ${i.name} (x${i.quantity}) - $${(i.price * i.quantity).toFixed(
              2
            )}`
        )
        .join("\n");

      const message = `
<b>🚀 NEW POS ORDER RECEIVED</b>
----------------------------
<b>Order ID:</b> <code>${order.id}</code>
<b>Time:</b> ${new Date(order.created_at).toLocaleString()}
<b>Payment:</b> ${
        order.payment_method === "qr"
          ? "✅ PAID (ABA QR)"
          : "🚚 PAY ON DELIVERY"
      }

<b>👤 CUSTOMER INFO:</b>
• <b>Name:</b> ${order.customer_info?.name || "-"}
• <b>Phone:</b> ${order.customer_info?.phone || "-"}
• <b>Email:</b> ${order.customer_info?.email || "-"}
• <b>Address:</b> ${order.customer_info?.address || "-"}

<b>📦 CART SUMMARY:</b>
${itemsList}

<b>💰 TOTAL AMOUNT:</b> <b>$${Number(order.total || 0).toFixed(2)}</b>
----------------------------
<i>📢 Action Required: Please prepare for delivery!</i>
      `;

      await fetch(
        `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            parse_mode: "HTML",
          }),
        }
      ).catch((err) => console.error("Telegram notification failed:", err));
    }

    return new Response(JSON.stringify(order), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
