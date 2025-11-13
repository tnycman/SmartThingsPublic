# Klarna Clone - MVP

A fully functional Buy Now, Pay Later (BNPL) platform MVP built with Node.js, TypeScript, PostgreSQL, and React.

## 🚀 Features

### Consumer Features
- **User Registration & Authentication**: Secure JWT-based authentication
- **Pay in 4**: Split purchases into 4 interest-free biweekly payments
- **Pay in 30 Days**: Defer payment for 30 days
- **Real-time Credit Decisions**: Get instant approval (< 2 seconds)
- **Payment Dashboard**: View orders and upcoming payments
- **Payment History**: Track all transactions

### Merchant Features
- **Merchant Registration**: Quick onboarding process
- **API Integration**: RESTful API with API key authentication
- **Order Management**: Track all customer orders
- **Dashboard Analytics**: View GMV, order counts, and performance metrics
- **Webhook Support**: Real-time order event notifications
- **Instant Settlement**: Receive payment upfront (minus fees)

### Platform Features
- **Credit Scoring**: Rule-based credit decisioning engine
- **Fraud Detection**: Basic fraud risk assessment
- **Payment Scheduling**: Automatic installment generation
- **Payment Processing**: Simulated payment collection (MVP)

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)
- npm or yarn

## 🛠️ Installation

### Option 1: Docker (Recommended)

1. **Clone the repository**
```bash
cd klarna-clone-mvp
```

2. **Start services with Docker Compose**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- Backend API on port 3000

3. **Check service health**
```bash
curl http://localhost:3000/health
```

### Option 2: Local Development

1. **Set up PostgreSQL**
```bash
# Create database
createdb klarna_clone

# Run migrations
psql -d klarna_clone -f database/migrations/001_initial_schema.sql
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Start backend server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <access_token>
```

Merchant endpoints require API key authentication:
```
X-API-Key: <merchant_api_key>
```

### Consumer Endpoints

#### 1. Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1990-01-15",
  "phone": "+15551234567",
  "address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "94102",
    "country": "US"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "credit_limit": 0,
      "available_credit": 0
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  }
}
```

#### 2. Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### 3. Checkout / Create Order
```http
POST /api/v1/orders/checkout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "merchant_id": "merchant-uuid",
  "items": [
    {
      "product_name": "Laptop",
      "product_description": "MacBook Pro 14-inch",
      "sku": "LAPTOP-001",
      "quantity": 1,
      "unit_price": 1999.99
    }
  ],
  "shipping_address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip_code": "94102",
    "country": "US"
  },
  "payment_plan": "PAY_IN_4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "order_number": "KL-20250112-0001",
    "credit_decision": "APPROVED",
    "installments": [
      {
        "number": 1,
        "amount": 539.25,
        "due_date": "2025-01-12",
        "status": "PENDING"
      },
      {
        "number": 2,
        "amount": 539.25,
        "due_date": "2025-01-26",
        "status": "PENDING"
      },
      {
        "number": 3,
        "amount": 539.25,
        "due_date": "2025-02-09",
        "status": "PENDING"
      },
      {
        "number": 4,
        "amount": 539.24,
        "due_date": "2025-02-23",
        "status": "PENDING"
      }
    ],
    "total_amount": 2156.99,
    "status": "APPROVED"
  }
}
```

#### 4. Get Order Details
```http
GET /api/v1/orders/:orderId
Authorization: Bearer <access_token>
```

#### 5. Get Payment Schedules
```http
GET /api/v1/payments/schedules
Authorization: Bearer <access_token>
```

#### 6. Process Payment
```http
POST /api/v1/payments/pay
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "payment_schedule_id": "uuid",
  "payment_method_id": "uuid"
}
```

### Merchant Endpoints

#### 1. Register Merchant
```http
POST /api/v1/merchants/register
Content-Type: application/json

{
  "business_name": "My Store",
  "legal_entity_name": "My Store LLC",
  "email": "merchant@store.com",
  "phone": "+15551234567",
  "website": "https://mystore.com",
  "business_type": "LLC",
  "business_address_line1": "456 Business Ave",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "business_name": "My Store",
      "email": "merchant@store.com",
      "fee_percentage": 3.5
    },
    "api_key": "sk_abc123xyz..."
  },
  "message": "Merchant registered successfully. Please save your API key securely."
}
```

#### 2. Get Dashboard Stats
```http
GET /api/v1/merchants/dashboard/stats
X-API-Key: <merchant_api_key>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": {
      "total_orders": 150,
      "approved_orders": 142,
      "declined_orders": 8
    },
    "gmv": {
      "total_gmv": "45230.50",
      "approved_gmv": "43500.00"
    },
    "recent_orders": [...],
    "pending_settlements": "2500.00"
  }
}
```

#### 3. Get Merchant Orders
```http
GET /api/v1/merchants/orders?limit=50&offset=0
X-API-Key: <merchant_api_key>
```

#### 4. Configure Webhook
```http
POST /api/v1/merchants/webhooks
X-API-Key: <merchant_api_key>
Content-Type: application/json

