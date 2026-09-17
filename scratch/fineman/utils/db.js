import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  addDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

const DAILY_LOG_COLLECTION = "daily_logs";
const USER_COLLECTION = "users";

/**
 * Get the current date string in YYYY-MM-DD format.
 */
const getTodayStr = () => new Date().toISOString().split('T')[0];

/**
 * Initialize or fetch the daily log for a user.
 */
export const getDailyLog = async (uid, date = getTodayStr()) => {
  const logId = `${uid}_${date}`;
  const logRef = doc(db, DAILY_LOG_COLLECTION, logId);
  const logSnap = await getDoc(logRef);

  if (logSnap.exists()) {
    return logSnap.data();
  } else {
    // Initial data for a new day
    const initialData = {
      uid,
      date,
      caloriesConsumed: 0,
      caloriesBurned: 0,
      steps: 0,
      water: 0,
      weight: 0, 
      challengesDone: 0,
      lastUpdated: serverTimestamp()
    };
    await setDoc(logRef, initialData);
    return initialData;
  }
};

/**
 * Fetch and aggregate logs for the past 7 days (excluding today) from source collections.
 */
export const getWeeklyLogs = async (uid) => {
  const dates = [];
  const logs = [];
  
  // Calculate the last 7 dates (excluding today)
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Define the time range for raw queries (Start of 7 days ago to end of yesterday)
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 7);
  rangeStart.setHours(0, 0, 0, 0);

  try {
    // 1. Fetch Raw Meals
    const mealsQuery = query(
      collection(db, "users", uid, "meals"),
      where("timestamp", ">=", rangeStart)
    );
    const mealsSnap = await getDocs(mealsQuery);
    
    // 2. Fetch Raw Workouts
    const workoutsQuery = query(
      collection(db, "users", uid, "workouts"),
      where("timestamp", ">=", rangeStart)
    );
    const workoutsSnap = await getDocs(workoutsQuery);

    // Initial log structure for each date
    const dailyData = {};
    dates.forEach(date => {
      dailyData[date] = {
        date,
        caloriesConsumed: 0,
        caloriesBurned: 0,
        challengesDone: 0,
        water: 0 // Water is still primarily in dairy_logs, we'll fetch summaries too
      };
    });

    // 3. Aggregate Meals
    mealsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.timestamp) {
        const dateStr = data.timestamp.toDate().toISOString().split('T')[0];
        if (dailyData[dateStr]) {
          dailyData[dateStr].caloriesConsumed += (data.calories || 0);
        }
      }
    });

    // 4. Aggregate Workouts
    workoutsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.timestamp) {
        const dateStr = data.timestamp.toDate().toISOString().split('T')[0];
        if (dailyData[dateStr]) {
          dailyData[dateStr].caloriesBurned += (data.calories || 0);
        }
      }
    });

    // 5. Aggregate Challenges
    // Instead of querying enrollment collection (which is global), we can check the daily_logs summaries 
    // or keep the enrollment query if needed. For performance, we'll fetch daily_logs too.
    await Promise.all(dates.map(async (date) => {
      const summary = await getDailyLog(uid, date);
      if (dailyData[date]) {
        dailyData[date].water = summary.water || 0;
        dailyData[date].challengesDone = summary.challengesDone || 0;
      }
    }));

    // Return in reverse chronological order (Yesterday first)
    return dates.map(date => dailyData[date]);
  } catch (err) {
    console.error("Aggregation error:", err);
    // Fallback to basic summaries if aggregation fails
    return Promise.all(dates.map(date => getDailyLog(uid, date)));
  }
};

/**
 * Update a specific metric for today.
 */
export const updateTodayMetric = async (uid, metrics) => {
  const today = getTodayStr();
  const logId = `${uid}_${today}`;
  const logRef = doc(db, DAILY_LOG_COLLECTION, logId);
  
  await updateDoc(logRef, {
    ...metrics,
    lastUpdated: serverTimestamp()
  });
};

/**
 * BIOMETRIC & POINT SYSTEM (V6-12)
 */

export const PAL_MULTIPLIERS = {
  "Sedentary": 1.2,
  "Lightly Active": 1.375,
  "Moderately Active": 1.55,
  "Very Active": 1.725
};

