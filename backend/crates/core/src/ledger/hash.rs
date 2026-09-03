//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// hash
//

use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};

use super::EntryDirection;
use crate::ids::{AccountId, OperationId};
use crate::money::Money;

pub const GENESIS_HASH: [u8; 32] = [0u8; 32];

pub const DIGEST_LEN: usize = 32;

const DOMAIN_TAG: &[u8] = b"CARTEPRO/LEDGER/V1";

pub fn entry_hash(
    seq: i64,
    operation_id: OperationId,
    account_id: AccountId,
    direction: EntryDirection,
    amount: Money,
    recorded_at: DateTime<Utc>,
    prev_hash: &[u8; DIGEST_LEN],
) -> [u8; DIGEST_LEN]
{
    let mut hasher = Sha256::new();

    hasher.update(DOMAIN_TAG);
    hasher.update(seq.to_be_bytes());
    hasher.update(operation_id.as_uuid().as_bytes());
    hasher.update(account_id.as_uuid().as_bytes());
    hasher.update([direction.as_byte()]);
    hasher.update(amount.cents().to_be_bytes());
    hasher.update(recorded_at.timestamp_micros().to_be_bytes());
    hasher.update(prev_hash);
    hasher.finalize().into()
}

pub fn digest_from_slice(bytes: &[u8]) -> Option<[u8; DIGEST_LEN]>
{
    <[u8; DIGEST_LEN]>::try_from(bytes).ok()
}
