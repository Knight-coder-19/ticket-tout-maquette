use std::collections::HashMap;
use std::str::FromStr;

use cartepro_core::ids::{AccountId, BatchId, CityId, EmployeeId, EmployerId, HighlightId, Jti,
                         OperationId, PartnerId, UserId};
use uuid::Uuid;

#[test]
fn new_produces_distinct_values()
{
    let a = AccountId::new();
    let b = AccountId::new();
    assert_ne!(a, b);
}

#[test]
fn display_is_the_plain_uuid()
{
    let id = PartnerId::new();
    assert_eq!(id.to_string().len(), 36);
    assert_eq!(id.to_string(), id.as_uuid().to_string());
}

#[test]
fn from_str_round_trips_and_rejects_garbage()
{
    let id = EmployeeId::new();
    assert_eq!(EmployeeId::from_str(&id.to_string()).unwrap(), id);
    assert!(EmployeeId::from_str("not-a-uuid").is_err());
}

#[test]
fn converts_both_ways_with_uuid()
{
    let raw = Uuid::new_v4();
    let jti = Jti::from(raw);
    assert_eq!(jti.as_uuid(), raw);
    assert_eq!(Uuid::from(jti), raw);
}

#[test]
fn serde_representation_is_a_bare_string()
{
    let id = OperationId::new();
    let json = serde_json::to_string(&id).unwrap();
    assert_eq!(json, format!("\"{id}\""));
    assert_eq!(serde_json::from_str::<OperationId>(&json).unwrap(), id);
}

#[test]
fn usable_as_a_map_key_and_sortable()
{
    let a = AccountId::new();
    let b = AccountId::new();
    let mut balances = HashMap::new();
    balances.insert(a, 1);
    balances.insert(b, 2);
    assert_eq!(balances.get(&a), Some(&1));

    let mut ids = [a, b];
    ids.sort();
    assert!(ids[0] <= ids[1]);
}

#[test]
fn every_documented_id_exists()
{
    let _ = (UserId::new(), EmployeeId::new(), EmployerId::new(), PartnerId::new(),
             AccountId::new(), OperationId::new(), Jti::new(), CityId::new(),
             BatchId::new(), HighlightId::new());
}