export const calculateUserBiometrics = (userProfile) => {
  const { weight, height, age, gender, goal, activityLevel } = userProfile;
  if (!weight || !height || !age) return { daily: 2000, weekly: 14000 };

  // Mifflin-St Jeor Equation
  let bmr = (10 * parseFloat(weight)) + (6.25 * parseFloat(height)) - (5 * parseInt(age));
  bmr = (gender === 'Male') ? bmr + 5 : bmr - 161;

  // TDEE calculation
  const multiplier = PAL_MULTIPLIERS[activityLevel] || 1.2;
  const tdee = bmr * multiplier;

  // Goal Adjustment
  let dailyTarget = tdee;
  if (goal === 'Lose Weight') dailyTarget -= 500;
  else if (goal === 'Build Muscle') dailyTarget += 400;

  return {
    daily: Math.round(dailyTarget),
    weekly: Math.round(dailyTarget * 7)
  };
};

export const addPoints = async (uid, amount) => {
  const userRef = doc(db, USER_COLLECTION, uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const currentPoints = snap.data().points || 0;
    await updateDoc(userRef, { 
      points: currentPoints + amount,
      lastModified: serverTimestamp() 
    });
  }
};

export const recordDailyLogin = async (uid) => {
  const today = getTodayStr();
  const userRef = doc(db, USER_COLLECTION, uid);
  await updateDoc(userRef, {
    lastCheckedIn: today
  });
};

/**
 * Log a meal and update the daily calorie count + Individual points.
 */
export const logUserMeal = async (uid, meal) => {
  const mealRef = collection(db, "users", uid, "meals");
  await addDoc(mealRef, {
    ...meal,
    timestamp: serverTimestamp()
  });

  // Update daily consumed calories
  const currentLog = await getDailyLog(uid);
  const newTotal = (currentLog.caloriesConsumed || 0) + (meal.calories || 0);
  await updateTodayMetric(uid, { caloriesConsumed: newTotal });

  // Mark Activity for Consistency
  const today = getTodayStr();
  await updateDoc(doc(db, USER_COLLECTION, uid), {
    [`checkInHistory.${today}`]: true
  });

  // Award Points (+10)
  await addPoints(uid, 10);
};

/**
 * Save custom food to user's personal database.
 */
export const saveCustomFood = async (uid, food) => {
  const customRef = collection(db, "users", uid, "customFoods");
  await addDoc(customRef, {
    ...food,
    category: 'Custom',
    unit: 'serving',
    timestamp: serverTimestamp()
  });
};

/**
 * Get all custom foods saved by the user.
 */
export const getCustomFoods = async (uid) => {
  const foodsRef = collection(db, "users", uid, "customFoods");
  const snap = await getDocs(foodsRef);
  const foods = [];
  snap.forEach(doc => {
    // Generate a pseudo-ID or just use the doc ID
    foods.push({ id: doc.id, ...doc.data() });
  });
  return foods;
};

/**
 * Log a workout and update the daily burned calories + Individual points.
 */
export const logUserWorkout = async (uid, workout) => {
  const workoutRef = collection(db, "users", uid, "workouts");
  await addDoc(workoutRef, {
    ...workout,
    timestamp: serverTimestamp()
  });

  // Update daily burned calories
  const currentLog = await getDailyLog(uid);
  const newTotal = (currentLog.caloriesBurned || 0) + (workout.calories || 0);
  await updateTodayMetric(uid, { caloriesBurned: newTotal });

  // Mark Activity for Consistency
  const today = getTodayStr();
  await updateDoc(doc(db, USER_COLLECTION, uid), {
    [`checkInHistory.${today}`]: true
  });

  // Award Points (+25)
  await addPoints(uid, 25);
};

/**
 * CHALLENGE SYSTEM (V5) - Points removed to prevent exploitation
 */
