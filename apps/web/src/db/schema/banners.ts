import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  highlight: text("highlight"),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  link: text("link"),
  order: integer("order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
