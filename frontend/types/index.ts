export interface Product {
  id: number
  name: string
  wood_type: string
  size: string
  price: number
  image_url?: string
  stock_quantity: number
  description?: string
  availability?: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: number
  phone?: string
  name?: string
  email?: string
  preferred_channel?: string
  location?: string
  created_at: string
}

export type LeadStatus = 'hot' | 'warm' | 'cold' | 'converted' | 'lost' | 'new'

export interface Lead {
  id: number
  customer_id?: number
  source_channel: string
  status: LeadStatus
  interest_level?: string
  captured_at: string
  customer?: Customer
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  subtotal: number
  product?: Product
}

export interface Order {
  id: number
  customer_id?: number
  source_channel: string
  status: OrderStatus
  total_amount: number
  delivery_location?: string
  payment_status?: string
  created_at: string
  items: OrderItem[]
  customer?: Customer
}

export type MessageSender = 'customer' | 'assistant' | 'admin' | 'system'

export interface ConversationMessage {
  id: number
  session_id: number
  sender: MessageSender
  message_type: string
  content: string
  is_read: boolean
  created_at: string
}

export interface ConversationSession {
  id: number
  customer_id?: number
  channel: string
  status: string
  ai_enabled?: boolean
  last_message_at?: string
  unread_count?: number
  created_at: string
  customer?: Customer
  last_message?: ConversationMessage
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: string
}

export interface AuthTokens {
  access_token: string
  token_type: string
}

export interface DashboardStats {
  active_sessions: number
  pending_human_sessions: number
  total_sessions_today: number
  total_leads: number
  hot_leads: number
  warm_leads: number
  cold_leads: number
  converted_leads: number
  new_leads_today: number
  pending_orders: number
  confirmed_orders: number
  total_orders: number
  total_revenue: number
  revenue_today: number
  total_customers: number
  new_customers_today: number
  low_stock_products: number
  out_of_stock_products: number
}
