CREATE TYPE "public"."delivery_coverage_kind" AS ENUM('cep', 'municipio', 'raio');--> statement-breakpoint
CREATE TYPE "public"."delivery_coverage_mode" AS ENUM('cobertura', 'exclusao');--> statement-breakpoint
CREATE TYPE "public"."delivery_coverage_scope" AS ENUM('fornecedor', 'produto', 'categoria');--> statement-breakpoint
CREATE TABLE "delivery_coverage_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"scope" "delivery_coverage_scope" DEFAULT 'fornecedor' NOT NULL,
	"product_id" uuid,
	"category_id" uuid,
	"kind" "delivery_coverage_kind" NOT NULL,
	"mode" "delivery_coverage_mode" DEFAULT 'cobertura' NOT NULL,
	"radius_km" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_coverage_ceps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coverage_area_id" uuid NOT NULL,
	"cep_start" text NOT NULL,
	"cep_end" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_coverage_municipios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coverage_area_id" uuid NOT NULL,
	"cidade" text NOT NULL,
	"estado" text NOT NULL,
	"ibge_code" text
);
--> statement-breakpoint
ALTER TABLE "delivery_coverage_areas" ADD CONSTRAINT "delivery_coverage_areas_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_coverage_areas" ADD CONSTRAINT "delivery_coverage_areas_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_coverage_areas" ADD CONSTRAINT "delivery_coverage_areas_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_coverage_ceps" ADD CONSTRAINT "delivery_coverage_ceps_coverage_area_id_delivery_coverage_areas_id_fk" FOREIGN KEY ("coverage_area_id") REFERENCES "public"."delivery_coverage_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_coverage_municipios" ADD CONSTRAINT "delivery_coverage_municipios_coverage_area_id_delivery_coverage_areas_id_fk" FOREIGN KEY ("coverage_area_id") REFERENCES "public"."delivery_coverage_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_coverage_areas_supplier_idx" ON "delivery_coverage_areas" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "delivery_coverage_areas_product_idx" ON "delivery_coverage_areas" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "delivery_coverage_areas_category_idx" ON "delivery_coverage_areas" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "delivery_coverage_ceps_area_idx" ON "delivery_coverage_ceps" USING btree ("coverage_area_id");--> statement-breakpoint
CREATE INDEX "delivery_coverage_municipios_area_idx" ON "delivery_coverage_municipios" USING btree ("coverage_area_id");