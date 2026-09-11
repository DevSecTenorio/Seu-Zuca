ALTER TABLE "orders" ADD COLUMN "invoice_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_file_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_uploaded_at" timestamp with time zone;