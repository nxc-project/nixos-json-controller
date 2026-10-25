const PACKAGE_STATE_BATCH_SIZE = 40;

/** Remove and return the next bounded batch from a pending package-state queue. */
export function takePackageStateBatch(pendingStateIds: Set<string>): string[] {
  const batch = Array.from(pendingStateIds).slice(0, PACKAGE_STATE_BATCH_SIZE);
  for (const packageName of batch) {
    pendingStateIds.delete(packageName);
  }
  return batch;
}
