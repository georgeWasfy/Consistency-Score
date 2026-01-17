import { Firestore } from "@google-cloud/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { SessionSummary } from "./types";
import { calculateConsistencyScore } from "./scoring";
import { validate } from "./validation";

/**
 * Fetch all exercise sessions for a user within the last 28 days
 *
 * Required Firestore Index:
 * Collection: sessions
 * Fields indexed: userId (ASC), startTime (DESC)
 *
 * Why this index?
 * - userId: Filter sessions by specific user
 * - startTime (DESC): Range query to get last 28 days + ordering for efficient retrieval
 *
 * This avoids N+1 queries by fetching all required sessions in a single query.
 */
export async function fetchUserSessions(
  db: Firestore,
  userId: string,
  referenceDate: Date = new Date()
): Promise<SessionSummary[]> {
  // Calculate 28 days ago from reference date
  const periodStart = new Date(referenceDate);
  periodStart.setDate(periodStart.getDate() - 27);
  periodStart.setHours(0, 0, 0, 0);

  try {
    console.log("🚀 ~ fetchUserSessions ~ periodStart:", periodStart.getTime());
    console.log("🚀 ~ fetchUserSessions ~ referenceDate:", referenceDate.getTime());

    // Single query with compound filter
    const snapshot = await db
      .collection("sessions")
      .where("userId", "==", userId)
      .where("startTime", ">=", periodStart.getTime())
      .where("startTime", "<=", referenceDate.getTime())
      .orderBy("startTime", "desc")
      .get();

    // Map Firestore documents to SessionSummary objects
    const sessions: SessionSummary[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: data.userId,
        sessionId: data.sessionId,
        totalDistance: data.totalDistance,
        totalCalories: data.totalCalories,
        totalDuration: data.totalDuration,
        startDate: new Date(data.startTime),
        endDate: new Date(data.endTime),
        durationMinutes: (data.endTime - data.startTime) / 60000,
      };
    });

    return sessions;
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    throw new Error("Failed to fetch exercise sessions from Firestore");
  }
}

/**
 * HTTP endpoint for getting user consistency score.
 * GET /getConsistencyScore?userId=xxx&referenceDate=2024-02-15T23:59:59Z
 */
export const getConsistencyScore = onRequest(async (req, res) => {
  // Initialize Firestore
  const db = new Firestore({
    projectId: "demo-no-project",
    host: "127.0.0.1:8080", // Firestore emulator host
    ssl: false,
  });

  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET." });
    return;
  }

  // Extract query parameters
  const userId = req.query.userId as string | undefined;
  const referenceDate = req.query.referenceDate as string | undefined;

  // Validate request
  const validation = validate(userId, referenceDate);

  if (!validation.valid) {
    res.status(400).json({
      error: "Validation failed",
      details: validation.errors,
    });
    return;
  }

  const validUserId = validation.userId!;
  const validReferenceDate = validation.referenceDate || new Date();
  console.log("🚀 ~ validReferenceDate:", validReferenceDate);

  try {
    // Fetch user sessions
    const sessions = await fetchUserSessions(db, validUserId, validReferenceDate);
    console.log("🚀 ~ sessions:", sessions);

    // Calculate consistency score
    const result = calculateConsistencyScore(sessions, validReferenceDate);

    // Return result
    res.status(200).json({
      success: true,
      userId: validUserId,
      ...result,
    });
  } catch (error) {
    console.error("Consistency score calculation error:", error);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : "Failed to calculate consistency score",
    });
  }
});
