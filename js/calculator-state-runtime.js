/*
 * Web-to-platform state bridge.
 * DOM code keeps BigInt values in memory, while the shared CalculatorState
 * contract exposes JSON-safe snapshots. ArkTS should implement this bridge
 * with the same normalize/snapshot/restore boundaries before binding UI.
 */
(() => {
  if (typeof CalculatorState === 'undefined') return;

  const captureRuntimeState = snapshotCalculator;
  const restoreRuntimeState = restoreCalculator;

  // Public/undo snapshot shape is now the platform-neutral, JSON-safe schema.
  snapshotCalculator = function() {
    return CalculatorState.normalizeSnapshot(captureRuntimeState());
  };

  restoreCalculator = function(snapshot) {
    const normalized = CalculatorState.normalizeSnapshot(snapshot);
    restoreRuntimeState({
      ...normalized,
      // The Web runtime still uses BigInt in memory; serialization never does.
      lastResultMs: DurationPrecision.toBigIntMs(normalized.lastResultMs) ?? 0n
    });
  };

  hasCalculatorContent = function() {
    return CalculatorState.hasContent(snapshotCalculator());
  };

  // History restore uses the same state transition as Undo instead of manually
  // assigning a second set of runtime globals.
  restoreHistory = function(index) {
    const record = HistoryStore.normalizeRecord(historyRecords[index]);
    if (!record) return;
    const next = CalculatorState.fromHistoryRecord(record, snapshotCalculator());
    restoreCalculator(next);
    closeHistory();
  };
})();
