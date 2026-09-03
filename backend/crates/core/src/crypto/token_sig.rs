//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// token_sig
//

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::ids::Jti;
use crate::money::{InvalidMoneyError, Money};

pub const TOKEN_VERSION: &str = "CP1";

pub const SEPARATOR: char = '.';

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenPayload {
    pub jti: Jti,
    pub amt: i64,
    pub exp: i64,
    pub iss: String,
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum TokenError {
    #[error("malformed payment token")]
    Malformed,

    #[error("unsupported payment token version")]
    UnsupportedVersion,

    #[error("invalid payment token signature")]
    BadSignature,
}

impl TokenPayload {
    pub fn new(jti: Jti, amount: Money, expires_at: DateTime<Utc>, issuer: &str) -> Self
    {
        TokenPayload {
            jti,
            amt: amount.cents(),
            exp: expires_at.timestamp(),
            iss: issuer.to_string()
        }
    }

    pub fn amount(&self) -> Result<Money, InvalidMoneyError>
    {
        Money::try_new(self.amt)
    }

    pub fn expires_at(&self) -> Option<DateTime<Utc>>
    {
        DateTime::from_timestamp(self.exp, 0)
    }
}

pub fn sign(payload: &TokenPayload, key: &SigningKey) -> String
{
    let body = serde_json::to_vec(payload).expect("token payload is always serialisable");
    let signature = key.sign(&body);

    let encoded_body = URL_SAFE_NO_PAD.encode(&body);
    let encoded_signature = URL_SAFE_NO_PAD.encode(signature.to_bytes());

    format!("{TOKEN_VERSION}{SEPARATOR}{encoded_body}{SEPARATOR}{encoded_signature}")
}

pub fn verify(token: &str, key: &VerifyingKey) -> Result<TokenPayload, TokenError>
{
    let parts: Vec<&str> = token.split(SEPARATOR).collect();

    if parts.len() != 3 {
        return Err(TokenError::Malformed);
    }
    if parts[0] != TOKEN_VERSION {
        return Err(TokenError::UnsupportedVersion);
    }

    let body = match URL_SAFE_NO_PAD.decode(parts[1]) {
        Ok(body) => body,
        _ => return Err(TokenError::Malformed)
    };
    let raw_signature = match URL_SAFE_NO_PAD.decode(parts[2]) {
        Ok(raw_signature) => raw_signature,
        _ => return Err(TokenError::Malformed)
    };
    let signature = match Signature::from_slice(&raw_signature) {
        Ok(signature) => signature,
        _ => return Err(TokenError::Malformed)
    };

    if key.verify(&body, &signature).is_err() {
        return Err(TokenError::BadSignature);
    }

    match serde_json::from_slice(&body) {
        Ok(payload) => Ok(payload),
        _ => Err(TokenError::Malformed)
    }
}
