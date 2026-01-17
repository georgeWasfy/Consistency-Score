export interface ExerciseEvent {
  eventId: string; // Client-generated unique ID for event
  sessionId: string; // A session groups a series of events
  userId: string;
  eventType: "start" | "update" | "end";
  timestamp: number; // Unix ms - when event occurred on client
  normalizedTimestamp?: number; // this is added by the server if a clock drift is detected
  metrics?: {
    distance?: number; // meters
    duration?: number; // seconds
    calories?: number;
    heartRate?: number; // bpm
  };
  sequenceNum?: number; // Optional client-side ordering hint
}

export interface SessionDocument {
  sessionId: string;
  userId: string;
  status: "active" | "completed" | "abandoned";

  // Aggregate metrics
  totalDistance: number;
  totalDuration: number;
  totalCalories: number;
  avgHeartRate: number | null;

  startTime: number;
  endTime: number;
  lastEventTime: number; // Time stamp for most recent event

  // Idempotency tracking
  processedEventIds: Set<string>; // eventIds already processe
  processedEvents: ExerciseEvent[]; // Tracking all events for historical references
  eventCount: number;
  lastSequenceNum: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  version: number; // Optimistic locking
}

export type SessionSummary = Pick<
  SessionDocument,
  "sessionId" | "userId" 
> & { startDate: Date; endDate: Date; durationMinutes: number };

/**
 * Daily aggregated sessions for chart data
 */
export interface DailySessionCount {
  date: string; // ISO date string (YYYY-MM-DD)
  count: number;
}

/**
 * The consistency score result
 */
export interface ConsistencyScore {
  score: number; // 0-100
  explanations: string[];
  chartData: DailySessionCount[];
  periodStart: string; // ISO date string
  periodEnd: string; // ISO date string
}

/**
 * Internal metrics used for score calculation
 */
export interface ConsistencyMetrics {
  totalDays: number;
  daysWithActivity: number;
  longestGap: number;
  averageSessionsPerActiveDay: number;
  weeklyDistribution: number[]; // 7 elements for each day of week
  totalSessions: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  userId?: string;
  referenceDate?: Date;
}
