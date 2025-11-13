-- Klarna Clone MVP - Database Schema
-- Version: 1.0.0
-- Description: Initial database schema for MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    ssn_last_4 VARCHAR(4),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'US',
    kyc_status VARCHAR(20) DEFAULT 'PENDING',
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    available_credit DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- Merchants Table
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    legal_entity_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(255),
    business_type VARCHAR(50),
    tax_id VARCHAR(50),
    business_address_line1 VARCHAR(255),
    business_address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(2) DEFAULT 'US',
    kyb_status VARCHAR(20) DEFAULT 'PENDING',
    account_status VARCHAR(20) DEFAULT 'ACTIVE',
    fee_percentage DECIMAL(5, 2) DEFAULT 3.50,
    settlement_schedule VARCHAR(20) DEFAULT 'DAILY',
    api_key_hash VARCHAR(255),
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_business_name ON merchants(business_name);

-- Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    order_total DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_plan VARCHAR(20) NOT NULL,
    installments INTEGER,
    order_status VARCHAR(20) DEFAULT 'PENDING',
    shipping_address JSONB,
    billing_address JSONB,
    merchant_order_id VARCHAR(255),
    credit_check_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT,
    sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    product_url VARCHAR(500),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Payment Schedules Table
CREATE TABLE payment_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    installment_number INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    paid_date TIMESTAMP,
    payment_method_id UUID,
    retry_count INTEGER DEFAULT 0,
    last_retry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_schedules_order_id ON payment_schedules(order_id);
CREATE INDEX idx_payment_schedules_user_id ON payment_schedules(user_id);
CREATE INDEX idx_payment_schedules_due_date ON payment_schedules(due_date);
CREATE INDEX idx_payment_schedules_status ON payment_schedules(payment_status);

-- Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_schedule_id UUID NOT NULL REFERENCES payment_schedules(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method_id UUID,
    payment_processor VARCHAR(50),
    processor_transaction_id VARCHAR(255),
    payment_status VARCHAR(20) NOT NULL,
    failure_reason TEXT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Payment Methods Table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    method_type VARCHAR(20) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    card_last_4 VARCHAR(4),
    card_brand VARCHAR(20),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    bank_name VARCHAR(100),
    bank_account_last_4 VARCHAR(4),
    bank_account_type VARCHAR(20),
    processor_token VARCHAR(255),
    processor VARCHAR(50),
    is_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_status ON payment_methods(status);

-- Credit Checks Table
CREATE TABLE credit_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    check_type VARCHAR(20) NOT NULL,
    bureau VARCHAR(50),
    credit_score INTEGER,
    decision VARCHAR(20) NOT NULL,
    decline_reason TEXT,
    approved_amount DECIMAL(10, 2),
    risk_score DECIMAL(5, 2),
    fraud_score DECIMAL(5, 2),
    credit_limit DECIMAL(10, 2),
    interest_rate DECIMAL(5, 2),
    bureau_response JSONB,
    reviewer_id UUID,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_checks_user_id ON credit_checks(user_id);
CREATE INDEX idx_credit_checks_decision ON credit_checks(decision);
CREATE INDEX idx_credit_checks_created_at ON credit_checks(created_at);

-- Settlements Table
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    settlement_date DATE NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    fee_amount DECIMAL(12, 2) NOT NULL,
    net_amount DECIMAL(12, 2) NOT NULL,
    order_count INTEGER NOT NULL,
    settlement_status VARCHAR(20) DEFAULT 'PENDING',
    bank_transfer_id VARCHAR(255),
    settlement_file_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX idx_settlements_date ON settlements(settlement_date);
CREATE INDEX idx_settlements_status ON settlements(settlement_status);

-- Fraud Checks Table
CREATE TABLE fraud_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    check_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    decision VARCHAR(20) NOT NULL,
    fraud_signals JSONB,
    device_fingerprint VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_checks_user_id ON fraud_checks(user_id);
CREATE INDEX idx_fraud_checks_order_id ON fraud_checks(order_id);
CREATE INDEX idx_fraud_checks_decision ON fraud_checks(decision);
CREATE INDEX idx_fraud_checks_created_at ON fraud_checks(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_schedules_updated_at BEFORE UPDATE ON payment_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
