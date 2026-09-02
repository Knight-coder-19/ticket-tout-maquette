// A2. Implement add, remove, reorder and list over the two placements minister_pick and public_featured.
// remove only fills removed_at, never deletes (R6); reorder must shift positions out of range first because
// of the partial unique index on (placement, position); list joins on status = 'approved'. Priority: P2
