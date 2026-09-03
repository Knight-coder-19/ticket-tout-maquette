// Declare Employee, Employer, EmploymentLink, City and DirectoryError, and re-export employees,
// employment, employers, cities and repo.
// One partner is one point of sale (decision 11): no multi-establishment field.
// Priority: P1

pub mod cities;
pub mod employees;
pub mod employers;
pub mod employment;
pub mod repo;

pub use cities::list_cities;
pub use employees::{active_account, create_employee_with_account, resolve_account_by_ref};

use crate::identity::UserStatus;
use crate::ids::*;
use chrono::{DateTime, NaiveDate, Utc};
use thiserror::Error;

/// Postgres ENUM `link_status`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "link_status", rename_all = "snake_case")]
pub enum LinkStatus {
    Active,
    Ended,
}

#[derive(Debug, Clone)]
pub struct Employee {
    pub id: EmployeeId,
    pub user_id: UserId,
    pub last_name: String,
    pub first_name: String,
    pub phone: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct Employer {
    pub id: EmployerId,
    pub legal_name: String,
    pub ifu: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub status: UserStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct EmploymentLink {
    pub id: EmploymentLinkId,
    pub employee_id: EmployeeId,
    pub employer_id: EmployerId,
    pub employer_ref: String,
    pub account_id: AccountId,
    pub status: LinkStatus,
    pub started_at: NaiveDate,
    pub ended_at: Option<NaiveDate>,
}

#[derive(Debug, Clone)]
pub struct City {
    pub id: CityId,
    pub name: String,
    pub department: String,
}

#[derive(Debug, Error)]
pub enum DirectoryError {
    #[error("no active account for this employee")]
    NoAccount,
    #[error("employer_ref not found for this employer")]
    UnknownEmployerRef,
    #[error("employee already has an active employment link")]
    DuplicateActiveEmployment,
    #[error("city is required for a physical employer/partner")]
    CityRequired,
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

impl From<DirectoryError> for crate::error::CoreError {
    fn from(err: DirectoryError) -> Self {
        use crate::error::CoreError;
        match err {
            DirectoryError::Db(e) => CoreError::Db(e),
            // CoreError has no dedicated "not found" for directory lookups yet — see
            // cartepro-open-contract-items. Falls back to Internal for now.
            _ => CoreError::Internal,
        }
    }
}
