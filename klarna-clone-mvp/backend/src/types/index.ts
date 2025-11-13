// Type definitions for Klarna Clone MVP

export interface User {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  ssn_last_4?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  kyc_status: KYCStatus;
  account_status: AccountStatus;
  credit_limit: number;
  available_credit: number;
  created_at: Date;
  updated_at: Date;
}

export interface Merchant {
  id: string;
  business_name: string;
  legal_entity_name: string;
  email: string;
  phone?: string;
  website?: string;
  business_type?: string;
  tax_id?: string;
  business_address_line1?: string;
  business_address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  kyb_status: KYBStatus;
  account_status: AccountStatus;
  fee_percentage: number;
  settlement_schedule: SettlementSchedule;
  api_key_hash?: string;
  webhook_url?: string;
  webhook_secret?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  merchant_id: string;
  order_total: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  net_amount: number;
  currency: string;
  payment_plan: PaymentPlan;
  installments?: number;
  order_status: OrderStatus;
  shipping_address?: Address;
  billing_address?: Address;
  merchant_order_id?: string;
  credit_check_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_description?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_url?: string;
  image_url?: string;
  created_at: Date;
}

export interface PaymentSchedule {
  id: string;
  order_id: string;
  user_id: string;
  installment_number: number;
  total_installments: number;
  amount: number;
  due_date: Date;
  payment_status: PaymentStatus;
  paid_date?: Date;
  payment_method_id?: string;
  retry_count: number;
  last_retry_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  payment_schedule_id: string;
  user_id: string;
  order_id: string;
  amount: number;
  payment_method_id?: string;
  payment_processor?: string;
  processor_transaction_id?: string;
  payment_status: PaymentStatus;
  failure_reason?: string;
  payment_date: Date;
  created_at: Date;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  is_primary: boolean;
  card_last_4?: string;
  card_brand?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  bank_name?: string;
  bank_account_last_4?: string;
  bank_account_type?: BankAccountType;
  processor_token?: string;
  processor?: string;
  is_verified: boolean;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreditCheck {
  id: string;
  user_id: string;
  order_id?: string;
  check_type: CreditCheckType;
  bureau?: string;
  credit_score?: number;
  decision: CreditDecision;
  decline_reason?: string;
  approved_amount?: number;
  risk_score?: number;
  fraud_score?: number;
  credit_limit?: number;
  interest_rate?: number;
  bureau_response?: any;
  reviewer_id?: string;
  review_notes?: string;
  created_at: Date;
}

export interface FraudCheck {
  id: string;
  user_id?: string;
  order_id?: string;
  check_type: string;
  risk_score: number;
  decision: FraudDecision;
  fraud_signals?: any;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: any;
  created_at: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

// Enums
export enum KYCStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export enum KYBStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED'
}

export enum PaymentPlan {
  PAY_IN_4 = 'PAY_IN_4',
  PAY_IN_30 = 'PAY_IN_30',
  FINANCING = 'FINANCING'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethodType {
  CARD = 'CARD',
  BANK_ACCOUNT = 'BANK_ACCOUNT'
}

export enum BankAccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS'
}

export enum CreditCheckType {
  SOFT = 'SOFT',
  HARD = 'HARD'
}

export enum CreditDecision {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  MANUAL_REVIEW = 'MANUAL_REVIEW'
}

export enum FraudDecision {
  APPROVE = 'APPROVE',
  DECLINE = 'DECLINE',
  REVIEW = 'REVIEW'
}

export enum SettlementSchedule {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

// API Request/Response types
export interface RegisterUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone?: string;
  address?: Address;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Partial<User>;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface CheckoutRequest {
  merchant_id: string;
  items: OrderItemInput[];
  shipping_address: Address;
  billing_address?: Address;
  payment_plan: PaymentPlan;
  merchant_order_id?: string;
}

export interface OrderItemInput {
  product_name: string;
  product_description?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export interface CheckoutResponse {
  order_id: string;
  order_number: string;
  credit_decision: CreditDecision;
  installments?: PaymentScheduleInfo[];
  total_amount: number;
  status: OrderStatus;
  decline_reason?: string;
}

export interface PaymentScheduleInfo {
  number: number;
  amount: number;
  due_date: string;
  status: PaymentStatus;
}

export interface CreditCheckRequest {
  user_id: string;
  requested_amount: number;
  order_id?: string;
}

export interface CreditCheckResponse {
  decision: CreditDecision;
  approved_amount?: number;
  credit_limit?: number;
  decline_reason?: string;
  credit_score?: number;
  risk_score?: number;
}

// JWT Payload
export interface JWTPayload {
  user_id: string;
  email: string;
  role: 'user' | 'merchant' | 'admin';
}

// Database query result types
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

// API Response wrapper
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
