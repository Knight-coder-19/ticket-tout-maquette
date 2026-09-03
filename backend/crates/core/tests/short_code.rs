use std::collections::HashSet;

use cartepro_core::crypto::short_code;
use rand::rngs::StdRng;
use rand::SeedableRng;

const DRAWS: usize = 1000;

const AMBIGUOUS: [char; 5] = ['0', 'O', '1', 'I', 'L'];

fn rng() -> StdRng
{
    StdRng::seed_from_u64(20260902)
}

#[test]
fn generate_draws_eight_characters_from_the_alphabet()
{
    let mut rng = rng();

    for _ in 0..DRAWS {
        let code = short_code::generate(&mut rng);

        assert_eq!(code.len(), short_code::CODE_LEN);
        assert!(short_code::is_valid(&code), "rejected {code}");
    }
}

#[test]
fn generate_never_draws_an_ambiguous_character()
{
    let mut rng = rng();

    for _ in 0..DRAWS {
        let code = short_code::generate(&mut rng);

        assert!(!code.contains(AMBIGUOUS), "ambiguous character in {code}");
    }
}

#[test]
fn generate_does_not_repeat_itself()
{
    let mut rng = rng();
    let mut seen = HashSet::new();

    for _ in 0..DRAWS {
        seen.insert(short_code::generate(&mut rng));
    }
    assert!(seen.len() > DRAWS - 10, "only {} distinct codes", seen.len());
}

#[test]
fn format_for_display_groups_the_code_by_four()
{
    assert_eq!(short_code::format_for_display("86RB57CT"), "86RB-57CT");
    assert_eq!(short_code::format_for_display(""), "");
}

#[test]
fn normalize_accepts_what_a_human_actually_types()
{
    assert_eq!(short_code::normalize("86RB-57CT"), "86RB57CT");
    assert_eq!(short_code::normalize("86rb-57ct"), "86RB57CT");
    assert_eq!(short_code::normalize("  86rb 57ct  "), "86RB57CT");
    assert_eq!(short_code::normalize("86-rb-57-ct"), "86RB57CT");
}

#[test]
fn normalize_undoes_format_for_display()
{
    let mut rng = rng();

    for _ in 0..DRAWS {
        let code = short_code::generate(&mut rng);
        let shown = short_code::format_for_display(&code);

        assert_eq!(short_code::normalize(&shown), code);
        assert_eq!(short_code::normalize(&shown.to_lowercase()), code);
    }
}

#[test]
fn is_valid_only_accepts_the_stored_form()
{
    assert!(short_code::is_valid("86RB57CT"));

    assert!(!short_code::is_valid("86RB-57CT"));
    assert!(!short_code::is_valid("86rb57ct"));
    assert!(!short_code::is_valid("86RB57C"));
    assert!(!short_code::is_valid("86RB57CTT"));
    assert!(!short_code::is_valid("86RB57C0"));
    assert!(!short_code::is_valid(""));
}

#[test]
fn a_typed_code_becomes_valid_once_normalized()
{
    let typed = "86rb-57ct";
    let normalized = short_code::normalize(typed);

    assert!(!short_code::is_valid(typed));
    assert!(short_code::is_valid(&normalized));
}
