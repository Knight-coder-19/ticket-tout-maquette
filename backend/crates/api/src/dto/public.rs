// A3, rule R9. Define PublicPartner only — id, trade_name, category, service_mode, city, district,
// website_url, position — every field an explicit decision. Never a #[serde(flatten)], never a reuse of
// CatalogItem: that is how contacts, amounts or an internal id would leak. Priority: P2
