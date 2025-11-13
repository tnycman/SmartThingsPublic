import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import config from '../config';
import { Merchant, KYBStatus, AccountStatus } from '../types';
import { generateAPIKey, hashAPIKey, compareAPIKey } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class MerchantService {
  /**
   * Register new merchant
   */
  async register(data: any): Promise<{ merchant: Partial<Merchant>; api_key: string }> {
    // Check if merchant already exists
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new AppError('Merchant with this email already exists', 409, 'MERCHANT_EXISTS');
    }

    // Generate API key
    const apiKey = generateAPIKey();
    const apiKeyHash = await hashAPIKey(apiKey);

    // Create merchant
    const query = `
      INSERT INTO merchants (
        id, business_name, legal_entity_name, email, phone, website,
        business_type, tax_id, business_address_line1, business_address_line2,
        city, state, zip_code, country, kyb_status, account_status,
        fee_percentage, settlement_schedule, api_key_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, business_name, legal_entity_name, email, phone, website,
                kyb_status, account_status, fee_percentage, created_at
    `;

    const values = [
      uuidv4(),
      data.business_name,
      data.legal_entity_name,
      data.email,
      data.phone || null,
      data.website || null,
      data.business_type || null,
      data.tax_id || null,
      data.business_address_line1 || null,
      data.business_address_line2 || null,
      data.city || null,
      data.state || null,
      data.zip_code || null,
      data.country || 'US',
      KYBStatus.PENDING,
      AccountStatus.ACTIVE,
      config.merchant.defaultFee,
      'DAILY',
      apiKeyHash,
    ];

    const result = await db.query(query, values);
    const merchant = result.rows[0];

    logger.info('Merchant registered', { merchantId: merchant.id, businessName: merchant.business_name });

    return {
      merchant,
      api_key: apiKey,
    };
  }

  /**
   * Authenticate merchant by API key
   */
  async authenticateByAPIKey(apiKey: string): Promise<Merchant | null> {
    // Get all merchants (in production, would optimize this)
    const query = 'SELECT * FROM merchants WHERE api_key_hash IS NOT NULL';
    const result = await db.query(query);

    for (const merchant of result.rows) {
      const isValid = await compareAPIKey(apiKey, merchant.api_key_hash);
      if (isValid) {
        if (merchant.account_status !== AccountStatus.ACTIVE) {
          throw new AppError('Merchant account is not active', 403, 'ACCOUNT_INACTIVE');
        }
        return merchant;
      }
    }

    return null;
  }

  /**
   * Find merchant by ID
   */
  async findById(merchantId: string): Promise<Merchant | null> {
    const query = `
      SELECT id, business_name, legal_entity_name, email, phone, website,
             business_type, business_address_line1, business_address_line2,
             city, state, zip_code, country, kyb_status, account_status,
             fee_percentage, settlement_schedule, webhook_url, created_at, updated_at
      FROM merchants
      WHERE id = $1
    `;
    const result = await db.query(query, [merchantId]);
    return result.rows[0] || null;
  }

  /**
   * Find merchant by email
   */
  async findByEmail(email: string): Promise<Merchant | null> {
    const query = 'SELECT * FROM merchants WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Update merchant profile
   */
  async updateProfile(merchantId: string, updates: Partial<Merchant>): Promise<Merchant> {
    const allowedUpdates = [
      'business_name',
      'phone',
      'website',
      'business_address_line1',
      'business_address_line2',
      'city',
      'state',
      'zip_code',
      'webhook_url',
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key) && updates[key as keyof Merchant] !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(updates[key as keyof Merchant]);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      throw new AppError('No valid fields to update', 400, 'INVALID_UPDATE');
    }

    values.push(merchantId);

    const query = `
      UPDATE merchants
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      throw new AppError('Merchant not found', 404, 'MERCHANT_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Regenerate API key
   */
  async regenerateAPIKey(merchantId: string): Promise<string> {
    const newAPIKey = generateAPIKey();
    const apiKeyHash = await hashAPIKey(newAPIKey);

    const query = `
      UPDATE merchants
      SET api_key_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;

    await db.query(query, [apiKeyHash, merchantId]);
    logger.info('API key regenerated', { merchantId });

    return newAPIKey;
  }

  /**
   * Get merchant dashboard statistics
   */
  async getDashboardStats(merchantId: string): Promise<any> {
    // Total orders
    const ordersQuery = `
      SELECT COUNT(*) as total_orders,
             SUM(CASE WHEN order_status = 'APPROVED' THEN 1 ELSE 0 END) as approved_orders,
             SUM(CASE WHEN order_status = 'DECLINED' THEN 1 ELSE 0 END) as declined_orders
      FROM orders
      WHERE merchant_id = $1
    `;
    const ordersResult = await db.query(ordersQuery, [merchantId]);

    // Total GMV (Gross Merchandise Value)
    const gmvQuery = `
      SELECT SUM(order_total) as total_gmv,
             SUM(CASE WHEN order_status IN ('APPROVED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED')
                 THEN order_total ELSE 0 END) as approved_gmv
      FROM orders
      WHERE merchant_id = $1
    `;
    const gmvResult = await db.query(gmvQuery, [merchantId]);

    // Recent orders
    const recentOrdersQuery = `
      SELECT o.*, u.email as customer_email, u.first_name, u.last_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.merchant_id = $1
      ORDER BY o.created_at DESC
      LIMIT 10
    `;
    const recentOrdersResult = await db.query(recentOrdersQuery, [merchantId]);

    // Pending settlements
    const settlementsQuery = `
      SELECT SUM(net_amount) as pending_settlements
      FROM settlements
      WHERE merchant_id = $1 AND settlement_status = 'PENDING'
    `;
    const settlementsResult = await db.query(settlementsQuery, [merchantId]);

    return {
      orders: ordersResult.rows[0],
      gmv: gmvResult.rows[0],
      recent_orders: recentOrdersResult.rows,
      pending_settlements: settlementsResult.rows[0]?.pending_settlements || 0,
    };
  }

  /**
   * Get merchant analytics
   */
  async getAnalytics(merchantId: string, startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(order_total) as total_gmv,
        SUM(CASE WHEN order_status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN order_status = 'DECLINED' THEN 1 ELSE 0 END) as declined_count,
        AVG(order_total) as average_order_value
      FROM orders
      WHERE merchant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const result = await db.query(query, [merchantId, startDate, endDate]);
    return result.rows;
  }

  /**
   * Configure webhook
   */
  async configureWebhook(merchantId: string, webhookUrl: string): Promise<void> {
    // Generate webhook secret
    const webhookSecret = uuidv4();

    const query = `
      UPDATE merchants
      SET webhook_url = $1, webhook_secret = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;

    await db.query(query, [webhookUrl, webhookSecret, merchantId]);
    logger.info('Webhook configured', { merchantId, webhookUrl });
  }

  /**
   * Get all merchants (admin only)
   */
  async getAllMerchants(limit: number = 50, offset: number = 0): Promise<Merchant[]> {
    const query = `
      SELECT id, business_name, legal_entity_name, email, phone, website,
             kyb_status, account_status, fee_percentage, created_at
      FROM merchants
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }
}

export default new MerchantService();
