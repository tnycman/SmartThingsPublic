import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import {
  PaymentSchedule,
  PaymentPlan,
  PaymentStatus,
  Payment,
} from '../types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export class PaymentService {
  /**
   * Create payment schedule for an order
   */
  async createPaymentSchedule(
    orderId: string,
    userId: string,
    totalAmount: number,
    paymentPlan: PaymentPlan
  ): Promise<PaymentSchedule[]> {
    const schedules: PaymentSchedule[] = [];
    const installments = this.getInstallmentCount(paymentPlan);
    const installmentAmount = this.calculateInstallmentAmount(totalAmount, installments);

    for (let i = 1; i <= installments; i++) {
      const dueDate = this.calculateDueDate(i, paymentPlan);
      const amount = i === installments
        ? totalAmount - (installmentAmount * (installments - 1)) // Last payment includes any rounding difference
        : installmentAmount;

      const schedule = await this.createScheduleEntry(
        orderId,
        userId,
        i,
        installments,
        amount,
        dueDate
      );

      schedules.push(schedule);
    }

    logger.info('Payment schedule created', { orderId, installments, totalAmount });
    return schedules;
  }

  /**
   * Create individual schedule entry
   */
  private async createScheduleEntry(
    orderId: string,
    userId: string,
    installmentNumber: number,
    totalInstallments: number,
    amount: number,
    dueDate: Date
  ): Promise<PaymentSchedule> {
    const query = `
      INSERT INTO payment_schedules (
        id, order_id, user_id, installment_number, total_installments,
        amount, due_date, payment_status, retry_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      uuidv4(),
      orderId,
      userId,
      installmentNumber,
      totalInstallments,
      amount,
      dueDate,
      installmentNumber === 1 ? PaymentStatus.PENDING : PaymentStatus.PENDING,
      0,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
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
        return 12;
      default:
        return 4;
    }
  }

  /**
   * Calculate installment amount
   */
  private calculateInstallmentAmount(total: number, installments: number): number {
    return Math.round((total / installments) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate due date for each installment
   */
  private calculateDueDate(installmentNumber: number, plan: PaymentPlan): Date {
    const date = new Date();

    switch (plan) {
      case PaymentPlan.PAY_IN_4:
        // Due immediately for first payment, then every 2 weeks
        if (installmentNumber === 1) {
          return date; // Due today
        }
        date.setDate(date.getDate() + (installmentNumber - 1) * 14); // Every 2 weeks
        break;

      case PaymentPlan.PAY_IN_30:
        date.setDate(date.getDate() + 30);
        break;

      case PaymentPlan.FINANCING:
        date.setMonth(date.getMonth() + installmentNumber);
        break;

      default:
        date.setDate(date.getDate() + installmentNumber * 14);
    }

    return date;
  }

  /**
   * Process payment for a schedule
   */
  async processPayment(
    paymentScheduleId: string,
    paymentMethodId: string
  ): Promise<Payment> {
    // Get payment schedule
    const schedule = await this.getPaymentSchedule(paymentScheduleId);
    if (!schedule) {
      throw new AppError('Payment schedule not found', 404, 'SCHEDULE_NOT_FOUND');
    }

    if (schedule.payment_status === PaymentStatus.PAID) {
      throw new AppError('Payment already processed', 400, 'ALREADY_PAID');
    }

    // In MVP, simulate payment processing
    // In production, integrate with Stripe/Adyen/etc.
    const paymentResult = await this.simulatePaymentProcessing(
      schedule.amount,
      paymentMethodId
    );

    // Create payment record
    const payment = await this.createPaymentRecord(
      paymentScheduleId,
      schedule.user_id,
      schedule.order_id,
      schedule.amount,
      paymentMethodId,
      paymentResult.success,
      paymentResult.transactionId,
      paymentResult.failureReason
    );

    // Update schedule status
    if (paymentResult.success) {
      await this.updateScheduleStatus(paymentScheduleId, PaymentStatus.PAID);
    } else {
      await this.updateScheduleStatus(paymentScheduleId, PaymentStatus.FAILED);
      await this.incrementRetryCount(paymentScheduleId);
    }

    logger.info('Payment processed', {
      paymentScheduleId,
      success: paymentResult.success,
      amount: schedule.amount,
    });

    return payment;
  }

  /**
   * Simulate payment processing (MVP only)
   */
  private async simulatePaymentProcessing(
    amount: number,
    paymentMethodId: string
  ): Promise<{
    success: boolean;
    transactionId?: string;
    failureReason?: string;
  }> {
    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    if (success) {
      return {
        success: true,
        transactionId: `txn_${uuidv4().substring(0, 16)}`,
      };
    } else {
      return {
        success: false,
        failureReason: 'Insufficient funds',
      };
    }
  }

  /**
   * Create payment record
   */
  private async createPaymentRecord(
    paymentScheduleId: string,
    userId: string,
    orderId: string,
    amount: number,
    paymentMethodId: string,
    success: boolean,
    transactionId?: string,
    failureReason?: string
  ): Promise<Payment> {
    const query = `
      INSERT INTO payments (
        id, payment_schedule_id, user_id, order_id, amount,
        payment_method_id, payment_processor, processor_transaction_id,
        payment_status, failure_reason, payment_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      uuidv4(),
      paymentScheduleId,
      userId,
      orderId,
      amount,
      paymentMethodId,
      'SIMULATED',
      transactionId || null,
      success ? PaymentStatus.PAID : PaymentStatus.FAILED,
      failureReason || null,
      new Date(),
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get payment schedule by ID
   */
  async getPaymentSchedule(scheduleId: string): Promise<PaymentSchedule | null> {
    const query = 'SELECT * FROM payment_schedules WHERE id = $1';
    const result = await db.query(query, [scheduleId]);
    return result.rows[0] || null;
  }

  /**
   * Update schedule status
   */
  private async updateScheduleStatus(scheduleId: string, status: PaymentStatus): Promise<void> {
    const query = `
      UPDATE payment_schedules
      SET payment_status = $1,
          paid_date = CASE WHEN $1 = 'PAID' THEN CURRENT_TIMESTAMP ELSE paid_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await db.query(query, [status, scheduleId]);
  }

  /**
   * Increment retry count for failed payments
   */
  private async incrementRetryCount(scheduleId: string): Promise<void> {
    const query = `
      UPDATE payment_schedules
      SET retry_count = retry_count + 1,
          last_retry_date = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(query, [scheduleId]);
  }

  /**
   * Get payment schedules for an order
   */
  async getOrderPaymentSchedules(orderId: string): Promise<PaymentSchedule[]> {
    const query = `
      SELECT * FROM payment_schedules
      WHERE order_id = $1
      ORDER BY installment_number ASC
    `;
    const result = await db.query(query, [orderId]);
    return result.rows;
  }

  /**
   * Get upcoming payments for a user
   */
  async getUpcomingPayments(userId: string, days: number = 7): Promise<PaymentSchedule[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const query = `
      SELECT ps.*, o.order_number, m.business_name as merchant_name
      FROM payment_schedules ps
      JOIN orders o ON ps.order_id = o.id
      JOIN merchants m ON o.merchant_id = m.id
      WHERE ps.user_id = $1
        AND ps.payment_status = 'PENDING'
        AND ps.due_date <= $2
      ORDER BY ps.due_date ASC
    `;
    const result = await db.query(query, [userId, futureDate]);
    return result.rows;
  }

  /**
   * Get overdue payments
   */
  async getOverduePayments(userId?: string): Promise<PaymentSchedule[]> {
    const today = new Date();
    const query = `
      SELECT ps.*, o.order_number, u.email, u.first_name, u.last_name
      FROM payment_schedules ps
      JOIN orders o ON ps.order_id = o.id
      JOIN users u ON ps.user_id = u.id
      WHERE ps.payment_status = 'PENDING'
        AND ps.due_date < $1
        ${userId ? 'AND ps.user_id = $2' : ''}
      ORDER BY ps.due_date ASC
    `;
    const params = userId ? [today, userId] : [today];
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId: string, limit: number = 20): Promise<Payment[]> {
    const query = `
      SELECT p.*, ps.installment_number, ps.total_installments,
             o.order_number, m.business_name as merchant_name
      FROM payments p
      JOIN payment_schedules ps ON p.payment_schedule_id = ps.id
      JOIN orders o ON p.order_id = o.id
      JOIN merchants m ON o.merchant_id = m.id
      WHERE p.user_id = $1
      ORDER BY p.payment_date DESC
      LIMIT $2
    `;
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }
}

export default new PaymentService();
