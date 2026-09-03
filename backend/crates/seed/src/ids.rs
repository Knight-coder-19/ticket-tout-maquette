use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use uuid::Uuid;

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

fn fingerprint(text: &str) -> u64
{
    let mut hash = FNV_OFFSET;

    for byte in text.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

pub fn stable(kind: &str, key: &str) -> Uuid
{
    let mut rng = StdRng::seed_from_u64(fingerprint(&format!("cartepro/{kind}/{key}")));
    let mut bytes = [0u8; 16];

    rng.fill(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}

pub fn indexed(kind: &str, index: usize) -> Uuid
{
    stable(kind, &format!("{index:04}"))
}
