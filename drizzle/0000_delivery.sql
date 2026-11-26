CREATE TABLE customers (phone TEXT PRIMARY KEY, delivery TEXT NOT NULL DEFAULT '{}');
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, phone TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE otp_limits (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE deliveries (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'requested', rider TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX delivery_owner ON deliveries(owner, created);
--> statement-breakpoint
CREATE INDEX delivery_created ON deliveries(created);
--> statement-breakpoint
CREATE INDEX delivery_rider ON deliveries(rider, created);
