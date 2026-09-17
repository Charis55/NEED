import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  getPendingFriendRequestsCount, 
  getTotalUnreadMessagesCount,
  getFriendRequestsAndFriends,
  subscribeToUnreadCount
} from '../utils/db';

const LoginNotificationHandler = () => {
  const { user } = useAuth();
  const { triggerNotification } = useNotifications();
  const hasNotified = useRef(false);
  const previousCounts = useRef({});
  const unsubscribes = useRef([]);

  useEffect(() => {
    if (!user?.uid) return;

    const checkNotifications = async () => {
      try {
        if (!hasNotified.current) {
          const [pendingRequests, unreadMessages] = await Promise.all([
            getPendingFriendRequestsCount(user.uid),
            getTotalUnreadMessagesCount(user.uid)
          ]);

          if (pendingRequests > 0) {
            triggerNotification(
              'New Friend Requests',
              `You have ${pendingRequests} pending friend request${pendingRequests > 1 ? 's' : ''}. Check the Social tab!`,
              'info'
            );
          }

          if (unreadMessages > 0) {
            triggerNotification(
              'Unread Messages',
              `You have ${unreadMessages} new message${unreadMessages > 1 ? 's' : ''} waiting for you.`,
              'info'
            );
          }
          
          hasNotified.current = true;
        }

        // Setup real-time chat listeners for new incoming messages
        const { friends } = await getFriendRequestsAndFriends(user.uid);
        
        // Clear previous listeners if any
        unsubscribes.current.forEach(unsub => unsub());
        unsubscribes.current = [];

        friends.forEach(friend => {
          // Initialize to -1 to ignore the very first snapshot call
          previousCounts.current[friend.uid] = -1; 
          
          const unsub = subscribeToUnreadCount(user.uid, friend.uid, (count) => {
            const prev = previousCounts.current[friend.uid];
            if (prev !== -1 && count > prev) {
              // Trigger notification for new unread message increase
              triggerNotification(
                'New Message',
                `You received a new message from ${friend.username || 'a friend'}!`,
                'info'
              );
            }
            previousCounts.current[friend.uid] = count;
          });
          
          unsubscribes.current.push(unsub);
        });

      } catch (err) {
        console.error("Login verification check failed", err);
      }
    };

    // Delay slightly to allow the app to settle
    const timeoutId = setTimeout(checkNotifications, 2000);

    return () => {
      clearTimeout(timeoutId);
      unsubscribes.current.forEach(unsub => unsub());
      unsubscribes.current = [];
    };
  }, [user]); // Re-run if useAuth drops and logs in

  return null;
};

export default LoginNotificationHandler;
