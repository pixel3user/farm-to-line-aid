import admin from 'firebase-admin';

type ServiceAccount = admin.ServiceAccount & { project_id?: string };

const getServiceAccount = (): ServiceAccount | undefined => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    return undefined;
  }

  try {
    const normalized = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf-8');

    return JSON.parse(normalized);
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    return undefined;
  }
};

if (!admin.apps.length) {
  const serviceAccount = getServiceAccount();
  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault();

  const options: admin.AppOptions = {
    credential,
  };

  const projectId =
    serviceAccount?.project_id ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    options.projectId = projectId;
  }

  admin.initializeApp(options);
}

export default admin;
