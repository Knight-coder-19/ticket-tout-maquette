// Declare PaymentToken, Payment, TokenStatus, EntryMode, TokenRef (scanned jti or typed short code) and
// PaymentError, and re-export authorize/settle/expire. PaymentError must keep UnknownToken, TokenExpired,
// TokenAlreadyUsed and ResyncTooLate distinct: the offline client depends on it. Priority: P0
