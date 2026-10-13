import { adminDb } from "./firebaseAdmin";
import { getConfig } from "./platformConfig";
import { writeJobEvent } from "./jobEvents";
import { JobRequestData, JobPrivateDetails } from "@/types/platform";

/**
 * Calculates haversine distance in meters between two lat/lng coordinates.
 */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const toRad = (val: number) => (val * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Records a location ping from the artisan during an active job and performs geofence arrival detection.
 */
export async function recordLocationPing(params: {
  jobId: string;
  artisanId: string;
  lat: number;
  lng: number;
}): Promise<{ recorded: boolean; distanceMeters: number | null; arrivedViaGeofence: boolean }> {
  const { jobId, artisanId, lat, lng } = params;
  const config = await getConfig();

  const jobRef = adminDb.collection("jobRequests").doc(jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    throw new Error(`Job ${jobId} not found`);
  }

  const job = jobSnap.data() as JobRequestData;

  // Retrieve exact coordinates from private details
  const privateRef = jobRef.collection("private").doc("details");
  const privateSnap = await privateRef.get();

  let distanceMeters: number | null = null;
  if (privateSnap.exists) {
    const details = privateSnap.data() as JobPrivateDetails;
    if (details.exactLat && details.exactLng) {
      distanceMeters = haversineDistanceMeters(lat, lng, details.exactLat, details.exactLng);
    }
  }

  // 1. Write point to locationTrail
  const trailRef = jobRef.collection("locationTrail").doc();
  await trailRef.set({
    pointId: trailRef.id,
    artisanId,
    lat,
    lng,
    distanceMeters,
    at: Date.now()
  });

  // Update last known location ping time
  await jobRef.update({
    lastLocationPingAt: Date.now(),
    locationUnavailable: false
  });

  let arrivedViaGeofence = false;

  // 2. Geofence arrival check (only if job is currently en_route)
  if (job.state === "en_route" && distanceMeters !== null) {
    const radiusMeters = config.arrival.radiusMeters || 300;
    const requiredPings = config.arrival.consecutivePings || 3;

    // Fetch the last N pings to check consecutive condition
    const recentPingsSnap = await jobRef
      .collection("locationTrail")
      .orderBy("at", "desc")
      .limit(requiredPings)
      .get();

    if (recentPingsSnap.size >= requiredPings) {
      const allWithinRadius = recentPingsSnap.docs.every(d => {
        const dM = d.data().distanceMeters;
        return typeof dM === "number" && dM <= radiusMeters;
      });

      if (allWithinRadius) {
        // Trigger arrival!
        await adminDb.runTransaction(async (tx) => {
          tx.update(jobRef, {
            status: "arrived",
            state: "arrived",
            stateUpdatedAt: Date.now(),
            arrivedAt: Date.now(),
            arrivalSource: "geofence"
          });

          await writeJobEvent(
            jobId,
            "arrived_geofence",
            "system",
            { distanceMeters, radiusMeters, lat, lng },
            tx
          );
        });

        // Send push notification to customer
        if (job.customerId) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          fetch(`${baseUrl}/api/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: job.customerId,
              title: "Technician Has Arrived!",
              body: "Your technician has arrived at your location. Tap to view.",
              data: { jobId, type: "technician_arrived" }
            })
          }).catch(console.error);
        }

        arrivedViaGeofence = true;
      }
    }
  }

  return {
    recorded: true,
    distanceMeters,
    arrivedViaGeofence
  };
}

/**
 * Handles manual arrival trigger by artisan.
 */
export async function recordManualArrival(params: {
  jobId: string;
  artisanId: string;
  lat?: number;
  lng?: number;
}): Promise<{ success: boolean; distanceMeters: number | null }> {
  const { jobId, artisanId, lat, lng } = params;

  const jobRef = adminDb.collection("jobRequests").doc(jobId);
  const jobSnap = await jobRef.get();

  if (!jobSnap.exists) {
    throw new Error(`Job ${jobId} not found`);
  }

  const job = jobSnap.data() as JobRequestData;
  if (job.artisanId !== artisanId) {
    throw new Error("Unauthorized artisan");
  }

  let distanceMeters: number | null = null;
  if (lat && lng) {
    const privateSnap = await jobRef.collection("private").doc("details").get();
    if (privateSnap.exists) {
      const details = privateSnap.data() as JobPrivateDetails;
      if (details.exactLat && details.exactLng) {
        distanceMeters = haversineDistanceMeters(lat, lng, details.exactLat, details.exactLng);
      }
    }
  }

  await adminDb.runTransaction(async (tx) => {
    tx.update(jobRef, {
      status: "arrived",
      state: "arrived",
      stateUpdatedAt: Date.now(),
      arrivedAt: Date.now(),
      arrivalSource: "manual",
      manualArrivalDistanceMeters: distanceMeters
    });

    await writeJobEvent(
      jobId,
      "arrived_manual",
      artisanId,
      { distanceMeters, lat, lng },
      tx
    );
  });

  // Send push notification to customer
  if (job.customerId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${baseUrl}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: job.customerId,
        title: "Technician Has Arrived!",
        body: "Your technician has arrived at your location. Tap to view.",
        data: { jobId, type: "technician_arrived" }
      })
    }).catch(console.error);
  }

  return { success: true, distanceMeters };
}
