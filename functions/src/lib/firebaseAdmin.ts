import admin from 'firebase-admin';

let app: admin.app.App | undefined;

function initialiseApp(): admin.app.App {
  if (admin.apps.length) {
    return admin.apps[0]!;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    try {
      const credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      app = admin.initializeApp({
        credential,
        storageBucket,
        projectId: projectId || (credential as any).projectId,
      });
      console.log('[firebaseAdmin] Initialised via FIREBASE_SERVICE_ACCOUNT payload');
      return app;
    } catch (error) {
      console.error('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', error);
    }
  }

  try {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket,
      projectId,
    });
    console.log('[firebaseAdmin] Initialised with application default credentials');
    return app;
  } catch (error) {
    console.warn('[firebaseAdmin] Application default credentials unavailable, falling back to unauthenticated init');
    app = admin.initializeApp({
      storageBucket,
      projectId,
    });
    return app;
  }
}

app = initialiseApp();

export default admin;
