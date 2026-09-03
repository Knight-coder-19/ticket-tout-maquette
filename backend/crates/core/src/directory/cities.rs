use super::{City, DirectoryError};
use sqlx::PgConnection;

pub async fn list_cities(conn: &mut PgConnection) -> Result<Vec<City>, DirectoryError> {
    let cities = sqlx::query_as::<_, City>(
        "SELECT id, name, department FROM cities ORDER BY name, department",
    )
    .fetch_all(conn)
    .await?;
    Ok(cities)
}
