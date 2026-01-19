import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api';
import invoiceRoutes from './routes/invoices';

const app = express();

app.use(helmet());
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Support both prefixed and root paths so Cloud Functions (where the function name is the first segment)
// and local dev both resolve the same routes.
app.use('/api', apiRoutes);
app.use('/api/invoices', invoiceRoutes);
// Cloud Functions base URL already includes the function name (e.g. /api),
// so expose invoice routes at the root as well: /api/invoices/...
app.use('/invoices', invoiceRoutes);
app.use('/', apiRoutes);


app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Farm2Market AI Webhook Server',
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

export default app;