const CHALLENGE_POOL = [
  { id: 'steps_10k', title: 'Babcock 10k Sprint', desc: 'Complete 10,000 steps before the 10:00 AM lecture slot.' },
  { id: 'water_3l', title: 'Hydration Master', desc: 'Log at least 3 Liters of water today.' },
  { id: 'stadium_run', title: 'Amphitheatre Lap', desc: 'Log a running workout at the school stadium.' },
  { id: 'laz_otti_focus', title: 'Library Focus', desc: 'Log a 2-hour productive session at Laz Otti Library.' },
  { id: 'fruit_day', title: 'Freshman Fuel', desc: 'Include at least 2 fruit items in your logged meals.' },
  { id: 'no_soda', title: 'Soda-Free Campus', desc: 'Do not log any high-sugar beverages today.' },
  { id: 'morning_cardio', title: 'Sunrise Sweat', desc: 'Log a cardio session before 8:00 AM.' },
  { id: 'high_protein', title: 'Muscle Building', desc: 'Log a meal with over 40g of protein.' },
  { id: 'veggie_lover', title: 'Garden Enthusiast', desc: 'Log a meal consisting primarily of vegetables.' },
  { id: 'winslow_walk', title: 'Winslow Trail', desc: 'Walk from Winslow Hall to the main gate and back.' },
  { id: 'early_bird', title: 'Early Riser', desc: 'Log your first meal of the day before 7:30 AM.' },
  { id: 'meditation', title: 'Mindful Student', desc: 'Log a 15-minute mindfulness or meditation session.' },
  { id: 'sleep_8h', title: 'Restored Scholar', desc: 'Log 8 hours of sleep for the previous night.' },
  { id: 'campus_trek', title: 'Campus Explorer', desc: 'Visit 3 different landmarks and log your steps.' },
  { id: 'plank_3m', title: 'Core Crusher', desc: 'Complete and log a 3-minute total plank time.' },
  { id: 'pushup_50', title: 'Strength Base', desc: 'Complete 50 pushups throughout the day.' },
  { id: 'stair_climb', title: 'Vertical Gain', desc: 'Climb 5 flights of stairs in any hall of residence.' },
  { id: 'fast_walk', title: 'Babcock Power Walk', desc: 'Maintain a brisk walking pace for 30 continuous minutes.' },
  { id: 'no_junk', title: 'Clean Eater', desc: 'Eliminate processed snacks from your meal logs today.' },
  { id: 'gym_session', title: 'Weight Room King', desc: 'Complete a 45-minute weightlifting session.' },
  { id: 'cycling_10k', title: 'Babcock Cyclist', desc: 'Log 10km of cycling around the campus loops.' },
  { id: 'swim_laps', title: 'Pool Penguin', desc: 'Complete 10 laps in the school swimming pool.' },
  { id: 'yoga_flow', title: 'Flexible Mind', desc: 'Log a 20-minute yoga or stretching session.' },
  { id: 'heart_rate', title: 'Cardio King', desc: 'Maintain a heart rate above 130bpm for 20 minutes.' },
  { id: 'active_hour', title: 'Golden Hour', desc: 'Stay active for at least 60 non-consecutive minutes.' },
  { id: 'peer_workout', title: 'Squad Goals', desc: 'Log a workout session completed with a friend.' },
  { id: 'meal_prep', title: 'Prep Master', desc: 'Log 3 balanced meals for the entire day.' },
  { id: 'green_tea', title: 'Tea Taker', desc: 'Log a cup of green tea as part of your hydration.' },
  { id: 'squat_100', title: 'Leg Day Lead', desc: 'Complete 100 bodyweight squats today.' },
  { id: 'stretch_10m', title: 'Mobility Pro', desc: 'Log a 10-minute full body stretch before bed.' }
];

export const getDailyChallenges = () => {
  const now = new Date();
  const day = now.getDay(); // 0-6 (Sun-Sat)
  const hour = now.getHours();
  const dateStr = getTodayStr();

  // Saturday Rule: No challenges
  if (day === 6) return { type: 'REST_DAY', challenges: [] };

  // Friday Rule: Morning only (closes at 12 PM)
  if (day === 5 && hour >= 12) return { type: 'FRIDAY_CLOSED', challenges: [] };

  // Date-seeded random selection (pick 2)
  const seed = new Date(dateStr).getTime();
  const index1 = Math.floor((seed % 1234567) % CHALLENGE_POOL.length);
  const index2 = (index1 + 7) % CHALLENGE_POOL.length;

  return {
    type: 'ACTIVE',
    challenges: [CHALLENGE_POOL[index1], CHALLENGE_POOL[index2]]
  };
};

export const enrollInChallenge = async (challengeId, uid) => {
  const today = getTodayStr();
  const enrollId = `${challengeId}_${today}`;
  const enrollRef = doc(db, "challenge_enrollments", enrollId);
  
  const snap = await getDoc(enrollRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.participants.includes(uid)) return; // Already enrolled
    await updateDoc(enrollRef, {
      participants: [...data.participants, uid],
      count: (data.count || 0) + 1
    });
  } else {
    await setDoc(enrollRef, {
      id: challengeId,
      date: today,
      participants: [uid],
      count: 1
    });
  }

  // Update daily_log counter and checkInHistory
  const currentLog = await getDailyLog(uid);
  const newCount = (currentLog.challengesDone || 0) + 1;
  await updateTodayMetric(uid, { challengesDone: newCount });
  
  await updateDoc(doc(db, USER_COLLECTION, uid), {
    [`checkInHistory.${today}`]: true
  });
};

