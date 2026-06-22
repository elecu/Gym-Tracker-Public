/**
 * Responder classification & strength-trend estimation.
 *
 * Standalone, rewritten sample extracted from RepStack's analytics engine —
 * decoupled from the app's internal state shape, Drive sync, and UI layer.
 * Demonstrates the kind of derived-metric logic that turns raw set logs
 * (reps x weight) into actionable training feedback.
 *
 * Scientific basis:
 * - Epley (1985) 1RM estimation formula
 * - Grgic et al. (2017), Schoenfeld (2010) — hypertrophy/strength adaptation rates
 * - Individual variability in strength response is well documented in the
 *   resistance-training literature (responders vs. low-responders)
 */

/**
 * Estimates a one-rep max from a submaximal set using the Epley formula.
 * @param {number} weightKg
 * @param {number} reps
 * @returns {number} estimated 1RM in kg, or 0 for invalid input
 */
function estimateE1rm(weightKg, reps) {
  if (!weightKg || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * Classifies a lifter's strength trend over a series of sets.
 * @param {{ date: string | Date, weightKg: number, reps: number }[]} sets
 * @returns {{ pctPerMonth: string, isHighResponder: boolean } | null}
 *          null when there isn't enough data (fewer than 10 logged sets)
 *          to draw a meaningful trend.
 */
function classifyResponderStatus(sets) {
  const e1rms = sets
    .filter((s) => s.weightKg && s.reps)
    .map((s) => ({ date: new Date(s.date), e1rm: estimateE1rm(s.weightKg, s.reps) }))
    .sort((a, b) => a.date - b.date);

  if (e1rms.length < 10) return null;

  const first = e1rms[0];
  const last = e1rms[e1rms.length - 1];
  if (first.e1rm <= 0) return null;

  const daysSpan = (last.date - first.date) / (1000 * 60 * 60 * 24);
  const monthsSpan = Math.max(daysSpan / 30.44, 0.5);
  const pctGainPerMonth = ((last.e1rm - first.e1rm) / first.e1rm / monthsSpan) * 100;

  return {
    pctPerMonth: pctGainPerMonth.toFixed(1),
    isHighResponder: pctGainPerMonth >= 3,
  };
}

/**
 * Estimates a realistic strength-gain ceiling based on training age, so
 * progress feedback doesn't set unrealistic expectations for experienced
 * lifters (novice gains taper off well-documented in the literature).
 * @param {number} trainingAgeMonths
 * @returns {{ trainingAgeMonths: number, expectedKgGainPerYear: number }}
 */
function estimateExpectedGainCap(trainingAgeMonths) {
  let expectedKgGainPerYear;
  if (trainingAgeMonths < 6) expectedKgGainPerYear = 1.5; // novice phase
  else if (trainingAgeMonths < 12) expectedKgGainPerYear = 1.0; // slowing
  else if (trainingAgeMonths < 24) expectedKgGainPerYear = 0.5; // plateau onset
  else expectedKgGainPerYear = 0.25; // long-term maintenance

  return {
    trainingAgeMonths: Math.round(trainingAgeMonths),
    expectedKgGainPerYear,
  };
}

module.exports = { estimateE1rm, classifyResponderStatus, estimateExpectedGainCap };

// --- Example usage ---
if (require.main === module) {
  const sampleSets = [
    { date: "2026-01-05", weightKg: 80, reps: 5 },
    { date: "2026-01-12", weightKg: 82.5, reps: 5 },
    { date: "2026-01-19", weightKg: 85, reps: 5 },
    { date: "2026-01-26", weightKg: 85, reps: 6 },
    { date: "2026-02-02", weightKg: 87.5, reps: 5 },
    { date: "2026-02-09", weightKg: 90, reps: 4 },
    { date: "2026-02-16", weightKg: 90, reps: 5 },
    { date: "2026-02-23", weightKg: 92.5, reps: 4 },
    { date: "2026-03-02", weightKg: 92.5, reps: 5 },
    { date: "2026-03-09", weightKg: 95, reps: 4 },
  ];

  console.log(classifyResponderStatus(sampleSets));
  console.log(estimateExpectedGainCap(8));
}
