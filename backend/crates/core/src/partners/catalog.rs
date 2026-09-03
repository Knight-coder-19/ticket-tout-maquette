use super::{repo, PartnerCard, PartnerError, ServiceMode};
use crate::ids::{CityId, PartnerId};
use sqlx::PgConnection;

#[derive(Debug, Clone)]
pub struct CatalogCursor {
    pub trade_name: String,
    pub id: PartnerId,
}

#[derive(Debug, Clone, Default)]
pub struct CatalogFilter<'a> {
    pub city: Option<CityId>,
    pub service_mode: Option<ServiceMode>,
    pub query: Option<&'a str>,
}

#[derive(Debug, Clone)]
pub struct CatalogPage {
    pub items: Vec<PartnerCard>,
    pub next_cursor: Option<CatalogCursor>,
}

pub async fn search(
    conn: &mut PgConnection,
    filter: CatalogFilter<'_>,
    cursor: Option<CatalogCursor>,
    limit: u32,
) -> Result<CatalogPage, PartnerError> {
    let (cursor_name, cursor_id) = match &cursor {
        Some(cursor) => (Some(cursor.trade_name.as_str()), Some(cursor.id)),
        None => (None, None),
    };
    let fetch = i64::from(limit) + 1;

    let statement = format!(
        "SELECT {}
           FROM partners p
           LEFT JOIN cities c ON c.id = p.city_id
          WHERE p.status = 'approved'
            AND ($1::UUID IS NULL OR p.city_id = $1 OR p.service_mode = 'online')
            AND ($2::service_mode IS NULL OR p.service_mode = $2)
            AND ($3::TEXT IS NULL
                 OR p.trade_name ILIKE '%' || $3 || '%'
                 OR p.category ILIKE '%' || $3 || '%')
            AND ($4::TEXT IS NULL OR (p.trade_name, p.id) > ($4::TEXT, $5::UUID))
          ORDER BY p.trade_name, p.id
          LIMIT $6",
        repo::CARD_COLUMNS
    );

    let rows = sqlx::query(&statement)
        .bind(filter.city)
        .bind(filter.service_mode)
        .bind(filter.query)
        .bind(cursor_name)
        .bind(cursor_id)
        .bind(fetch)
        .fetch_all(conn)
        .await?;

    let mut items = Vec::with_capacity(rows.len());
    for row in &rows {
        items.push(repo::card_from_row(row)?);
    }

    let next_cursor = if items.len() as i64 == fetch {
        items.pop();
        items.last().map(|card| CatalogCursor {
            trade_name: card.trade_name.clone(),
            id: card.id,
        })
    } else {
        None
    };

    Ok(CatalogPage { items, next_cursor })
}
