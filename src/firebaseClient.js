const {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  getDoc,
  doc,
  addDoc,
  setDoc,
  Timestamp
} = require('firebase/firestore');
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { firebaseConfig, firebaseServiceAccount } = require('./config');

let db = null;
let firebaseInfo = {
  mode: 'uninitialized',
  projectId: firebaseConfig.projectId || null,
  clientEmail: null,
  initError: null
};

// Use Firebase Client SDK (same as the website) – uses same Firestore rules, no service account needed
function initFirestore() {
  try {
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    db = firestore;
    firebaseInfo = {
      mode: 'client-website-config',
      projectId: firebaseConfig.projectId,
      clientEmail: null,
      initError: null
    };
    console.log(`✅ Firebase connected (Void website config) project=${firebaseConfig.projectId}`);
  } catch (error) {
    firebaseInfo = {
      mode: 'failed',
      projectId: firebaseConfig.projectId,
      clientEmail: null,
      initError: error?.message || String(error)
    };
    console.error('❌ Firebase init error:', error);
  }
}

initFirestore();

// Wrapper so existing code (written for Admin SDK) keeps working: db.collection('teams').get() etc.
function wrapCollection(colRef) {
  return {
    get: () => getDocs(colRef),
    limit: (n) => wrapQuery(query(colRef, limit(n))),
    orderBy: (field, direction = 'asc') => ({
      limit: (n) => wrapQuery(query(colRef, orderBy(field, direction), limit(n))),
      get: () => getDocs(query(colRef, orderBy(field, direction)))
    }),
    where: (field, op, value) => ({
      get: () => getDocs(query(colRef, where(field, op, value))),
      limit: (n) => wrapQuery(query(colRef, where(field, op, value), limit(n)))
    })
  };
}

function wrapQuery(q) {
  return {
    get: () => getDocs(q)
  };
}

const dbWrapper = {
  collection(name) {
    const colRef = collection(db, name);
    return wrapCollection(colRef);
  }
};

function getFirestoreInstance() {
  if (!db) {
    throw new Error('Firebase not initialized. Check your Firebase config.');
  }
  return dbWrapper;
}

// Convert Firestore doc to plain object (handles Timestamps)
function convertFirestoreData(docSnap) {
  if (!docSnap) return null;
  const data = docSnap.data();
  const id = docSnap.id;
  if (!data) return { id };
  const converted = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && value._seconds !== undefined) {
      converted[key] = new Date(value._seconds * 1000).toISOString();
    } else if (Array.isArray(value)) {
      converted[key] = value.map((item) => {
        if (item && typeof item === 'object' && typeof item.toDate === 'function') {
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
  getRawFirestore: () => db,
  convertFirestoreData,
  firebaseInfo: () => firebaseInfo,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  setDoc,
  Timestamp
};
