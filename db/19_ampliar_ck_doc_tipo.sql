-- ============================================================
-- PLURALL — Migración 19: Ampliar tipos permitidos en documento_cliente
-- Ejecutar después de 18_catalogo_municipios.sql
-- ============================================================
-- El formulario del cliente (page.js → TIPOS_DOC_ADICIONAL) permite adjuntar
-- documentos de soporte con tipos que la restricción original no contemplaba
-- (FOTO_NEGOCIO, EXTRACTO_BANCARIO, CAMARA_COMERCIO, OTRO_COMPROBANTE), lo que
-- provocaba: new row for relation "documento_cliente" violates check
-- constraint "ck_doc_tipo". Se amplía la lista para incluirlos.
-- ============================================================

ALTER TABLE documento_cliente DROP CONSTRAINT ck_doc_tipo;

ALTER TABLE documento_cliente ADD CONSTRAINT ck_doc_tipo
CHECK (tipo_documento IN (
  'CEDULA_FRONTAL',
  'CEDULA_TRASERA',
  'SELFIE',
  'RECIBO_PUBLICO',
  'FOTO_NEGOCIO',
  'RUT',
  'EXTRACTO_BANCARIO',
  'CAMARA_COMERCIO',
  'OTRO_COMPROBANTE',
  'OTRO'
));
