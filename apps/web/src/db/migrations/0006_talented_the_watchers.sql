CREATE TYPE "public"."delivery_modality" AS ENUM('entrega', 'retirada', 'transportadora');--> statement-breakpoint
CREATE TABLE "pickup_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"code" text NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_codes_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "pickup_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"label" text NOT NULL,
	"cep" text NOT NULL,
	"logradouro" text NOT NULL,
	"numero" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"horario_funcionamento" text NOT NULL,
	"prazo_disponibilizacao_dias" integer DEFAULT 1 NOT NULL,
	"documento_exigido" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_modality" "delivery_modality" DEFAULT 'entrega' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_location_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "pickup_codes" ADD CONSTRAINT "pickup_codes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_locations" ADD CONSTRAINT "pickup_locations_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pickup_codes_order_idx" ON "pickup_codes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "pickup_locations_supplier_idx" ON "pickup_locations" USING btree ("supplier_id");