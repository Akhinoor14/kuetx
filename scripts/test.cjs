const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

admin.initializeApp({
  credential: admin.cert(path.join(__dirname, 'serviceAccountKey.json')),
});
const db = getFirestore();

db.collection('groups').limit(1).get()
  .then(snap => console.log('Success! Docs found:', snap.size))
  .catch(err => console.error('Error:', err));