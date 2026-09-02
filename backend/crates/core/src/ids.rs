//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// ids
//

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! newtype_id {
    ($name:ident) => {
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash,
            Serialize, Deserialize, sqlx::Type
        )]
        #[serde(transparent)]
        #[sqlx(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            pub fn new() -> Self
            {
                Self(Uuid::new_v4())
            }

            pub fn as_uuid(self) -> Uuid
            {
                self.0
            }
        }

        impl Default for $name {
            fn default() -> Self
            {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result
            {
                write!(f, "{}", self.0)
            }
        }

        impl From<Uuid> for $name {
            fn from(id: Uuid) -> Self
            {
                Self(id)
            }
        }

        impl From<$name> for Uuid {
            fn from(id: $name) -> Self
            {
                id.0
            }
        }

        impl FromStr for $name {
            type Err = uuid::Error;

            fn from_str(text: &str) -> Result<Self, Self::Err>
            {
                Ok(Self(Uuid::parse_str(text)?))
            }
        }
    };
}

newtype_id!(UserId);
newtype_id!(EmployeeId);
newtype_id!(EmployerId);
newtype_id!(PartnerId);
newtype_id!(AccountId);
newtype_id!(OperationId);
newtype_id!(Jti);
newtype_id!(CityId);
newtype_id!(BatchId);
newtype_id!(EmploymentLinkId);
newtype_id!(HighlightId);
