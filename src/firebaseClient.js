const admin = require('firebase-admin');
const { 
  firebaseProjectId, 
  firebaseServiceAccount
} = require('./config');

let adminDb = null;
let firebaseInfo = {
  mode: 'uninitialized',
  projectId: firebaseProjectId || null,
  clientEmail: null,
  initError: null
};

function hasServiceAccountFields(sa) {
  return !!(sa && typeof sa === 'object' && sa.client_email && sa.private_key && sa.project_id);
}

function initFirestore() {
  // IMPORTANT: Firebase Admin ONLY reads the Firebase project you configure.
  // If you created your own Firebase, you will read YOUR data (not the website’s).

  const sa = firebaseServiceAccount;

  if (hasServiceAccountFields(sa)) {
    const effectiveProjectId = sa.project_id;
    try {
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: effectiveProjectId
      });
      adminDb = admin.firestore();
      adminDb.settings({ ignoreUndefinedProperties: true });
      firebaseInfo = {
        mode: 'admin-service-account',
        projectId: effectiveProjectId,
        clientEmail: sa.client_email,
        initError: null
      };
      console.log(`✅ Firebase Admin initialized (service account) project=${effectiveProjectId}`);
      return;
    } catch (error) {
      firebaseInfo = {
        mode: 'failed',
        projectId: effectiveProjectId,
        clientEmail: sa.client_email || null,
        initError: error?.message || String(error)
      };
      console.error('❌ Firebase Admin init error (service account):', error);
      // Continue to attempt fallback init below.
    }
  } else if (sa) {
    firebaseInfo = {
      mode: 'invalid-service-account-json',
      projectId: firebaseProjectId || null,
      clientEmail: sa.client_email || null,
      initError: 'FIREBASE_SERVICE_ACCOUNT is set but missing required fields (project_id, client_email, private_key).'
    };
    console.error('❌ FIREBASE_SERVICE_ACCOUNT JSON is not a service account key. Download it from Firebase Console -> Project Settings -> Service Accounts.');
  }

  // Fallback: default credentials OR bare projectId (may still fail / be limited).
  const effectiveProjectId = firebaseProjectId || null;
  if (!effectiveProjectId) {
    firebaseInfo = {
      mode: 'missing-project-id',
      projectId: null,
      clientEmail: null,
      initError: 'Set FIREBASE_PROJECT_ID or provide FIREBASE_SERVICE_ACCOUNT.'
    };
    console.error('❌ Firebase not configured: missing FIREBASE_PROJECT_ID and no valid FIREBASE_SERVICE_ACCOUNT.');
    return;
  }

  try {
    admin.initializeApp({ projectId: effectiveProjectId });
    adminDb = admin.firestore();
    adminDb.settings({ ignoreUndefinedProperties: true });
    firebaseInfo = {
      mode: 'admin-project-id-only',
      projectId: effectiveProjectId,
      clientEmail: null,
      initError: null
    };
    console.log(`✅ Firebase Admin initialized (projectId only) project=${effectiveProjectId}`);
  } catch (error) {
    firebaseInfo = {
      mode: 'failed',
      projectId: effectiveProjectId,
      clientEmail: null,
      initError: error?.message || String(error)
    };
    console.error('❌ Firebase Admin init error (projectId only):', error);
  }
}

initFirestore();

// Helper function to get Firestore instance
function getFirestoreInstance() {
  if (adminDb) {
    return adminDb;
  }
  throw new Error('Firebase not initialized. Please configure Firebase credentials.');
}

// Helper to convert Firestore data to plain objects
function convertFirestoreData(doc) {
  if (!doc) return null;
  
  const data = doc.data();
  const id = doc.id;
  
  if (!data) return { id };
  
  // Convert Firestore Timestamps to ISO strings
  const converted = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
      // Firestore Timestamp
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && value._seconds !== undefined) {
      // Firestore Timestamp (alternative format)
      converted[key] = new Date(value._seconds * 1000).toISOString();
    } else if (Array.isArray(value)) {
      converted[key] = value.map(item => {
        if (item && typeof item === 'object' && item.toDate) {
          return item.toDate().toISOString();
        }
        return item;
      });
    } else {
      converted[key] = value;
    }
  }
  
  return converted;
}

module.exports = {
  getFirestoreInstance,
  convertFirestoreData,
  admin,
  adminDb,
  firebaseInfo: () => firebaseInfo
};
