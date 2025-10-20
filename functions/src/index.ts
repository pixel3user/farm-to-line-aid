import * as functions from 'firebase-functions';
import app from './app';

const REGION = 'asia-east1';

export const api = functions.region(REGION).https.onRequest(app);

export const webhook = functions.region(REGION).https.onRequest((req, res) => {
  req.url = '/api/webhook';
  return app(req, res);
});

export const health = functions.region(REGION).https.onRequest((req, res) => {
  req.url = '/api/health';
  return app(req, res);
});
