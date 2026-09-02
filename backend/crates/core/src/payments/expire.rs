// Implement expire_stale_tokens(pool, clock): move due tokens to expired and release their holds, in batches.
// Called by the worker and lazily when a balance is read.
// Priority: P1
