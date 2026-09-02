//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// short_code
//

use rand::Rng;

pub const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";

pub const CODE_LEN: usize = 8;

pub const GROUP_LEN: usize = 4;

pub const SEPARATOR: char = '-';

pub fn generate(rng: &mut impl Rng) -> String
{
    let mut code = String::with_capacity(CODE_LEN);

    for _ in 0..CODE_LEN {
        let index = rng.gen_range(0..ALPHABET.len());
        code.push(ALPHABET[index] as char);
    }
    code
}

pub fn format_for_display(code: &str) -> String
{
    let mut display = String::with_capacity(CODE_LEN + 1);

    for (position, letter) in code.chars().enumerate() {
        if position > 0 && position % GROUP_LEN == 0 {
            display.push(SEPARATOR);
        }
        display.push(letter);
    }
    display
}

pub fn normalize(input: &str) -> String
{
    let mut normalized = String::with_capacity(input.len());

    for letter in input.chars() {
        if letter.is_ascii_alphanumeric() {
            normalized.push(letter.to_ascii_uppercase());
        }
    }
    normalized
}

pub fn is_valid(code: &str) -> bool
{
    if code.len() != CODE_LEN {
        return false;
    }
    code.bytes().all(|letter| ALPHABET.contains(&letter))
}
