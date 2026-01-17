import { ConsistencyScore, ConsistencyMetrics, SessionSummary, DailySessionCount } from "./types";

/**
 * Calculate consistency score (0-100) based on 28 days of exercise sessions
 *
 * Scoring breakdown:
 * - 50 points: Activity frequency (days with activity / 28)
 * - 25 points: Gap penalty (inverse of longest gap)
 * - 15 points: Weekly spread (how well distributed across week)
 * - 10 points: Intensity bonus (multiple sessions per day)
 */
export function calculateConsistencyScore(
  sessions: SessionSummary[],
  referenceDate: Date = new Date()
): ConsistencyScore {
  // Define 28-day window
  const periodEnd = new Date(referenceDate);
  periodEnd.setUTCHours(23, 59, 59, 999);


  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 27);
  periodStart.setUTCHours(0, 0, 0, 0);

  // Calculate metrics
  const metrics = calculateMetrics(sessions, periodStart, periodEnd);

  // Calculate score components
  const frequencyScore = calculateFrequencyScore(metrics);
  const gapScore = calculateGapScore(metrics);
  const distributionScore = calculateDistributionScore(metrics);
  const intensityScore = calculateIntensityScore(metrics);

  const totalScore = Math.round(frequencyScore + gapScore + distributionScore + intensityScore);

  // Generate explanations
  const explanations = generateExplanations(metrics);

  // Generate chart data
  const chartData = generateChartData(sessions, periodStart, periodEnd);

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    explanations,
    chartData,
    periodStart: periodStart.toISOString().split("T")[0],
    periodEnd: periodEnd.toISOString().split("T")[0],
  };
}

function calculateMetrics(
  sessions: SessionSummary[],
  periodStart: Date,
  periodEnd: Date
): ConsistencyMetrics {
  const relevantSessions = sessions.filter(
    (s) => s.startDate >= periodStart && s.startDate <= periodEnd
  );
  // Group sessions by day
  // <Date, Number of sessions on that day>
  const sessionsByDay = new Map<string, number>();
  const weeklyDistribution = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat

  for (const session of relevantSessions) {
    const dateKey = session.startDate.toISOString().split("T")[0];
    sessionsByDay.set(dateKey, (sessionsByDay.get(dateKey) || 0) + 1);

    const dayOfWeek = session.startDate.getUTCDay();
    weeklyDistribution[dayOfWeek]++;
  }

  const daysWithActivity = sessionsByDay.size;

  // Calculate longest gap
  const longestGap = calculateLongestGap(sessionsByDay, periodStart, periodEnd);

  // Calculate average sessions per active day
  const totalSessions = relevantSessions.length;
  const averageSessionsPerActiveDay = daysWithActivity > 0 ? totalSessions / daysWithActivity : 0;

  return {
    totalDays: 28,
    daysWithActivity,
    longestGap,
    averageSessionsPerActiveDay,
    weeklyDistribution,
    totalSessions,
  };
}

