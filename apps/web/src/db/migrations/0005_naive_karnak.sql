CREATE TYPE "public"."route_distance_source" AS ENUM('rota', 'geodesica');--> statement-breakpoint
CREATE TABLE "route_distance_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_lat" numeric(10, 7) NOT NULL,
	"origin_lng" numeric(10, 7) NOT NULL,
	"destination_lat" numeric(10, 7) NOT NULL,
	"destination_lng" numeric(10, 7) NOT NULL,
	"distance_km" numeric(10, 2) NOT NULL,
	"source" "route_distance_source" NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_distance_cache_origin_lat_origin_lng_destination_lat_destination_lng_unique" UNIQUE("origin_lat","origin_lng","destination_lat","destination_lng")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "coordinates_adjusted_manually" boolean DEFAULT false NOT NULL;