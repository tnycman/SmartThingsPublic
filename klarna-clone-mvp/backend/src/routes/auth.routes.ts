import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import userService from '../services/userService';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Register user
router.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('first_name').notEmpty().withMessage('First name is required'),
    body('last_name').notEmpty().withMessage('Last name is required'),
    body('date_of_birth').isDate().withMessage('Invalid date of birth'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const result = await userService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }
);

// Login user
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await userService.login(email, password);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }
);

// Get current user profile
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const user = await userService.findById(req.user.user_id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user as any;
    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    throw error;
  }
});

// Update user profile
router.put(
  '/profile',
  authenticate,
  validate([
    body('first_name').optional().notEmpty(),
    body('last_name').optional().notEmpty(),
    body('phone').optional().isMobilePhone('any'),
  ]),
  async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }
      const updatedUser = await userService.updateProfile(req.user.user_id, req.body);
      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      throw error;
    }
  }
);

export default router;
