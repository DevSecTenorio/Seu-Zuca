CREATE TYPE "public"."freight_charge_type" AS ENUM('fixo', 'por_km', 'por_kg', 'por_km_kg');--> statement-breakpoint
CREATE TYPE "public"."freight_surcharge_type" AS ENUM('descarga', 'munck', 'ajudante', 'andar', 'fim_de_semana', 'dificil_acesso', 'pedagio');--> statement-breakpoint
CREATE TABLE "freight_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"distance_from_km" integer,
	"distance_to_km" integer,
	"weight_from_kg" numeric(10, 2),
	"weight_to_kg" numeric(10, 2),
	"value_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freight_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"charge_type" "freight_charge_type" DEFAULT 'fixo' NOT NULL,
	"cubic_factor_kg_per_m3" integer DEFAULT 300 NOT NULL,
	"min_freight_cents" integer DEFAULT 0 NOT NULL,
	"free_shipping_min_subtotal_cents" integer,
	"free_shipping_max_weight_kg" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freight_rules_supplier_id_unique" UNIQUE("supplier_id")
);
--> statement-breakpoint
CREATE TABLE "freight_surcharges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"type" "freight_surcharge_type" NOT NULL,
	"value_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "freight_surcharges_rule_id_type_unique" UNIQUE("rule_id","type")
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_grams" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "length_cm" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "width_cm" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "height_cm" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "freight_ranges" ADD CONSTRAINT "freight_ranges_rule_id_freight_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."freight_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_rules" ADD CONSTRAINT "freight_rules_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freight_surcharges" ADD CONSTRAINT "freight_surcharges_rule_id_freight_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."freight_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freight_ranges_rule_idx" ON "freight_ranges" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "freight_surcharges_rule_idx" ON "freight_surcharges" USING btree ("rule_id");