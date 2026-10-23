import { adminDb, adminApp_ } from '../src/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';

async function run() {
  try {
    const app = adminApp_;
    const token = await app.options.credential?.getAccessToken();
    console.log('Got access token:', token?.access_token ? token.access_token.substring(0, 15) + '...' : 'none');

    for (const sb of [true, false]) {
      const res = await fetch('https://iid.googleapis.com/iid/v1:batchImport', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token?.access_token,
          'Content-Type': 'application/json',
          'access_token_auth': 'true'
        },
        body: JSON.stringify({
          application: 'com.chiduga.need',
          sandbox: sb,
          apns_tokens: ['1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']
        })
      });
      console.log('sandbox:', sb, 'Status:', res.status, 'Result:', await res.json());
    }
  } catch(e: any) {
    console.error('ERROR:', e.message);
  }
}
run().catch(console.error);