export const getChallengeParticipants = async (challengeId) => {
  const today = getTodayStr();
  const enrollId = `${challengeId}_${today}`;
  const enrollRef = doc(db, "challenge_enrollments", enrollId);
  const snap = await getDoc(enrollRef);
  
  if (!snap.exists()) return [];
  
  const pUids = snap.data().participants.slice(0, 5); // Get first 5 for UI
  const users = await Promise.all(pUids.map(async (pUid) => {
    const uSnap = await getDoc(doc(db, USER_COLLECTION, pUid));
    return uSnap.exists() ? uSnap.data().username : 'anonymous';
  }));
  
  return users;
};

export const getEnrollmentCount = async (challengeId) => {
  const today = getTodayStr();
  const enrollId = `${challengeId}_${today}`;
  const enrollRef = doc(db, "challenge_enrollments", enrollId);
  const snap = await getDoc(enrollRef);
  return snap.exists() ? snap.data().count : 0;
};

/**
 * LEADERBOARD LOGIC (v12)
 */
export const getLeaderboardData = async () => {
  const q = query(collection(db, USER_COLLECTION));
  const snap = await getDocs(q);
  const results = [];
  snap.forEach(doc => results.push({ uid: doc.id, ...doc.data() }));
  results.sort((a, b) => (b.points || 0) - (a.points || 0));
  return results.slice(0, 20);
};

export const searchFriends = async (searchQuery) => {
  const normalizedQuery = searchQuery.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
  if (!normalizedQuery) return [];
  
  const q = query(collection(db, USER_COLLECTION));
  const snap = await getDocs(q);
  const results = [];
  
  snap.forEach(doc => {
    const data = doc.data();
    const usernameMatch = data.username && String(data.username).toLowerCase().includes(normalizedQuery);
    const matricMatch = data.matricNumber && String(data.matricNumber).toLowerCase().includes(normalizedQuery);
    
    if (usernameMatch || matricMatch) {
      results.push({ uid: doc.id, ...data });
    }
  });
  return results;
};

/**
 * FRIEND SYSTEM API
 */

export const sendFriendRequest = async (currentUid, targetUid) => {
  if (!currentUid || !targetUid || currentUid === targetUid) return;
  
  const sentRef = doc(db, `users/${currentUid}/friendRequests`, targetUid);
  const pendingRef = doc(db, `users/${targetUid}/friendRequests`, currentUid);
  
  await setDoc(sentRef, { status: 'sent', timestamp: serverTimestamp() });
  await setDoc(pendingRef, { status: 'pending', timestamp: serverTimestamp() });
};

export const respondToFriendRequest = async (currentUid, targetUid, action) => {
  const currentReqRef = doc(db, `users/${currentUid}/friendRequests`, targetUid);
  const targetReqRef = doc(db, `users/${targetUid}/friendRequests`, currentUid);
  
  if (action === 'accept') {
    await updateDoc(currentReqRef, { status: 'accepted', updated_at: serverTimestamp() });
    await updateDoc(targetReqRef, { status: 'accepted', updated_at: serverTimestamp() });
  } else if (action === 'reject') {
    await deleteDoc(currentReqRef);
    await deleteDoc(targetReqRef);
  }
};

export const getFriendRequestsAndFriends = async (currentUid) => {
  if (!currentUid) return { friends: [], pending: [], sent: [] };
  
  const reqSnapshot = await getDocs(collection(db, `users/${currentUid}/friendRequests`));
  const friends = [];
  const pending = [];
  const sent = [];
  
  const uidsToFetch = [];
  
  reqSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    uidsToFetch.push({ uid: docSnap.id, status: data.status });
  });

  if (uidsToFetch.length === 0) return { friends, pending, sent };

  // Fetch user details for each (could be optimized with `in` query if chunked, 
  // but this is simpler and fine for small DB)
  await Promise.all(uidsToFetch.map(async (item) => {
    const uSnap = await getDoc(doc(db, USER_COLLECTION, item.uid));
    if (uSnap.exists()) {
      const uData = { uid: item.uid, ...uSnap.data() };
      if (item.status === 'accepted') friends.push(uData);
      else if (item.status === 'pending') pending.push(uData);
      else if (item.status === 'sent') sent.push(uData);
    }
  }));

  return { friends, pending, sent };
};

