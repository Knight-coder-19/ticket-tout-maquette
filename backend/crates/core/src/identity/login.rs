use super::session::create_session;
use super::{repo, IdentityError, SessionToken, UserStatus};
use crate::clock::Clock;
use crate::crypto::password::{dummy_hash, verify_password};
use crate::PgTx;

#[derive(Debug, Clone)]
pub struct LoginContext<'a> {
    pub ip: Option<&'a str>,
    pub user_agent: Option<&'a str>,
}

pub async fn login(
    tx: &mut PgTx<'_>,
    clock: &dyn Clock,
    email: &str,
    password: &str,
    ctx: LoginContext<'_>,
) -> Result<SessionToken, IdentityError> {
    let user = repo::find_user_by_email(&mut **tx, email).await?;

    let password_ok = match &user {
        Some(found) => verify_password(password, &found.password_hash)?,
        None => {
            verify_password(password, dummy_hash())?;
            false
        }
    };

    let user = match user {
        Some(user) if password_ok => user,
        _ => return Err(IdentityError::InvalidCredentials),
    };

    if user.status != UserStatus::Active {
        return Err(IdentityError::AccountInactive);
    }

    repo::touch_last_login(tx, user.id, clock.now()).await?;

    create_session(tx, clock, user.id, ctx.ip, ctx.user_agent).await
}
