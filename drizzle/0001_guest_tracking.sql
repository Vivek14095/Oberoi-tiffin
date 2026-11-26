CREATE TABLE guest_tracking (
  id TEXT PRIMARY KEY,
  viewer TEXT NOT NULL,
  rider TEXT NOT NULL,
  destination TEXT,
  first_pin TEXT,
  latest_pin TEXT,
  updated INTEGER,
  created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
);
--> statement-breakpoint
CREATE INDEX guest_tracking_created ON guest_tracking(created);
