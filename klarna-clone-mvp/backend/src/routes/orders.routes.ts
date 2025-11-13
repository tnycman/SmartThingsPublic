import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import orderService from '../services/orderService';
import paymentService from '../services/paymentService';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Create order (checkout)
router.post(
  '/checkout',
  authenticate,
  validate([
    body('merchant_id').isUUID().withMessage('Invalid merchant ID'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.product_name').notEmpty().withMessage('Product name is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
    body('shipping_address').isObject().withMessage('Shipping address is required'),
    body('shipping_address.line1').notEmpty().withMessage('Address line 1 is required'),
    body('shipping_address.city').notEmpty().withMessage('City is required'),
    body('shipping_address.state').notEmpty().withMessage('State is required'),
    body('shipping_address.zip_code').notEmpty().withMessage('Zip code is required'),
    body('payment_plan').isIn(['PAY_IN_4', 'PAY_IN_30', 'FINANCING']).withMessage('Invalid payment plan'),
  ]),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }
      const result = await orderService.processCheckout(req.user.user_id, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }
);

// Get order by ID
router.get('/:orderId', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderWithItems(orderId);

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Check if user owns this order
    if (req.user && order.user_id !== req.user.user_id) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    throw error;
  }
});

// Get user's orders
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const orders = await userService.getUserOrders(req.user.user_id, limit, offset);

    res.json({
      success: true,
      data: orders,
      meta: {
        limit,
        offset,
      },
    });
  } catch (error) {
    throw error;
  }
});

// Get payment schedule for an order
router.get('/:orderId/payments', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (req.user && order.user_id !== req.user.user_id) {
      throw new AppError('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const schedules = await paymentService.getOrderPaymentSchedules(orderId);

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    throw error;
  }
});

// Cancel order
router.post('/:orderId/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { orderId } = req.params;
    await orderService.cancelOrder(orderId, req.user.user_id);

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
