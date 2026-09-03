//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// error
//

use crate::money::InvalidMoneyError;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("missing or expired session")]
    Unauthorized,

    #[error("insufficient role")]
    Forbidden,

    #[error("token not found")]
    TokenNotFound,

    #[error("token expired")]
    TokenExpired,

    #[error("token already consumed by another partner")]
    TokenAlreadyUsed,

    #[error("insufficient available balance")]
    InsufficientFunds,

    #[error("partner not approved")]
    PartnerNotApproved,

    #[error("account suspended or closed")]
    AccountInactive,

    #[error("batch already imported")]
    DuplicateBatch,

    #[error("batch contains invalid rows")]
    BatchHasErrors,

    #[error("partner not eligible for highlighting")]
    HighlightNotEligible,

    #[error("highlight slot already taken")]
    HighlightDuplicate,

    #[error("resynchronisation past the allowed delay")]
    ResyncTooLate,

    #[error("internal invariant violation")]
    Internal,

    #[error(transparent)]
    Money(#[from] InvalidMoneyError),

    #[error(transparent)]
    Db(#[from] sqlx::Error),
}
