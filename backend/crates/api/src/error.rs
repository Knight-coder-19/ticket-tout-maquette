// Define ApiError(CoreError) with IntoResponse following the mapping table, emitting { error, message,
// request_id }. Cover HighlightNotEligible, HighlightDuplicate, DuplicateBatch and ResyncTooLate too. The
// front reacts on error, never on message, and Db(_) becomes 500 INTERNAL, no SQL detail leaked. Prio: P0
