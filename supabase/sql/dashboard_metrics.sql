-- Dashboard metrics RPC for AdminDashboard
-- Run this in Supabase Dashboard -> SQL Editor (or convert into migrations if you use Supabase CLI migrations).
--
-- SECURITY NOTE:
-- This function is SECURITY DEFINER (bypasses RLS), so it MUST validate caller identity.
-- It currently checks `auth.jwt()` email against a hard-coded allowlist.
-- Update the allowlist as needed.

create or replace function public.dashboard_metrics(
  start_date date,
  end_date date,
  top_limit int default 5
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  caller_email text;
  range_end timestamp;
  revenue numeric := 0;
  profit numeric := 0;
  margin numeric := 0;
  sales_by_day jsonb := '[]'::jsonb;
  sales_by_category jsonb := '[]'::jsonb;
  top_products jsonb := '[]'::jsonb;
begin
  claims := auth.jwt();
  caller_email := claims->>'email';

  if caller_email is null then
    raise exception 'Unauthorized';
  end if;

  if caller_email not in ('mariyalim2511@gmail.com', 'soniwathmi@gmail.com') then
    raise exception 'Forbidden';
  end if;

  -- include the full end date day
  range_end := (end_date::timestamp + interval '1 day');

  with filtered as (
    select id, created_at, customer_info, items, total
    from public.orders
    where created_at >= start_date::timestamp
      and created_at < range_end
  )
  select coalesce(sum(total), 0)
  into revenue
  from filtered;

  -- Profit = sum over line items: (price - cost_price) * quantity
  with filtered as (
    select items
    from public.orders
    where created_at >= start_date::timestamp
      and created_at < range_end
  ),
  line_items as (
    select jsonb_array_elements(items) as item
    from filtered
  )
  select coalesce(
    sum(
      (
        coalesce((item->>'price')::numeric, 0) -
        coalesce((item->>'cost_price')::numeric, 0)
      ) * coalesce((item->>'quantity')::numeric, 0)
    ),
    0
  )
  into profit
  from line_items;

  if revenue > 0 then
    margin := (profit / revenue) * 100;
  else
    margin := 0;
  end if;

  -- Sales by day
  with filtered as (
    select created_at, total
    from public.orders
    where created_at >= start_date::timestamp
      and created_at < range_end
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', to_char(created_at::date, 'YYYY-MM-DD'),
        'amount', sum_total
      )
      order by day
    ),
    '[]'::jsonb
  )
  into sales_by_day
  from (
    select created_at::date as day, sum(total)::float8 as sum_total
    from filtered
    group by 1
    order by 1
  ) t;

  -- Revenue by category (derived from items snapshots)
  with filtered as (
    select items
    from public.orders
    where created_at >= start_date::timestamp
      and created_at < range_end
  ),
  line_items as (
    select jsonb_array_elements(items) as item
    from filtered
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', name,
        'value', value
      )
      order by value desc
    ),
    '[]'::jsonb
  )
  into sales_by_category
  from (
    select
      coalesce(nullif(item->>'category', ''), 'Uncategorized') as name,
      sum(
        coalesce((item->>'price')::numeric, 0) *
        coalesce((item->>'quantity')::numeric, 0)
      )::float8 as value
    from line_items
    group by 1
    order by 2 desc
  ) t;

  -- Top selling products (derived from items snapshots)
  with filtered as (
    select items
    from public.orders
    where created_at >= start_date::timestamp
      and created_at < range_end
  ),
  line_items as (
    select jsonb_array_elements(items) as item
    from filtered
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product', jsonb_build_object(
          'id', id,
          'name', name,
          'price', price,
          'stock', stock,
          'category', category,
          'description', description,
          'image_url', image_url
        ),
        'count', count
      )
      order by count desc
    ),
    '[]'::jsonb
  )
  into top_products
  from (
    select
      (item->>'id')::text as id,
      max(item->>'name')::text as name,
      max(coalesce((item->>'price')::numeric, 0))::float8 as price,
      max(coalesce((item->>'stock')::numeric, 0))::int as stock,
      max(coalesce(item->>'category', ''))::text as category,
      max(coalesce(item->>'description', ''))::text as description,
      max(coalesce(item->>'image_url', ''))::text as image_url,
      sum(coalesce((item->>'quantity')::numeric, 0))::int as count
    from line_items
    where (item ? 'id')
    group by (item->>'id')
    order by count desc
    limit greatest(1, top_limit)
  ) t;

  return jsonb_build_object(
    'financialStats', jsonb_build_object(
      'revenue', revenue::float8,
      'profit', profit::float8,
      'margin', margin::float8,
      'growth', 0
    ),
    'salesData', sales_by_day,
    'salesByCategory', sales_by_category,
    'topProducts', top_products
  );
end;
$$;