export const getChatId = (uid1, uid2) => {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
};

export const subscribeToChat = (currentUid, friendUid, callback) => {
  if (!currentUid || !friendUid) return () => {};
  const chatId = getChatId(currentUid, friendUid);
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach(docSnap => messages.push({ id: docSnap.id, ...docSnap.data() }));
    callback(messages);
  });
};

export const sendMessage = async (currentUid, friendUid, text, type = 'text', payload = null) => {
  if (!text || !text.trim()) return;
  const chatId = getChatId(currentUid, friendUid);
  await addDoc(collection(db, `chats/${chatId}/messages`), {
    senderId: currentUid,
    receiverId: friendUid,
    text: text.trim(),
    type,
    payload,
    timestamp: serverTimestamp(),
    read: false
  });
};

export const markMessagesAsRead = async (currentUid, friendUid) => {
  if (!currentUid || !friendUid) return;
  const chatId = getChatId(currentUid, friendUid);
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    where('receiverId', '==', currentUid),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  // Can just iterate updates without Promise.all since it's firestore cache queue
  snap.forEach(documentSnap => {
    updateDoc(doc(db, `chats/${chatId}/messages`, documentSnap.id), {
      read: true
    });
  });
};

/**
 * Subscribe to unread count for a specific friend.
 */
export const subscribeToUnreadCount = (currentUid, friendUid, callback) => {
  if (!currentUid || !friendUid) return () => {};
  const chatId = getChatId(currentUid, friendUid);
  const q = query(
    collection(db, `chats/${chatId}/messages`),
    where('receiverId', '==', currentUid),
    where('read', '==', false)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.size);
  });
};

/**
 * Get count of pending friend requests for a user.
 */
export const getPendingFriendRequestsCount = async (currentUid) => {
  if (!currentUid) return 0;
  const q = query(
    collection(db, `users/${currentUid}/friendRequests`),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.size;
};

/**
 * Get total unread message count across ALL chats.
 * Refactored to avoid collectionGroup index dependency.
 */
export const getTotalUnreadMessagesCount = async (currentUid) => {
  if (!currentUid) return 0;
  
  // Get all friends first
  const friendsSnap = await getDocs(collection(db, `users/${currentUid}/friends`));
  let totalUnread = 0;

  for (const friendDoc of friendsSnap.docs) {
    const friendUid = friendDoc.id;
    const chatId = getChatId(currentUid, friendUid);
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      where('receiverId', '==', currentUid),
      where('read', '==', false)
    );
    const msgSnap = await getDocs(q);
    totalUnread += msgSnap.size;
  }
  
  return totalUnread;
};


export const getCourseLeaderboardData = async () => {
  const q = query(collection(db, USER_COLLECTION));
  const snap = await getDocs(q);
  const courseTotals = {};

  snap.forEach(doc => {
    const data = doc.data();
    const course = data.courseOfStudy || 'Unknown';
    const points = data.points || 0;

    if (!courseTotals[course]) {
      courseTotals[course] = { name: course, totalPoints: 0, studentCount: 0 };
    }
    courseTotals[course].totalPoints += points;
    courseTotals[course].studentCount += 1;
  });

  return Object.values(courseTotals).sort((a, b) => b.totalPoints - a.totalPoints);
};

export const checkWeeklyBonus = async (uid) => {
  const userRef = doc(db, USER_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  const userData = userSnap.data();

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 is Sunday
  if (dayOfWeek !== 0) return null; // Only check on Sundays

  const lastCheck = userData.lastWeeklyConsistencyCheck;
  const todayStr = getTodayStr();
  if (lastCheck === todayStr) return null; // Already checked today

  // Check last 7 days checkInHistory
  let consecutiveDays = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    if (userData.checkInHistory && userData.checkInHistory[dStr]) {
      consecutiveDays++;
    }
  }

  if (consecutiveDays >= 7) {
    await addPoints(uid, 100);
    await updateDoc(userRef, { lastWeeklyConsistencyCheck: todayStr });
    return true; // Bonus awarded
  }

  return false;
};
