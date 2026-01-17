import { calculateConsistencyScore } from "./scoring";
import { SessionSummary } from "./types";

describe("Consistency Score Calculator", () => {
  // Helper to create sessions
  function createSession(daysAgo: number, referenceDate: Date): SessionSummary {
    const startDate = new Date(referenceDate);
    startDate.setUTCDate(startDate.getUTCDate() - daysAgo);
    startDate.setUTCHours(10, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setUTCMinutes(endDate.getUTCMinutes() + 45);

    return {
      sessionId: Math.random().toString(36).substring(2, 7),
      userId: "test-user",
      startDate,
      endDate,
      durationMinutes: 45,
    };
  }

  describe("Test 1: Sparse Data (Low Consistency)", () => {
    it("should score low for infrequent training with large gaps", () => {
      const referenceDate = new Date("2024-02-15T23:59:59Z");

      // Only 3 sessions across 28 days with big gaps
      const sessions: SessionSummary[] = [
        createSession(1, referenceDate), // Day 27
        createSession(14, referenceDate), // Day 14
        createSession(27, referenceDate), // Day 1
      ];

      const result = calculateConsistencyScore(sessions, referenceDate);

      // Expectations:
      // - 3/28 days active = ~10.7% frequency score = 5.35/50
      // - Longest gap is 13 days = minimal gap score ~2.27/25
      // - Weekly distribution will be low
      expect(result.score).toBeLessThan(25);
      expect(result.score).toBeGreaterThanOrEqual(0);

      expect(result.explanations).toContain("You trained on 3 out of 28 days");
      expect(result.explanations.some((e) => e.includes("Longest break"))).toBe(true);

      expect(result.chartData).toHaveLength(28);
      expect(result.chartData.filter((d) => d.count > 0)).toHaveLength(3);
    });
  });

  describe("Test 2: Dense Data (High Consistency)", () => {
    it("should score high for frequent training with small gaps", () => {
      const referenceDate = new Date("2024-02-15T23:59:59Z");

      // Train 20 out of 28 days with good distribution
      const sessions: SessionSummary[] = [];

      // Create sessions every ~1.4 days on average
      for (let day = 0; day < 28; day++) {
        if (day % 7 === 0 || day % 7 === 2 || day % 7 === 4 || day % 7 === 6) {
          sessions.push(createSession(day, referenceDate));
        }
      }

      const result = calculateConsistencyScore(sessions, referenceDate);

      // Expectations:
      // - 16/28 days = 57% frequency score = 28.5/50
      // - Longest gap ~2 days = full gap score = 25/25
      // - Good weekly distribution
      // - Should score 60-80 range
      expect(result.score).toBeGreaterThan(60);
      expect(result.score).toBeLessThanOrEqual(100);

      expect(result.explanations.some((e) => e.includes("out of 28 days"))).toBe(true);
      expect(result.chartData.filter((d) => d.count > 0).length).toBeGreaterThan(10);
    });
  });

  describe("Test 3: Timezone Boundary Edge Case", () => {
    it("should handle sessions near midnight correctly", () => {
      const referenceDate = new Date("2024-02-15T23:59:59Z");

      // Create sessions at different times of day including near midnight
      const sessions: SessionSummary[] = [];

      // Session just before midnight
      const session1 = createSession(5, referenceDate);
      session1.startDate.setUTCHours(23, 45, 0, 0);
      sessions.push(session1);

      // Session just after midnight (next day)
      const session2 = createSession(4, referenceDate);
      session2.startDate.setUTCHours(0, 15, 0, 0);
      sessions.push(session2);

      // Session in middle of day
      const session3 = createSession(3, referenceDate);
      session3.startDate.setUTCHours(12, 0, 0, 0);
      sessions.push(session3);

      const result = calculateConsistencyScore(sessions, referenceDate);

      // Should count as 3 separate days
      expect(result.explanations[0]).toContain("You trained on 3 out of 28 days");

      // Chart data should show sessions on correct dates
      const activeDays = result.chartData.filter((d) => d.count > 0);
      expect(activeDays).toHaveLength(3);
    });
  });

  describe("Test 4: Weird Timestamps (Sessions Out of Order)", () => {
    it("should handle unsorted sessions and edge timestamps", () => {
      const referenceDate = new Date("2024-02-15T23:59:59.999Z");

      // Create sessions in random order with unusual times
      const sessions: SessionSummary[] = [];

      // Session at exact reference time
      const s1 = createSession(0, referenceDate);
      s1.startDate = new Date(referenceDate);
      s1.startDate.setUTCHours(0, 0, 0, 0); 
      sessions.push(s1);

      // Session at exact start of period
      const s2 = createSession(27, referenceDate);
      s2.startDate = new Date(referenceDate);
      s2.startDate.setUTCDate(s2.startDate.getUTCDate() - 27);
      s2.startDate.setUTCHours(0, 0, 0, 0);
      sessions.push(s2);

      // Session in middle (added last to test sorting)
      const s3 = createSession(10, referenceDate);
      sessions.push(s3);

      // Session with milliseconds precision
      const s4 = createSession(15, referenceDate);
      s4.startDate.setUTCMilliseconds(789);
      sessions.push(s4);

      // Multiple sessions on same day (different times)
      const s5 = createSession(5, referenceDate);
      s5.startDate.setUTCHours(8, 0, 0, 0);
      sessions.push(s5);

      const s6 = createSession(5, referenceDate);
      s6.startDate.setUTCHours(12, 30, 0, 0);
      sessions.push(s6);

      const s7 = createSession(5, referenceDate);
      s7.startDate.setUTCHours(18, 30, 0, 0);
      sessions.push(s7);

      const result = calculateConsistencyScore(sessions, referenceDate);

      // Should handle all sessions correctly
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Should count 5 unique days (day 0, 5, 10, 15, 27)
      expect(result.explanations[0]).toContain("You trained on 5 out of 28 days");

      // Day with 2 sessions should show count of 2
      const dayWith3Sessions = result.chartData.find((d) => d.count === 3);
      expect(dayWith3Sessions).toBeDefined();

      // Should have intensity bonus mentioned
      expect(
        result.explanations.some(
          (e) => e.includes("sessions per active day") || e.includes("intensity")
        )
      ).toBe(true);
    });
  });

  describe("Edge Case: No Sessions", () => {
    it("should return 0 score with appropriate message for no sessions", () => {
      const referenceDate = new Date("2024-02-15T23:59:59Z");
      const sessions: SessionSummary[] = [];

      const result = calculateConsistencyScore(sessions, referenceDate);

      expect(result.score).toBe(0);
      expect(result.explanations[0]).toContain("You trained on 0 out of 28 days");
      expect(result.chartData.every((d) => d.count === 0)).toBe(true);
    });
  });

  describe("Edge Case: Perfect Consistency", () => {
    it("should score near 100 for training every day with multiple sessions", () => {
      const referenceDate = new Date("2024-02-15T23:59:59Z");
      const sessions: SessionSummary[] = [];

      // Train every day, some days with 2 sessions
      for (let day = 0; day < 28; day++) {
        sessions.push(createSession(day, referenceDate));

        // Add second session every 3rd day
        if (day % 3 === 0) {
          const extraSession = createSession(day, referenceDate);
          extraSession.startDate.setHours(18, 0, 0, 0);
          sessions.push(extraSession);
        }
      }

      const result = calculateConsistencyScore(sessions, referenceDate);

      // Should score very high
      expect(result.score).toBeGreaterThan(90);
      expect(result.explanations[0]).toContain("You trained on 28 out of 28 days");
      expect(result.chartData.every((d) => d.count > 0)).toBe(true);
    });
  });
});
