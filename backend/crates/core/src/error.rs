//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// error
//

use crate::money::InvalidMoneyError;

#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("session absente ou expiree")]
    Unauthorized,

    #[error("role insuffisant")]
    Forbidden,

    #[error("jeton introuvable")]
    TokenNotFound,

    #[error("jeton expire")]
    TokenExpired,

    #[error("jeton deja consomme par un autre partenaire")]
    TokenAlreadyUsed,

    #[error("solde disponible insuffisant")]
    InsufficientFunds,

    #[error("partenaire non agree")]
    PartnerNotApproved,

    #[error("compte suspendu ou cloture")]
    AccountInactive,

    #[error("lot deja importe")]
    DuplicateBatch,

    #[error("le lot contient des lignes invalides")]
    BatchHasErrors,

    #[error("partenaire non eligible a la mise en avant")]
    HighlightNotEligible,

    #[error("emplacement de mise en avant deja occupe")]
    HighlightDuplicate,

    #[error("resynchronisation hors delai")]
    ResyncTooLate,

    #[error(transparent)]
    Money(#[from] InvalidMoneyError),

    #[error(transparent)]
    Db(#[from] sqlx::Error),
}
