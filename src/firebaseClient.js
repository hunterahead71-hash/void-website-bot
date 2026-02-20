const admin = require('firebase-admin');
const { 
  firebaseProjectId, 
  firebaseApiKey, 
  firebaseAuthDomain,
  firebaseServiceAccount 
} = require('./config');

let adminDb = null;

// Initialize Firebase Admin (server-side, more reliable)
if (firebaseServiceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseServiceAccount),
      projectId: firebaseProjectId
    });
    adminDb = admin.firestore();
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin init error:', error.message);
  }
} else {
  // Initialize Firebase Admin with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
  // Or initialize with project ID only (works if Firestore rules allow public read)
  try {
    // Try to initialize with just project ID (for public read access)
    admin.initializeApp({
      projectId: firebaseProjectId
    });
    adminDb = admin.firestore();
    // Set Firestore settings to allow public reads
    adminDb.settings({ ignoreUndefinedProperties: true });
    console.log('✅ Firebase Admin initialized (public access mode)');
  } catch (error) {
    console.error('❌ Firebase Admin init error:', error.message);
    console.log('⚠️  Note: Firebase may require service account credentials for full access');
  }
}

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
  adminDb
};
