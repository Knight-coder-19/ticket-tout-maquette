use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use cartepro_core::crypto::token_sig::{self, TokenError, TokenPayload, SEPARATOR, TOKEN_VERSION};
use cartepro_core::ids::Jti;
use cartepro_core::money::Money;
use chrono::{DateTime, Utc};
use ed25519_dalek::{SigningKey, VerifyingKey};
use rand::rngs::OsRng;

const ISSUER: &str = "https://cartepro.example";

const EXPIRY: i64 = 1772000000;

fn keys() -> (SigningKey, VerifyingKey)
{
    let signing = SigningKey::generate(&mut OsRng);
    let verifying = signing.verifying_key();

    (signing, verifying)
}

fn expiry() -> DateTime<Utc>
{
    DateTime::from_timestamp(EXPIRY, 0).unwrap()
}

fn payload() -> TokenPayload
{
    TokenPayload::new(Jti::new(), Money::parse_euros("24.90").unwrap(), expiry(), ISSUER)
}

fn part(token: &str, index: usize) -> String
{
    let parts: Vec<&str> = token.split(SEPARATOR).collect();

    parts[index].to_string()
}

#[test]
fn new_converts_money_and_time_at_the_boundary()
{
    let payload = payload();

    assert_eq!(payload.amt, 2490);
    assert_eq!(payload.exp, EXPIRY);
    assert_eq!(payload.iss, ISSUER);
}

#[test]
fn amount_and_expires_at_read_the_values_back()
{
    let payload = payload();

    assert_eq!(payload.amount().unwrap(), Money::parse_euros("24.90").unwrap());
    assert_eq!(payload.expires_at().unwrap(), expiry());
}

#[test]
fn amount_refuses_a_negative_value_even_from_a_signed_payload()
{
    let mut payload = payload();

    payload.amt = -1;
    assert!(payload.amount().is_err());
}

#[test]
fn expires_at_refuses_a_timestamp_out_of_range()
{
    let mut payload = payload();

    payload.exp = i64::MAX;
    assert_eq!(payload.expires_at(), None);
}

#[test]
fn a_signed_token_has_three_parts_and_the_version_first()
{
    let (signing, _) = keys();
    let token = token_sig::sign(&payload(), &signing);
    let parts: Vec<&str> = token.split(SEPARATOR).collect();

    assert_eq!(parts.len(), 3);
    assert_eq!(parts[0], TOKEN_VERSION);
    assert_eq!(URL_SAFE_NO_PAD.decode(parts[2]).unwrap().len(), 64);
    assert!(!token.contains('='));
    assert!(!token.contains('+'));
    assert!(!token.contains('/'));
}

#[test]
fn verify_returns_the_payload_that_was_signed()
{
    let (signing, verifying) = keys();
    let original = payload();
    let token = token_sig::sign(&original, &signing);

    assert_eq!(token_sig::verify(&token, &verifying).unwrap(), original);
}

#[test]
fn raising_the_amount_breaks_the_signature()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);

    let body = URL_SAFE_NO_PAD.decode(part(&token, 1)).unwrap();
    let json = String::from_utf8(body).unwrap().replace("\"amt\":2490", "\"amt\":9990");
    let encoded = URL_SAFE_NO_PAD.encode(json);
    let signature = part(&token, 2);
    let forged = format!("{TOKEN_VERSION}{SEPARATOR}{encoded}{SEPARATOR}{signature}");

    assert_eq!(token_sig::verify(&forged, &verifying), Err(TokenError::BadSignature));
}

#[test]
fn an_unreadable_payload_is_reported_as_a_bad_signature()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);

    let encoded = URL_SAFE_NO_PAD.encode("not json at all");
    let signature = part(&token, 2);
    let forged = format!("{TOKEN_VERSION}{SEPARATOR}{encoded}{SEPARATOR}{signature}");

    assert_eq!(token_sig::verify(&forged, &verifying), Err(TokenError::BadSignature));
}

#[test]
fn another_key_cannot_verify_our_tokens()
{
    let (signing, _) = keys();
    let (_, foreign) = keys();
    let token = token_sig::sign(&payload(), &signing);

    assert_eq!(token_sig::verify(&token, &foreign), Err(TokenError::BadSignature));
}

#[test]
fn a_corrupted_signature_is_refused()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);

    let body = part(&token, 1);
    let mut raw = URL_SAFE_NO_PAD.decode(part(&token, 2)).unwrap();

    raw[0] ^= 1;
    let signature = URL_SAFE_NO_PAD.encode(raw);
    let forged = format!("{TOKEN_VERSION}{SEPARATOR}{body}{SEPARATOR}{signature}");

    assert_eq!(token_sig::verify(&forged, &verifying), Err(TokenError::BadSignature));
}

#[test]
fn a_token_that_is_not_three_parts_is_malformed()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);
    let body = part(&token, 1);

    assert_eq!(token_sig::verify("", &verifying), Err(TokenError::Malformed));
    assert_eq!(token_sig::verify("CP1.abc", &verifying), Err(TokenError::Malformed));
    assert_eq!(
        token_sig::verify(&format!("{token}{SEPARATOR}{body}"), &verifying),
        Err(TokenError::Malformed)
    );
}

#[test]
fn a_signature_of_the_wrong_length_is_malformed()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);

    let body = part(&token, 1);
    let signature = URL_SAFE_NO_PAD.encode([0u8; 32]);
    let forged = format!("{TOKEN_VERSION}{SEPARATOR}{body}{SEPARATOR}{signature}");

    assert_eq!(token_sig::verify(&forged, &verifying), Err(TokenError::Malformed));
}

#[test]
fn an_unknown_version_is_not_confused_with_a_forgery()
{
    let (signing, verifying) = keys();
    let token = token_sig::sign(&payload(), &signing);

    let body = part(&token, 1);
    let signature = part(&token, 2);
    let next = format!("CP2{SEPARATOR}{body}{SEPARATOR}{signature}");

    assert_eq!(token_sig::verify(&next, &verifying), Err(TokenError::UnsupportedVersion));
}