{
  "webhook_url": "https://mystore.com/webhooks/klarna"
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                           │
│            (Express + JWT Auth + Rate Limiting)              │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  User Service  │  │   Merchant  │  │  Payment Service│
│                │  │   Service   │  │                 │
└───────┬────────┘  └──────┬──────┘  └────────┬────────┘
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│  Credit        │  │    Order    │  │   PostgreSQL    │
│  Service       │  │  Management │  │    Database     │
└────────────────┘  └─────────────┘  └─────────────────┘
```

## 🔧 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Cache**: Redis (configured, not yet implemented)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Logging**: Winston
- **Security**: Helmet, bcryptjs

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Process Management**: PM2 (for production)

## 📂 Project Structure

```
klarna-clone-mvp/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   │   ├── index.ts     # Environment config
│   │   │   └── database.ts  # Database connection
│   │   ├── middleware/      # Express middleware
│   │   │   ├── auth.ts      # Authentication
│   │   │   ├── validate.ts  # Validation
│   │   │   └── errorHandler.ts
│   │   ├── routes/          # API routes
│   │   │   ├── auth.routes.ts
│   │   │   ├── orders.routes.ts
│   │   │   ├── payments.routes.ts
│   │   │   └── merchant.routes.ts
│   │   ├── services/        # Business logic
│   │   │   ├── userService.ts
│   │   │   ├── creditService.ts
│   │   │   ├── orderService.ts
│   │   │   ├── paymentService.ts
│   │   │   └── merchantService.ts
│   │   ├── types/           # TypeScript types
│   │   │   └── index.ts
│   │   ├── utils/           # Utility functions
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   └── logger.ts
│   │   └── index.ts         # Main server file
│   ├── tests/               # Unit & integration tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
├── database/
│   └── migrations/
│       └── 001_initial_schema.sql
├── docker-compose.yml
├── package.json
└── README.md
```

## 💳 Credit Decision Engine

The MVP uses a simplified rule-based credit scoring system:

### Credit Score Simulation
- Base score: 650
- +30 points for complete address
- +20 points for phone number
- +30 points for SSN (partial)
- +/- 50 points random variance

### Credit Limit Tiers
- **750+ score**: $5,000 limit
- **700-749 score**: $3,000 limit
- **650-699 score**: $2,000 limit
- **620-649 score**: $1,000 limit
- **<620 score**: Declined

### Risk Factors
- High risk score (>70): Declined
- High fraud score (>50): Manual review
- Transaction amount > $5,000: Declined

## 🔐 Security Features

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Authentication**: Short-lived access tokens (15 min)
- **API Key Authentication**: For merchant endpoints
- **Rate Limiting**: 100 requests/minute per IP
- **Input Validation**: express-validator for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **CORS**: Configured for specific origins
- **Helmet.js**: Security headers

## 🧪 Testing

```bash
# Run unit tests
cd backend
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Build

```bash
# Build backend
cd backend
npm run build

# Start with PM2
pm2 start dist/index.js --name klarna-clone-api
```

### Environment Variables

Required environment variables for production:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=klarna_clone
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_SSL=true
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

## 📊 Database Schema

The database includes the following main tables:

- `users`: Consumer accounts
- `merchants`: Merchant accounts
- `orders`: Purchase orders
- `order_items`: Line items for orders
- `payment_schedules`: Installment schedules
- `payments`: Payment transactions
- `payment_methods`: Stored payment methods
- `credit_checks`: Credit check history
- `fraud_checks`: Fraud detection logs
- `settlements`: Merchant settlements

See `database/migrations/001_initial_schema.sql` for complete schema.

## 🎯 Future Enhancements

### High Priority
- [ ] Frontend React applications (Consumer & Merchant dashboards)
- [ ] Real payment processor integration (Stripe/Adyen)
- [ ] Real credit bureau integration (Experian/Equifax)
- [ ] Email notifications
- [ ] SMS notifications

### Medium Priority
- [ ] Advanced fraud detection (ML-based)
- [ ] Improved credit scoring (ML models)
- [ ] Payment retry automation
- [ ] Collections workflow
- [ ] Refund processing
- [ ] Mobile apps (React Native)

### Low Priority
- [ ] Multi-currency support
- [ ] International expansion
- [ ] Virtual card generation
- [ ] Admin panel
- [ ] Advanced analytics dashboard

## 🐛 Known Issues / Limitations

1. **Payment Processing**: Currently simulated (95% success rate)
2. **Credit Bureau**: Mock implementation only
3. **Fraud Detection**: Basic rule-based system
4. **Email/SMS**: Not implemented in MVP
5. **Frontend**: Not included in MVP
6. **Payment Methods**: Database schema exists but no tokenization
7. **Webhooks**: Configured but not fully implemented

## 📝 License

MIT License - See LICENSE file for details

## 👥 Contributing

This is an MVP/demo project. For production use, please ensure:
- Proper security audits
- Regulatory compliance (lending licenses, KYC/AML)
- Real payment processor integration
- Comprehensive testing
- Load testing and performance optimization

## 📞 Support

For questions or issues, please open a GitHub issue.

---

**Built with ❤️ as a technical demonstration of BNPL platform architecture**
