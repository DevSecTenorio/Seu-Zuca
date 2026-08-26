import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "suporte",
  "fornecedor",
  "comprador",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pendente",
  "aprovado",
  "rejeitado",
  "suspenso",
]);

export const addressTypeEnum = pgEnum("address_type", ["empresa", "entrega"]);

export const kycDocumentTypeEnum = pgEnum("kyc_document_type", [
  "cartao_cnpj",
  "contrato_social",
  "outro",
]);

export const kycDocumentStatusEnum = pgEnum("kyc_document_status", [
  "pendente",
  "aprovado",
  "rejeitado",
]);

export const productModerationStatusEnum = pgEnum("product_moderation_status", [
  "aguardando_aprovacao",
  "ativo",
  "rejeitado",
  "inativo",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "enviado",
  "entregue",
  "cancelado",
  "em_disputa",
  "devolvido",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["pix", "boleto", "cartao"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "aguardando_pagamento",
  "pago",
  "falhou",
  "expirado",
  "estornado",
]);

export const reviewModerationStatusEnum = pgEnum("review_moderation_status", [
  "pendente",
  "aprovado",
  "rejeitado",
]);

export const deliveryCoverageScopeEnum = pgEnum("delivery_coverage_scope", [
  "fornecedor",
  "produto",
  "categoria",
]);

export const deliveryCoverageKindEnum = pgEnum("delivery_coverage_kind", [
  "cep",
  "municipio",
  "raio",
]);

export const deliveryCoverageModeEnum = pgEnum("delivery_coverage_mode", [
  "cobertura",
  "exclusao",
]);
