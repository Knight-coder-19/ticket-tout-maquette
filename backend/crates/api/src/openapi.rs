//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// openapi
//

use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};
use utoipa::{Modify, OpenApi};
use utoipa_swagger_ui::SwaggerUi;

use crate::dto::employee::{
    AuthorizeRequest, BalanceResponse, EmployeeTransaction, IssuedTokenResponse, MinisterPick,
    TransactionDirection,
};
use crate::dto::partner::{
    BatchItemStatus, BatchSettleRequest, BatchSettleResponse, BatchSettleResult, PartnerSummary,
    PartnerTransaction, PaymentResponse, PaymentStatus, SettleRequest,
};
use crate::dto::catalog::{CatalogItem, CityRef};
use crate::error::ErrorBody;

pub const DOCS_PATH: &str = "/docs";

pub const SPEC_PATH: &str = "/docs/openapi.json";

struct SessionCookie;

impl Modify for SessionCookie {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi)
    {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "session",
                SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("session"))),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "CartePro API",
        version = "1.0.0",
        description = "Amounts travel as decimal euros with at most two decimals. \
                       Dates are ISO 8601 in UTC. Errors always use the { error, message, \
                       request_id } envelope, and clients react on `error`, never on `message`."
    ),
    paths(
        crate::routes::employee::balance,
        crate::routes::employee::transactions,
        crate::routes::employee::minister_picks,
        crate::routes::employee::authorize_token,
        crate::routes::employee::cancel_token,
        crate::routes::partner::summary,
        crate::routes::partner::transactions,
        crate::routes::partner::settle_payment,
        crate::routes::partner::settle_batch,
    ),
    components(schemas(
        BalanceResponse,
        EmployeeTransaction,
        TransactionDirection,
        MinisterPick,
        AuthorizeRequest,
        IssuedTokenResponse,
        PartnerSummary,
        PartnerTransaction,
        SettleRequest,
        PaymentResponse,
        PaymentStatus,
        BatchSettleRequest,
        BatchSettleResult,
        BatchSettleResponse,
        BatchItemStatus,
        CatalogItem,
        CityRef,
        ErrorBody,
    )),
    modifiers(&SessionCookie),
    tags(
        (name = "employee", description = "Employee space. Session cookie required, role `employee`."),
        (name = "partner", description = "Partner space. Session cookie required, role `partner`."),
    )
)]
pub struct ApiDoc;

pub fn docs() -> SwaggerUi
{
    SwaggerUi::new(DOCS_PATH).url(SPEC_PATH, ApiDoc::openapi())
}

pub fn spec() -> String
{
    ApiDoc::openapi().to_pretty_json().unwrap_or_default()
}
