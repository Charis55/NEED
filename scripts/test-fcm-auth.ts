import { adminDb, adminApp_ } from '../src/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';

async function run() {
  try {
    console.log('Init adminApp...');
    await getMessaging(adminApp_).send({
      token: 'fake-token-just-testing-auth',
      notification: { title: 'Test', body: 'Test' }
    });
  } catch(e: any) {
    console.error('FCM ERROR:', e.message);
  }
}
run().catch(console.error);
