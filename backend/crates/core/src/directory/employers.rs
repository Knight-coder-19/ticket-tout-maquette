use super::{repo, DirectoryError, Employer};
use crate::clock::Clock;
use crate::identity::UserStatus;
use crate::ids::EmployerId;
use crate::PgTx;
use sqlx::PgConnection;

#[derive(Debug, Clone)]
pub struct NewEmployer<'a> {
    pub legal_name: &'a str,
    pub ifu: Option<&'a str>,
    pub contact_email: Option<&'a str>,
    pub contact_phone: Option<&'a str>,
}

#[derive(Debug, Clone, Default)]
pub struct EmployerPatch<'a> {
    pub legal_name: Option<&'a str>,
    pub ifu: Option<Option<&'a str>>,
    pub contact_email: Option<Option<&'a str>>,
    pub contact_phone: Option<Option<&'a str>>,
    pub status: Option<UserStatus>,
}

pub async fn create_employer(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    new: NewEmployer<'_>,
) -> Result<Employer, DirectoryError> {
    let employer = repo::insert_employer(
        tx,
        new.legal_name,
        new.ifu,
        new.contact_email,
        new.contact_phone,
        clock.now(),
    )
    .await?;
    Ok(employer)
}

pub async fn update_employer(
    tx: &mut PgTx<'_>,
    id: EmployerId,
    patch: EmployerPatch<'_>,
) -> Result<Employer, DirectoryError> {
    let current = repo::find_employer(tx, id).await?.ok_or(DirectoryError::NotFound)?;

    let legal_name = patch.legal_name.unwrap_or(current.legal_name.as_str());
    let ifu = patch.ifu.unwrap_or(current.ifu.as_deref());
    let contact_email = patch.contact_email.unwrap_or(current.contact_email.as_deref());
    let contact_phone = patch.contact_phone.unwrap_or(current.contact_phone.as_deref());
    let status = patch.status.unwrap_or(current.status);

    let employer =
        repo::update_employer(tx, id, legal_name, ifu, contact_email, contact_phone, status).await?;
    Ok(employer)
}

pub async fn list_employers(conn: &mut PgConnection) -> Result<Vec<Employer>, DirectoryError> {
    Ok(repo::list_employers(conn).await?)
}

pub async fn get_employer(
    conn: &mut PgConnection,
    id: EmployerId,
) -> Result<Employer, DirectoryError> {
    repo::find_employer(conn, id).await?.ok_or(DirectoryError::NotFound)
}
