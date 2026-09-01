// Implement compensate(tx, admin, original_operation_id, reason): read the original operation, post the reverse
// one through post_operation, insert into compensations. Reason and admin are mandatory, and compensating
// a compensation is refused (decision 4). Priority: P2
