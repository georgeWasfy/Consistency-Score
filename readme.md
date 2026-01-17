# 28-Day Consistency Score v1

A simple, explainable consistency scoring system for exercise tracking. Returns a score from 0-100 based on the last 28 days of activity, with clear explanations and minimal chart data.



## Scoring Algorithm

The score is composed of 4 weighted components:

### 1. Frequency Score (50 points max)
- **Formula**: `(daysWithActivity / 28) × 50`
- Rewards consistency in sessions creations
- Scales linearly with daysWithActivity 

### 2. Gap Score (25 points max)
- **Formula**: 
  - 14 days is what I defined as maximum gap period
  - Gaps 0-3 days: 25 points
  - Gaps 14+ days: 0 points
  - Linear interpolation between `(14 - longestGap) / 11 = 0`
- Penalizes long breaks

### 3. Distribution Score (15 points max)
- **Formula**: `(uniqueWeekdaysWithActivity / 7) × 15`
- Rewards training on different days of the week
- The more spread the training sessions are the more score you acheive

### 4. Intensity Score (10 points max)
- **Formula**: 
  - 1 session/day average: 0 points
  - 2+ sessions/day average: 10 points
  - Linear interpolation between

**Total**: Sum of all components, capped at 100

---

## Manual Example Walkthrough

Let's calculate the score for a user who trained **9 days out of 28** with the following pattern:

### Sample Data
```
Training days: Day 1, 5, 8, 10, 15, 17, 22, 24, 27 (9 total)
- Day 1: 1 session (Monday)
- Day 5: 2 sessions (Friday) 
- Day 8: 1 session (Monday)
- Day 10: 1 session (Wednesday)
- Day 15: 1 session (Monday)
- Day 17: 1 session (Wednesday)
- Day 22: 1 session (Monday)
- Day 24: 1 session (Wednesday)
- Day 27: 1 session (Saturday)

Total sessions: 10
```

### Step-by-Step Calculation

#### Step 1: Calculate Metrics

**Days with activity**: 9 out of 28

**Total sessions**: 10

**Average sessions per active day**: 10 / 9 = 1.11

**Longest gap**: 
- Day 1 → 5: 3 days
- Day 5 → 8: 2 days
- Day 8 → 10: 1 day
- Day 10 → 15: 4 days
- Day 15 → 17: 1 day
- Day 17 → 22: 4 days
- Day 22 → 24: 1 day
- Day 24 → 27: 2 days
- **Maximum**: 4 days

**Weekly distribution**:
- Monday: 4 sessions (Days 1, 8, 15, 22)
- Wednesday: 3 sessions (Days 10, 17, 24)
- Friday: 1 session (Day 5)
- Saturday: 1 session (Day 27)
- **Unique weekdays**: 4 out of 7

#### Step 2: Calculate Component Scores

**Frequency Score**:
```
(9 / 28) × 50 = 0.321 × 50 = 16.07 points
```

**Gap Score** (longest gap = 4 days):
```
Gap is between 3 and 14 days, so:
normalized = (14 - 4) / 11 = 10/11 = 0.909
score = 0.909 × 25 = 22.73 points
```

**Distribution Score** (4 unique weekdays):
```
(4 / 7) × 15 = 0.571 × 15 = 8.57 points
```

**Intensity Score** (1.11 avg sessions/day):
```
Average is between 1 and 2, so:
(1.11 - 1) × 10 = 0.11 × 10 = 1.1 points
```

#### Step 3: Sum Total Score

```
Total = 16.07 + 22.73 + 8.57 + 1.1
      = 48.47
      = 48 (rounded)
```

### Final Result

```json
{
  "score": 48,
  "explanations": [
    "You trained on 9 out of 28 days",
    "Longest break: 4 days",
    "Good spread across 4 different weekdays",
    "High intensity: 1.1 sessions per active day"
  ],
  "chartData": [
    { "date": "2024-01-19", "count": 1 },
    { "date": "2024-01-20", "count": 0 },
    ...
    { "date": "2024-01-23", "count": 2 },
    ...
  ],
  "periodStart": "2024-01-19",
  "periodEnd": "2024-02-15"
}
```


---


## Required Index

Create a composite index for efficient queries:

```
Collection: exercise_sessions
Fields: 
  - userId (Ascending)
  - startTime (Descending)
```

### Why This Index?

1. **userId**: Filters sessions to a specific user
2. **startTime (DESC)**: Enables range query (>= 28 days ago) AND ordering





### Why These Score Weights?

- **Frequency (50%)**: Most important - showing up matters most
- **Gaps (25%)**: Consistency over time matters
- **Distribution (15%)**: Variety prevents burnout
- **Intensity (10%)**: Nice bonus but not required


## Future Enhancements (Not in v1)

- Strain score based on average heartrate in session
- Activity type breakdown
- Streak tracking

---

## How to run
```bash
cd functions
npm install
npm run build

# In root directory
 firebase emulators:start --only functions

```

## Testing

Run the test suite:

```bash
cd functions
npm test
```

### Test Coverage

1. **Sparse Data**: Low frequency, large gaps → Low score
2. **Dense Data**: High frequency, small gaps → High score  
3. **Timezone Boundary**: Sessions near midnight handled correctly
4. **Weird Timestamps**: Unsorted data, millisecond precision, duplicate days

