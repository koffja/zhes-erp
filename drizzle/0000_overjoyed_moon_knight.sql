CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text,
	`customer_id` integer,
	`total_amount` real,
	`status` text DEFAULT 'pending',
	`shipping_name` text,
	`shipping_phone` text,
	`shipping_address` text,
	`note` text,
	`created_at` text DEFAULT '2026-03-03T14:08:25.605Z',
	`paid_amount` real DEFAULT 0,
	`payment_status` text DEFAULT 'unpaid',
	`shipping_status` text DEFAULT 'pending',
	`order_date` text,
	`shipping_fee` real DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`product_name` text,
	`quantity` integer,
	`unit_price` real,
	`subtotal` real,
	`shipped_quantity` integer DEFAULT 0,
	`shipping_status` text DEFAULT 'pending',
	`unit` text
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`note` text,
	`created_at` text DEFAULT '2026-03-03T14:08:25.608Z'
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`specs` text,
	`price` real,
	`cost` real,
	`stock` integer DEFAULT 0,
	`note` text,
	`created_at` text DEFAULT '2026-03-03T14:08:25.608Z'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_name_unique` ON `products` (`name`);--> statement-breakpoint
CREATE TABLE `product_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`alias` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku_code` text,
	`name_short` text NOT NULL,
	`name_full` text,
	`origin` text,
	`region` text,
	`variety` text,
	`process` text,
	`altitude` text,
	`grade` text,
	`description` text,
	`tags` text,
	`cupping_notes` text,
	`roast_level` text,
	`flavor_type` text,
	`acidity` text,
	`is_active` integer DEFAULT 1,
	`created_at` text DEFAULT '2026-03-03T14:08:25.609Z'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_new_sku_code_unique` ON `products_new` (`sku_code`);--> statement-breakpoint
CREATE TABLE `product_specs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`spec_name` text NOT NULL,
	`spec_code` text NOT NULL,
	`weight_grams` integer NOT NULL,
	`is_active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `product_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_id` integer NOT NULL,
	`price_type` text NOT NULL,
	`price` real NOT NULL,
	`min_quantity` integer DEFAULT 1,
	`valid_from` text
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`category_type` text NOT NULL,
	`category_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`contact_person` text,
	`phone` text,
	`address` text,
	`bank` text,
	`account` text,
	`note` text,
	`created_at` text DEFAULT '2026-03-03T14:08:25.616Z'
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer,
	`product_name` text,
	`category` text,
	`specs` text,
	`quantity` real,
	`unit_price` real,
	`total_amount` real,
	`purchase_date` text,
	`note` text,
	`created_at` text DEFAULT '2026-03-03T14:08:25.616Z'
);
