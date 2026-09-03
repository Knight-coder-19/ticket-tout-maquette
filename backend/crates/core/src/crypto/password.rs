use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{Error as HashError, PasswordHash, SaltString};
use argon2::{Algorithm, Argon2, Params, PasswordHasher, PasswordVerifier, Version};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PasswordError {
    #[error("password hashing failed")]
    Hash,
    #[error("stored hash is malformed")]
    MalformedHash,
}

const MEMORY_KIB: u32 = 64 * 1024;
const ITERATIONS: u32 = 3;
const PARALLELISM: u32 = 4;

fn hasher() -> Result<Argon2<'static>, PasswordError> {
    let params =
        Params::new(MEMORY_KIB, ITERATIONS, PARALLELISM, None).map_err(|_| PasswordError::Hash)?;
    Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
}

pub fn hash_password(plain: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    hasher()?
        .hash_password(plain.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| PasswordError::Hash)
}

pub fn verify_password(plain: &str, phc_hash: &str) -> Result<bool, PasswordError> {
    let parsed = PasswordHash::new(phc_hash).map_err(|_| PasswordError::MalformedHash)?;
    match Argon2::default().verify_password(plain.as_bytes(), &parsed) {
        Ok(()) => Ok(true),
        Err(HashError::Password) => Ok(false),
        Err(_) => Err(PasswordError::MalformedHash),
    }
}

pub fn dummy_hash() -> &'static str {
    "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
}
