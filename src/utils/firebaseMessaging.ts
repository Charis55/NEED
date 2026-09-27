import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const requestForToken = async (userId: string) => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("Firebase Messaging not supported on this browser.");
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = "BB7xpv1wQlb8_ygbtdXZvwEKGimkhG5Hl_2-K5QJB7DvzvkpRdS7Y2XIw1nE3E7HfzA1ztECHMzBW_P1atFEMMo"; 
    
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const currentToken = await getToken(messaging, { vapidKey });
      if (currentToken) {
        console.log("Client FCM Token:", currentToken);
        // Save the token to Firestore for this user
        await updateDoc(doc(db, "users", userId), {
          fcmToken: currentToken
        });
        return currentToken;
      } else {
        console.log("No registration token available.");
      }
    } else {
      console.log("Notification permission denied.");
    }
  } catch (err) {
    console.error("An error occurred while retrieving token.", err);
  }
  return null;
};

export const onMessageListener = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  
  const messaging = getMessaging(app);
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};
