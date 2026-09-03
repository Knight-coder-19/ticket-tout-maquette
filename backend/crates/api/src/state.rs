//
// EPITECH PROJECT, 2026
// G-SVR-500-COT-5-1-survivor-21
// File description:
// state
//

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub clock: Arc<dyn Clock>,
    pub signing_key: Arc<SigningKey>,
    pub verifying_key: Arc<VerifyingKey>,
    pub config: CoreConfig,
}