.PHONY: seed test reset migrate

seed:
	cargo run --release -p cartepro-seed -- transactions.csv

migrate:
	set -a; . ./.env; set +a; DATABASE_URL="$$MIGRATION_DATABASE_URL" sqlx migrate run

test:
	set -a; . ./.env; set +a; DATABASE_URL="$$MIGRATION_DATABASE_URL" cargo test --workspace
