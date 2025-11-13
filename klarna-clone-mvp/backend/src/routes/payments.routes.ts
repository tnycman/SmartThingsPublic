import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import paymentService from '../services/paymentService';
import userService from '../services/userService';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get upcoming payments
router.get('/upcoming', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const days = parseInt(req.query.days as string) || 7;
    const payments = await paymentService.getUpcomingPayments(req.user.user_id, days);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    throw error;
  }
});

// Get payment history
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const history = await paymentService.getPaymentHistory(req.user.user_id, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    throw error;
  }
});

// Process payment
router.post(
  '/pay',
  authenticate,
  validate([
    body('payment_schedule_id').isUUID().withMessage('Invalid payment schedule ID'),
    body('payment_method_id').isUUID().withMessage('Invalid payment method ID'),
  ]),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { payment_schedule_id, payment_method_id } = req.body;

      const payment = await paymentService.processPayment(
        payment_schedule_id,
        payment_method_id
      );

      res.json({
        success: true,
        data: payment,
        message: payment.payment_status === 'PAID' ? 'Payment processed successfully' : 'Payment failed',
      });
    } catch (error) {
      throw error;
    }
  }
);

// Get payment schedule
router.get('/schedule/:scheduleId', authenticate, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const schedule = await paymentService.getPaymentSchedule(scheduleId);

    if (!schedule) {
      throw new AppError('Payment schedule not found', 404, 'SCHEDULE_NOT_FOUND');
    }

    if (req.user && schedule.user_id !== req.user.user_id) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    throw error;
  }
});

// Get user payment schedules
router.get('/schedules', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const schedules = await userService.getUserPaymentSchedules(req.user.user_id);

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