function calculateLongestGap(
  sessionsByDay: Map<string, number>,
  periodStart: Date,
  periodEnd: Date
): number {
  if (sessionsByDay.size === 0) return 28;

  const activeDates = Array.from(sessionsByDay.keys())
  .map(d => new Date(d + "T00:00:00Z")) // force UTC
  .sort((a, b) => a.getTime() - b.getTime());
  let maxGap = 0;

  // Check gap from period start to first activity
  const firstActivity = new Date(activeDates[0]);
  const gapFromStart = Math.floor(
    (firstActivity.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  maxGap = Math.max(maxGap, gapFromStart);

  // Check gaps between activities
  for (let i = 1; i < activeDates.length; i++) {
    const prev = new Date(activeDates[i - 1]);
    const curr = new Date(activeDates[i]);
    const gap = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)) - 1;
    maxGap = Math.max(maxGap, gap);
  }

  // Check gap from last activity to period end
  const lastActivity = new Date(activeDates[activeDates.length - 1]);
  const gapToEnd = Math.floor(
    (periodEnd.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );
  maxGap = Math.max(maxGap, gapToEnd);

  return maxGap;
}

function calculateFrequencyScore(metrics: ConsistencyMetrics): number {
  // 50 points max: linear scale based on days with activity
  return (metrics.daysWithActivity / metrics.totalDays) * 50;
}

function calculateGapScore(metrics: ConsistencyMetrics): number {
  // 25 points max: penalize long gaps
  // Gap of 0-3 days: full points
  // Gap of 14+ days: 0 points
  // metrics.longestGap = 3 → (14 - 3) / 11 = 1
  // metrics.longestGap = 14 → (14 - 14) / 11 = 0
  //In between scales linearly.
  if (metrics.longestGap <= 3) return 25;
  if (metrics.longestGap >= 14) return 0;

  const normalized = (14 - metrics.longestGap) / 11;
  return normalized * 25;
}

function calculateDistributionScore(metrics: ConsistencyMetrics): number {
  // 15 points max: reward even distribution across week
  if (metrics.daysWithActivity === 0) return 0;

  const daysWithActivityInWeek = metrics.weeklyDistribution.filter((count) => count > 0).length;

  return (daysWithActivityInWeek / 7) * 15;
}

function calculateIntensityScore(metrics: ConsistencyMetrics): number {
  // 10 points max: bonus for multiple sessions per day
  // metrics.averageSessionsPerActiveDay >= 2 → (2 - 1) / 10 = 10
  // metrics.averageSessionsPerActiveDay <= 1 → (1 - 1) / 10 = 0
  //In between scales linearly.
  if (metrics.daysWithActivity === 0) return 0;

  const ratio = metrics.averageSessionsPerActiveDay;
  if (ratio >= 2) return 10;
  if (ratio <= 1) return 0;

  return (ratio - 1) * 10;
}

function generateExplanations(metrics: ConsistencyMetrics): string[] {
  const explanations: string[] = [];

  // Always include active days
  explanations.push(`You trained on ${metrics.daysWithActivity} out of 28 days`);

  // Include longest gap
  if (metrics.longestGap === 0) {
    explanations.push("Amazing! No gaps in your training");
  } else if (metrics.longestGap === 1) {
    explanations.push("Longest break: 1 day");
  } else {
    explanations.push(`Longest break: ${metrics.longestGap} days`);
  }

  // Include weekly spread
  const daysOfWeek = metrics.weeklyDistribution.filter((c) => c > 0).length;
  if (daysOfWeek >= 6) {
    explanations.push("Great variety! You trained on 6+ different weekdays");
  } else if (daysOfWeek >= 4) {
    explanations.push(`Good spread across ${daysOfWeek} different weekdays`);
  } else if (daysOfWeek > 0) {
    explanations.push(`Training focused on ${daysOfWeek} weekdays`);
  }

  // Include intensity if notable
  if (metrics.averageSessionsPerActiveDay >= 1.4) {
    explanations.push(
      `High intensity: ${metrics.averageSessionsPerActiveDay.toFixed(1)} sessions per active day`
    );
  }

  return explanations;
}

function generateChartData(
  sessions: SessionSummary[],
  periodStart: Date,
  periodEnd: Date
): DailySessionCount[] {
  const relevantSessions = sessions.filter(
    (s) => s.startDate >= periodStart && s.startDate <= periodEnd
  );

  const countsByDay = new Map<string, number>();

  for (const session of relevantSessions) {
    const dateKey = session.startDate.toISOString().split("T")[0];
    countsByDay.set(dateKey, (countsByDay.get(dateKey) || 0) + 1);
  }

  // Generate all 28 days with counts
  const chartData: DailySessionCount[] = [];
  const current = new Date(periodStart);

  for (let i = 0; i < 28; i++) {
    const dateKey = current.toISOString().split("T")[0];
    chartData.push({
      date: dateKey,
      count: countsByDay.get(dateKey) || 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return chartData;
}
