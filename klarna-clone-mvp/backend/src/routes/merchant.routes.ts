import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import merchantService from '../services/merchantService';
import orderService from '../services/orderService';
import { validate } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Merchant authentication middleware
const authenticateMerchant = async (req: Request, res: Response, next: any) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('API key required', 401, 'API_KEY_REQUIRED');
    }

    const merchant = await merchantService.authenticateByAPIKey(apiKey);

    if (!merchant) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    (req as any).merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
};

// Register merchant
router.post(
  '/register',
  validate([
    body('business_name').notEmpty().withMessage('Business name is required'),
    body('legal_entity_name').notEmpty().withMessage('Legal entity name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('phone').optional().isMobilePhone('any'),
    body('website').optional().isURL(),
  ]),
  async (req: Request, res: Response) => {
    try {
      const result = await merchantService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Merchant registered successfully. Please save your API key securely.',
      });
    } catch (error) {
      throw error;
    }
  }
);

// Get merchant profile
router.get('/profile', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const merchant = (req as any).merchant;
    res.json({
      success: true,
      data: merchant,
    });
  } catch (error) {
    throw error;
  }
});

// Update merchant profile
router.put('/profile', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const merchant = (req as any).merchant;
    const updatedMerchant = await merchantService.updateProfile(merchant.id, req.body);
    res.json({
      success: true,
      data: updatedMerchant,
    });
  } catch (error) {
    throw error;
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const merchant = (req as any).merchant;
    const stats = await merchantService.getDashboardStats(merchant.id);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    throw error;
  }
});

// Get merchant orders
router.get('/orders', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const merchant = (req as any).merchant;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const orders = await orderService.getMerchantOrders(merchant.id, limit, offset);

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

// Get specific order
router.get('/orders/:orderId', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const merchant = (req as any).merchant;
    const order = await orderService.getOrderWithItems(orderId);

    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.merchant_id !== merchant.id) {
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

// Configure webhook
router.post(
  '/webhooks',
  authenticateMerchant,
  validate([
    body('webhook_url').isURL().withMessage('Invalid webhook URL'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const merchant = (req as any).merchant;
      await merchantService.configureWebhook(merchant.id, req.body.webhook_url);

      res.json({
        success: true,
        message: 'Webhook configured successfully',
      });
    } catch (error) {
      throw error;
    }
  }
);

// Regenerate API key
router.post('/api-key/regenerate', authenticateMerchant, async (req: Request, res: Response) => {
  try {
    const merchant = (req as any).merchant;
    const newAPIKey = await merchantService.regenerateAPIKey(merchant.id);

    res.json({
      success: true,
      data: {
        api_key: newAPIKey,
      },
      message: 'API key regenerated successfully. Please update your integration with the new key.',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
