import * as functions from 'firebase-functions';
import app from './app';

const REGION = 'asia-east1';

const apiRuntime = functions.region(REGION).runWith({
  timeoutSeconds: 300,
  memory: '1GB',
  minInstances: 1,
  maxInstances: Number(process.env.API_MAX_INSTANCES || 5),
});

export const api = apiRuntime.https.onRequest(app);

export const webhook = functions.region(REGION).https.onRequest((req, res) => {
  req.url = '/api/webhook';
  return app(req, res);
});

export const health = functions.region(REGION).https.onRequest((req, res) => {
  req.url = '/api/health';
  return app(req, res);
});
