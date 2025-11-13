import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import config from './config';
import db from './config/database';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth.routes';
import ordersRoutes from './routes/orders.routes';
import paymentsRoutes from './routes/payments.routes';
import merchantRoutes from './routes/merchant.routes';

class Server {
  private app: Application;

  constructor() {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS configuration
    this.app.use(
      cors({
        origin: [config.urls.frontend, config.urls.merchantDashboard],
        credentials: true,
      })
    );

    // Body parsing middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    if (config.env === 'development') {
      this.app.use(morgan('dev'));
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      },
    });
    this.app.use('/api/', limiter);
  }

  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: config.env,
      });
    });

    // API routes
    const apiRouter = express.Router();

    apiRouter.use('/auth', authRoutes);
    apiRouter.use('/orders', ordersRoutes);
    apiRouter.use('/payments', paymentsRoutes);
    apiRouter.use('/merchants', merchantRoutes);

    // Mount API router
    this.app.use(`/api/${config.apiVersion}`, apiRouter);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Klarna Clone API',
        version: config.apiVersion,
        documentation: '/api/docs',
      });
    });
  }

  private configureErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      const dbConnected = await db.testConnection();
      if (!dbConnected) {
        throw new Error('Failed to connect to database');
      }

      // Start server
      this.app.listen(config.port, () => {
        logger.info(`Server started on port ${config.port}`);
        logger.info(`Environment: ${config.env}`);
        logger.info(`API Version: ${config.apiVersion}`);
        logger.info(`Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
      });
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  public getApp(): Application {
    return this.app;
  }
}

// Start server
const server = new Server();
server.start();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await db.close();
  process.exit(0);
});

export default server;
