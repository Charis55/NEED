const fs = require('fs');
const content = fs.readFileSync('./src/lib/firebaseAdmin.ts', 'utf8');
const keyMatch = content.match(/privateKey:\s*"(.*?)"/s);
const pKey = keyMatch[1].replace(/\\n/g, '\n');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({ credential: cert({
  projectId: 'momentum-b4215',
  clientEmail: 'firebase-adminsdk-fbsvc@momentum-b4215.iam.gserviceaccount.com',
  privateKey: pKey
})});
const db = getFirestore(app);
db.collection('jobRequests').limit(15).get().then(snap => {
  snap.forEach(doc => {
    const d = doc.data();
    if (d.activeCall) {
      console.log('JOB:', doc.id, JSON.stringify(d.activeCall, null, 2));
    }
  });
}).catch(console.error);
