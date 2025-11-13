import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { User, RegisterUserRequest, AuthResponse, KYCStatus, AccountStatus } from '../types';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

export class UserService {
  async register(data: RegisterUserRequest): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
    }

    // Hash password
    const password_hash = await hashPassword(data.password);

    // Create user
    const query = `
      INSERT INTO users (
        id, email, password_hash, first_name, last_name,
        date_of_birth, phone, address_line1, address_line2,
        city, state, zip_code, country, kyc_status,
        account_status, credit_limit, available_credit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, email, first_name, last_name, date_of_birth,
                phone, kyc_status, account_status, credit_limit,
                available_credit, created_at
    `;

    const values = [
      uuidv4(),
      data.email,
      password_hash,
      data.first_name,
      data.last_name,
      data.date_of_birth,
      data.phone || null,
      data.address?.line1 || null,
      data.address?.line2 || null,
      data.address?.city || null,
      data.address?.state || null,
      data.address?.zip_code || null,
      data.address?.country || 'US',
      KYCStatus.PENDING,
      AccountStatus.ACTIVE,
      0, // Initial credit limit
      0, // Initial available credit
    ];

    const result = await db.query(query, values);
    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken({
      user_id: user.id,
      email: user.email,
      role: 'user',
    });

    const refreshToken = generateRefreshToken({
      user_id: user.id,
      email: user.email,
      role: 'user',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        kyc_status: user.kyc_status,
        account_status: user.account_status,
        credit_limit: user.credit_limit,
        available_credit: user.available_credit,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    // Find user
    const user = await this.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check account status
    if (user.account_status !== AccountStatus.ACTIVE) {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      user_id: user.id,
      email: user.email,
      role: 'user',
    });

    const refreshToken = generateRefreshToken({
      user_id: user.id,
      email: user.email,
      role: 'user',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        kyc_status: user.kyc_status,
        account_status: user.account_status,
        credit_limit: user.credit_limit,
        available_credit: user.available_credit,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes
    };
  }

  async findById(userId: string): Promise<User | null> {
    const query = `
      SELECT id, email, phone, first_name, last_name, date_of_birth,
             ssn_last_4, address_line1, address_line2, city, state,
             zip_code, country, kyc_status, account_status,
             credit_limit, available_credit, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT *
      FROM users
      WHERE email = $1
    `;
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const allowedUpdates = [
      'first_name',
      'last_name',
      'phone',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'zip_code',
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key) && updates[key as keyof User] !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key as keyof User]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE');
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, phone, first_name, last_name, date_of_birth,
                ssn_last_4, address_line1, address_line2, city, state,
                zip_code, country, kyc_status, account_status,
                credit_limit, available_credit, created_at, updated_at
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return result.rows[0];
  }

  async updateCreditLimit(userId: string, creditLimit: number): Promise<void> {
    const query = `
      UPDATE users
      SET credit_limit = $1, available_credit = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await db.query(query, [creditLimit, userId]);
  }

  async updateAvailableCredit(userId: string, amount: number): Promise<void> {
    const query = `
      UPDATE users
      SET available_credit = available_credit + $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await db.query(query, [amount, userId]);
  }

  async getUserOrders(userId: string, limit: number = 10, offset: number = 0) {
    const query = `
      SELECT o.id, o.order_number, o.order_total, o.net_amount,
             o.payment_plan, o.order_status, o.created_at,
             m.business_name as merchant_name
      FROM orders o
      JOIN merchants m ON o.merchant_id = m.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(query, [userId, limit, offset]);
    return result.rows;
  }

  async getUserPaymentSchedules(userId: string) {
    const query = `
      SELECT ps.id, ps.order_id, ps.installment_number, ps.total_installments,
             ps.amount, ps.due_date, ps.payment_status, ps.paid_date,
             o.order_number, m.business_name as merchant_name
      FROM payment_schedules ps
      JOIN orders o ON ps.order_id = o.id
      JOIN merchants m ON o.merchant_id = m.id
      WHERE ps.user_id = $1 AND ps.payment_status != 'PAID'
      ORDER BY ps.due_date ASC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }
}

export default new UserService();
