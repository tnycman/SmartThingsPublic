import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import {
  Order,
  OrderItem,
  CheckoutRequest,
  CheckoutResponse,
  PaymentPlan,
  OrderStatus,
  CreditDecision,
} from '../types';
import creditService from './creditService';
import paymentService from './paymentService';
import userService from './userService';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class OrderService {
  /**
   * Process checkout - main entry point for creating orders
   */
  async processCheckout(userId: string, request: CheckoutRequest): Promise<CheckoutResponse> {
    logger.info('Processing checkout', { userId, merchantId: request.merchant_id });

    // Validate merchant exists
    const merchant = await this.validateMerchant(request.merchant_id);

    // Calculate order totals
    const totals = this.calculateTotals(request.items);

    // Perform credit check
    const creditCheck = await creditService.performCreditCheck({
      user_id: userId,
      requested_amount: totals.total,
    });

    if (creditCheck.decision === CreditDecision.DECLINED) {
      throw new AppError(
        creditCheck.decline_reason || 'Credit check declined',
        402,
        'CREDIT_DECLINED'
      );
    }

    if (creditCheck.decision === CreditDecision.MANUAL_REVIEW) {
      throw new AppError(
        'Your order requires manual review. We will contact you shortly.',
        202,
        'MANUAL_REVIEW_REQUIRED'
      );
    }

    // Create order in database
    const order = await this.createOrder(userId, request, totals, creditCheck.credit_limit);

    // Create order items
    await this.createOrderItems(order.id, request.items);

    // Generate payment schedule
    const paymentSchedules = await paymentService.createPaymentSchedule(
      order.id,
      userId,
      totals.total,
      request.payment_plan
    );

    // Update available credit
    await userService.updateAvailableCredit(userId, -totals.total);

    return {
      order_id: order.id,
      order_number: order.order_number,
      credit_decision: CreditDecision.APPROVED,
      installments: paymentSchedules.map(schedule => ({
        number: schedule.installment_number,
        amount: schedule.amount,
        due_date: schedule.due_date.toISOString().split('T')[0],
        status: schedule.payment_status,
      })),
      total_amount: totals.total,
      status: order.order_status,
    };
  }

  /**
   * Calculate order totals
   */
  private calculateTotals(items: any[]) {
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const tax = subtotal * 0.08; // 8% tax (simplified)
    const shipping = subtotal > 50 ? 0 : 9.99; // Free shipping over $50
    const total = subtotal + tax + shipping;

    return {
      subtotal,
      tax,
      shipping,
      total,
    };
  }

  /**
   * Validate merchant exists and is active
   */
  private async validateMerchant(merchantId: string): Promise<any> {
    const query = 'SELECT * FROM merchants WHERE id = $1 AND account_status = $2';
    const result = await db.query(query, [merchantId, 'ACTIVE']);

    if (result.rows.length === 0) {
      throw new AppError('Invalid or inactive merchant', 400, 'INVALID_MERCHANT');
    }

    return result.rows[0];
  }

  /**
   * Create order in database
   */
  private async createOrder(
    userId: string,
    request: CheckoutRequest,
    totals: any,
    creditCheckId?: string
  ): Promise<Order> {
    const orderId = uuidv4();
    const orderNumber = this.generateOrderNumber();

    const query = `
      INSERT INTO orders (
        id, order_number, user_id, merchant_id, order_total,
        tax_amount, shipping_amount, discount_amount, net_amount,
        currency, payment_plan, installments, order_status,
        shipping_address, billing_address, merchant_order_id, credit_check_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const installments = this.getInstallmentCount(request.payment_plan);

    const values = [
      orderId,
      orderNumber,
      userId,
      request.merchant_id,
      totals.total,
      totals.tax,
      totals.shipping,
      0, // discount
      totals.total,
      'USD',
      request.payment_plan,
      installments,
      OrderStatus.APPROVED,
      JSON.stringify(request.shipping_address),
      JSON.stringify(request.billing_address || request.shipping_address),
      request.merchant_order_id || null,
      creditCheckId || null,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Create order items
   */
  private async createOrderItems(orderId: string, items: any[]): Promise<void> {
    const query = `
      INSERT INTO order_items (
        id, order_id, product_name, product_description, sku,
        quantity, unit_price, total_price, product_url, image_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    for (const item of items) {
      const values = [
        uuidv4(),
        orderId,
        item.product_name,
        item.product_description || null,
        item.sku || null,
        item.quantity,
        item.unit_price,
        item.unit_price * item.quantity,
        item.product_url || null,
        item.image_url || null,
      ];

      await db.query(query, values);
    }
  }

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `KL-${date}-${random}`;
  }

  /**
   * Get installment count based on payment plan
   */
  private getInstallmentCount(plan: PaymentPlan): number {
    switch (plan) {
      case PaymentPlan.PAY_IN_4:
        return 4;
      case PaymentPlan.PAY_IN_30:
        return 1;
      case PaymentPlan.FINANCING:
        return 12; // Default to 12 months
      default:
        return 4;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await db.query(query, [orderId]);
    return result.rows[0] || null;
  }

  /**
   * Get order with items
   */
  async getOrderWithItems(orderId: string): Promise<any> {
    const orderQuery = `
      SELECT o.*, m.business_name as merchant_name, m.website as merchant_website
      FROM orders o
      JOIN merchants m ON o.merchant_id = m.id
      WHERE o.id = $1
    `;
    const orderResult = await db.query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];

    const itemsQuery = 'SELECT * FROM order_items WHERE order_id = $1';
    const itemsResult = await db.query(itemsQuery, [orderId]);

    return {
      ...order,
      items: itemsResult.rows,
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const query = `
      UPDATE orders
      SET order_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await db.query(query, [status, orderId]);
    logger.info('Order status updated', { orderId, status });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, userId: string): Promise<void> {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.user_id !== userId) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    if (order.order_status === OrderStatus.SHIPPED || order.order_status === OrderStatus.DELIVERED) {
      throw new AppError('Cannot cancel shipped or delivered order', 400, 'CANNOT_CANCEL');
    }

    await this.updateOrderStatus(orderId, OrderStatus.CANCELLED);

    // Restore available credit
    await userService.updateAvailableCredit(userId, order.net_amount);
  }

  /**
   * Get orders for merchant
   */
  async getMerchantOrders(merchantId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT o.*, u.email as customer_email, u.first_name, u.last_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.merchant_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.query(query, [merchantId, limit, offset]);
    return result.rows;
  }
}

export default new OrderService();
