/**
 * database.types.ts — Tipos TS de la BD Plurall.
 * Generado desde Supabase (proyecto Plurall-Fants) el 2026-08-13,
 * estado consolidado tras migraciones db/01..23 (nombres atomicos 1B+2A).
 * Fuente de verdad del esquema: db/plurall_database_completa.sql
 * Regenerar con: mcp Supabase generate_typescript_types / supabase gen types.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agente_base_conocimiento: {
        Row: {
          creado_en: string
          fuente: string
          id: string
          pregunta: string
          respuesta: string
        }
        Insert: {
          creado_en?: string
          fuente?: string
          id?: string
          pregunta: string
          respuesta: string
        }
        Update: {
          creado_en?: string
          fuente?: string
          id?: string
          pregunta?: string
          respuesta?: string
        }
        Relationships: []
      }
      agente_ticket: {
        Row: {
          canal: string
          creado_en: string
          estado: string
          id: string
          pregunta: string
          respuesta: string | null
          resuelto_en: string | null
          sentimiento: string | null
          usuario_id: string
        }
        Insert: {
          canal?: string
          creado_en?: string
          estado?: string
          id?: string
          pregunta: string
          respuesta?: string | null
          resuelto_en?: string | null
          sentimiento?: string | null
          usuario_id: string
        }
        Update: {
          canal?: string
          creado_en?: string
          estado?: string
          id?: string
          pregunta?: string
          respuesta?: string | null
          resuelto_en?: string | null
          sentimiento?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      asignacion_asesor: {
        Row: {
          activa: boolean
          created_at: string | null
          fecha_asignacion: string | null
          fecha_fin: string | null
          id_asesor: string
          id_asignacion: string
          id_cliente: string
          notas: string | null
        }
        Insert: {
          activa?: boolean
          created_at?: string | null
          fecha_asignacion?: string | null
          fecha_fin?: string | null
          id_asesor: string
          id_asignacion?: string
          id_cliente: string
          notas?: string | null
        }
        Update: {
          activa?: boolean
          created_at?: string | null
          fecha_asignacion?: string | null
          fecha_fin?: string | null
          id_asesor?: string
          id_asignacion?: string
          id_cliente?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asignacion_asesor_id_asesor_fkey"
            columns: ["id_asesor"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignacion_asesor_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion_realizada: string
          fecha_evento: string
          id_auditoria: string
          id_registro_afectado: string
          id_usuario_responsable: string | null
          ip_origen: string | null
          tabla_afectada: string
          user_agent: string | null
          valor_anterior: Json | null
          valor_nuevo: Json | null
        }
        Insert: {
          accion_realizada: string
          fecha_evento?: string
          id_auditoria?: string
          id_registro_afectado: string
          id_usuario_responsable?: string | null
          ip_origen?: string | null
          tabla_afectada: string
          user_agent?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Update: {
          accion_realizada?: string
          fecha_evento?: string
          id_auditoria?: string
          id_registro_afectado?: string
          id_usuario_responsable?: string | null
          ip_origen?: string | null
          tabla_afectada?: string
          user_agent?: string | null
          valor_anterior?: Json | null
          valor_nuevo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_id_usuario_responsable_fkey"
            columns: ["id_usuario_responsable"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      banco: {
        Row: {
          activo: boolean
          created_at: string | null
          id_banco: string
          nombre: string
          orden: number | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          id_banco?: string
          nombre: string
          orden?: number | null
          tipo: string
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          id_banco?: string
          nombre?: string
          orden?: number | null
          tipo?: string
        }
        Relationships: []
      }
      cliente: {
        Row: {
          antiguedad_negocio_meses: number | null
          ciudad: string | null
          ciudad_casa: string | null
          ciudad_negocio: string | null
          created_at: string | null
          departamento: string | null
          departamento_casa: string | null
          departamento_negocio: string | null
          descripcion_negocio: string | null
          direccion: string | null
          direccion_casa: string | null
          direccion_negocio: string | null
          dni: string
          email: string
          id_cliente: string
          id_estado_cliente: string
          id_tipo_doc: string | null
          id_tipo_negocio: string | null
          id_usuario_cuenta: string
          lat_casa: number | null
          lat_negocio: number | null
          lon_casa: number | null
          lon_negocio: number | null
          nombre_negocio: string | null
          primer_apellido: string
          primer_nombre: string
          score_credito: number | null
          segundo_apellido: string | null
          segundo_nombre: string | null
          telefono: string
          updated_at: string | null
        }
        Insert: {
          antiguedad_negocio_meses?: number | null
          ciudad?: string | null
          ciudad_casa?: string | null
          ciudad_negocio?: string | null
          created_at?: string | null
          departamento?: string | null
          departamento_casa?: string | null
          departamento_negocio?: string | null
          descripcion_negocio?: string | null
          direccion?: string | null
          direccion_casa?: string | null
          direccion_negocio?: string | null
          dni: string
          email: string
          id_cliente?: string
          id_estado_cliente: string
          id_tipo_doc?: string | null
          id_tipo_negocio?: string | null
          id_usuario_cuenta: string
          lat_casa?: number | null
          lat_negocio?: number | null
          lon_casa?: number | null
          lon_negocio?: number | null
          nombre_negocio?: string | null
          primer_apellido: string
          primer_nombre: string
          score_credito?: number | null
          segundo_apellido?: string | null
          segundo_nombre?: string | null
          telefono: string
          updated_at?: string | null
        }
        Update: {
          antiguedad_negocio_meses?: number | null
          ciudad?: string | null
          ciudad_casa?: string | null
          ciudad_negocio?: string | null
          created_at?: string | null
          departamento?: string | null
          departamento_casa?: string | null
          departamento_negocio?: string | null
          descripcion_negocio?: string | null
          direccion?: string | null
          direccion_casa?: string | null
          direccion_negocio?: string | null
          dni?: string
          email?: string
          id_cliente?: string
          id_estado_cliente?: string
          id_tipo_doc?: string | null
          id_tipo_negocio?: string | null
          id_usuario_cuenta?: string
          lat_casa?: number | null
          lat_negocio?: number | null
          lon_casa?: number | null
          lon_negocio?: number | null
          nombre_negocio?: string | null
          primer_apellido?: string
          primer_nombre?: string
          score_credito?: number | null
          segundo_apellido?: string | null
          segundo_nombre?: string | null
          telefono?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_id_estado_cliente_fkey"
            columns: ["id_estado_cliente"]
            isOneToOne: false
            referencedRelation: "estado_cliente"
            referencedColumns: ["id_estado_cliente"]
          },
          {
            foreignKeyName: "cliente_id_tipo_doc_fkey"
            columns: ["id_tipo_doc"]
            isOneToOne: false
            referencedRelation: "tipo_documento_identidad"
            referencedColumns: ["id_tipo_doc"]
          },
          {
            foreignKeyName: "cliente_id_tipo_negocio_fkey"
            columns: ["id_tipo_negocio"]
            isOneToOne: false
            referencedRelation: "tipo_negocio"
            referencedColumns: ["id_tipo_negocio"]
          },
          {
            foreignKeyName: "cliente_id_usuario_cuenta_fkey"
            columns: ["id_usuario_cuenta"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      credito: {
        Row: {
          created_at: string | null
          cuota_fija: number
          cuotas_en_mora: number
          cuotas_pagadas: number
          dias_mora_maximo: number
          estado_credito: string
          fecha_desembolso: string
          fecha_primera_cuota: string
          fecha_ultima_cuota: string
          id_cliente: string
          id_credito: string
          id_solicitud: string
          monto_desembolsado: number
          numero_cuotas: number
          saldo_pendiente: number
          tasa_interes_anual: number
          tasa_interes_mensual: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cuota_fija: number
          cuotas_en_mora?: number
          cuotas_pagadas?: number
          dias_mora_maximo?: number
          estado_credito?: string
          fecha_desembolso: string
          fecha_primera_cuota: string
          fecha_ultima_cuota: string
          id_cliente: string
          id_credito?: string
          id_solicitud: string
          monto_desembolsado: number
          numero_cuotas: number
          saldo_pendiente: number
          tasa_interes_anual: number
          tasa_interes_mensual: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cuota_fija?: number
          cuotas_en_mora?: number
          cuotas_pagadas?: number
          dias_mora_maximo?: number
          estado_credito?: string
          fecha_desembolso?: string
          fecha_primera_cuota?: string
          fecha_ultima_cuota?: string
          id_cliente?: string
          id_credito?: string
          id_solicitud?: string
          monto_desembolsado?: number
          numero_cuotas?: number
          saldo_pendiente?: number
          tasa_interes_anual?: number
          tasa_interes_mensual?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credito_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "credito_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
        ]
      }
      cuota: {
        Row: {
          created_at: string | null
          estado_cuota: string
          fecha_pago_real: string | null
          fecha_vencimiento: string
          id_cuota: string
          id_plan_pago: string
          monto_capital: number
          monto_interes: number
          monto_mora_cobrada: number | null
          monto_pagado_real: number | null
          monto_total_cuota: number
          numero_cuota: number
          saldo_despues_pago: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado_cuota?: string
          fecha_pago_real?: string | null
          fecha_vencimiento: string
          id_cuota?: string
          id_plan_pago: string
          monto_capital: number
          monto_interes: number
          monto_mora_cobrada?: number | null
          monto_pagado_real?: number | null
          monto_total_cuota: number
          numero_cuota: number
          saldo_despues_pago: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado_cuota?: string
          fecha_pago_real?: string | null
          fecha_vencimiento?: string
          id_cuota?: string
          id_plan_pago?: string
          monto_capital?: number
          monto_interes?: number
          monto_mora_cobrada?: number | null
          monto_pagado_real?: number | null
          monto_total_cuota?: number
          numero_cuota?: number
          saldo_despues_pago?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuota_id_plan_pago_fkey"
            columns: ["id_plan_pago"]
            isOneToOne: false
            referencedRelation: "plan_pago"
            referencedColumns: ["id_plan_pago"]
          },
        ]
      }
      decision_solicitud: {
        Row: {
          comentarios_cliente: string | null
          comentarios_tecnicos: string | null
          created_at: string | null
          fecha_decision: string
          id_analista: string
          id_decision: string
          id_motivo_rechazo: string | null
          id_solicitud: string
          monto_aprobado: number | null
          plazo_aprobado: number | null
          resultado: string
          tasa_interes_aprobada: number | null
        }
        Insert: {
          comentarios_cliente?: string | null
          comentarios_tecnicos?: string | null
          created_at?: string | null
          fecha_decision?: string
          id_analista: string
          id_decision?: string
          id_motivo_rechazo?: string | null
          id_solicitud: string
          monto_aprobado?: number | null
          plazo_aprobado?: number | null
          resultado: string
          tasa_interes_aprobada?: number | null
        }
        Update: {
          comentarios_cliente?: string | null
          comentarios_tecnicos?: string | null
          created_at?: string | null
          fecha_decision?: string
          id_analista?: string
          id_decision?: string
          id_motivo_rechazo?: string | null
          id_solicitud?: string
          monto_aprobado?: number | null
          plazo_aprobado?: number | null
          resultado?: string
          tasa_interes_aprobada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_solicitud_id_analista_fkey"
            columns: ["id_analista"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_solicitud_id_motivo_rechazo_fkey"
            columns: ["id_motivo_rechazo"]
            isOneToOne: false
            referencedRelation: "motivo_rechazo"
            referencedColumns: ["id_motivo"]
          },
          {
            foreignKeyName: "decision_solicitud_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
        ]
      }
      departamento: {
        Row: {
          activo: boolean
          codigo_dane: string
          id_departamento: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo_dane: string
          id_departamento?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo_dane?: string
          id_departamento?: string
          nombre?: string
        }
        Relationships: []
      }
      detalle_cliente: {
        Row: {
          ahorros: number | null
          arriendo_casa: number | null
          arriendo_negocio: number | null
          banco_preferido: string | null
          colaboracion_gastos: boolean | null
          created_at: string | null
          dependientes: number | null
          egresos_mensuales: number | null
          empleados_negocio: number | null
          estado_civil: string | null
          estrato: number | null
          id_cliente: string
          id_detalle: string
          ingresos_mensuales: number | null
          nivel_educativo: string | null
          numero_cuenta: string | null
          otras_obligaciones: number | null
          patrimonio_estimado: number | null
          personas_cargo: number | null
          tiene_vehiculo: boolean | null
          tipo_cuenta_bancaria: string | null
          tipo_vivienda: string | null
          updated_at: string | null
        }
        Insert: {
          ahorros?: number | null
          arriendo_casa?: number | null
          arriendo_negocio?: number | null
          banco_preferido?: string | null
          colaboracion_gastos?: boolean | null
          created_at?: string | null
          dependientes?: number | null
          egresos_mensuales?: number | null
          empleados_negocio?: number | null
          estado_civil?: string | null
          estrato?: number | null
          id_cliente: string
          id_detalle?: string
          ingresos_mensuales?: number | null
          nivel_educativo?: string | null
          numero_cuenta?: string | null
          otras_obligaciones?: number | null
          patrimonio_estimado?: number | null
          personas_cargo?: number | null
          tiene_vehiculo?: boolean | null
          tipo_cuenta_bancaria?: string | null
          tipo_vivienda?: string | null
          updated_at?: string | null
        }
        Update: {
          ahorros?: number | null
          arriendo_casa?: number | null
          arriendo_negocio?: number | null
          banco_preferido?: string | null
          colaboracion_gastos?: boolean | null
          created_at?: string | null
          dependientes?: number | null
          egresos_mensuales?: number | null
          empleados_negocio?: number | null
          estado_civil?: string | null
          estrato?: number | null
          id_cliente?: string
          id_detalle?: string
          ingresos_mensuales?: number | null
          nivel_educativo?: string | null
          numero_cuenta?: string | null
          otras_obligaciones?: number | null
          patrimonio_estimado?: number | null
          personas_cargo?: number | null
          tiene_vehiculo?: boolean | null
          tipo_cuenta_bancaria?: string | null
          tipo_vivienda?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "detalle_cliente_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: true
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
        ]
      }
      documento_cliente: {
        Row: {
          activo: boolean
          created_at: string | null
          estado_verificacion: string
          fecha_vencimiento: string | null
          id_cliente: string
          id_documento: string
          mime_type: string | null
          motivo_rechazo_doc: string | null
          tamanio_bytes: number | null
          tipo_documento: string
          url_archivo: string
          verificado_at: string | null
          verificado_por: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          estado_verificacion?: string
          fecha_vencimiento?: string | null
          id_cliente: string
          id_documento?: string
          mime_type?: string | null
          motivo_rechazo_doc?: string | null
          tamanio_bytes?: number | null
          tipo_documento: string
          url_archivo: string
          verificado_at?: string | null
          verificado_por?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          estado_verificacion?: string
          fecha_vencimiento?: string | null
          id_cliente?: string
          id_documento?: string
          mime_type?: string | null
          motivo_rechazo_doc?: string | null
          tamanio_bytes?: number | null
          tipo_documento?: string
          url_archivo?: string
          verificado_at?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_cliente_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "documento_cliente_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_legal: {
        Row: {
          activo: boolean
          generado_at: string
          hash_archivo: string | null
          id_cliente: string
          id_credito: string | null
          id_documento_legal: string
          id_tipo_doc_legal: string
          mime_type: string
          tamanio_bytes: number | null
          url_archivo: string
          vigente_hasta: string | null
        }
        Insert: {
          activo?: boolean
          generado_at?: string
          hash_archivo?: string | null
          id_cliente: string
          id_credito?: string | null
          id_documento_legal?: string
          id_tipo_doc_legal: string
          mime_type?: string
          tamanio_bytes?: number | null
          url_archivo: string
          vigente_hasta?: string | null
        }
        Update: {
          activo?: boolean
          generado_at?: string
          hash_archivo?: string | null
          id_cliente?: string
          id_credito?: string | null
          id_documento_legal?: string
          id_tipo_doc_legal?: string
          mime_type?: string
          tamanio_bytes?: number | null
          url_archivo?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_legal_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "documento_legal_id_credito_fkey"
            columns: ["id_credito"]
            isOneToOne: false
            referencedRelation: "credito"
            referencedColumns: ["id_credito"]
          },
          {
            foreignKeyName: "documento_legal_id_tipo_doc_legal_fkey"
            columns: ["id_tipo_doc_legal"]
            isOneToOne: false
            referencedRelation: "tipo_documento_legal"
            referencedColumns: ["id_tipo_doc_legal"]
          },
        ]
      }
      estado_cliente: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id_estado_cliente: string
          nombre: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id_estado_cliente?: string
          nombre: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id_estado_cliente?: string
          nombre?: string
        }
        Relationships: []
      }
      estado_solicitud: {
        Row: {
          created_at: string | null
          descripcion: string | null
          id_estado_solicitud: string
          nombre: string
          orden: number | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          id_estado_solicitud?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          id_estado_solicitud?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      evento_funnel: {
        Row: {
          created_at: string | null
          evento: string
          id_evento: string
          id_solicitud: string | null
          id_usuario: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          evento: string
          id_evento?: string
          id_solicitud?: string | null
          id_usuario: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          evento?: string
          id_evento?: string
          id_solicitud?: string | null
          id_usuario?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_funnel_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
        ]
      }
      gestion_cobranza: {
        Row: {
          created_at: string | null
          fecha_gestion: string
          fecha_promesa: string | null
          id_asesor: string
          id_cliente: string
          id_credito: string
          id_gestion: string
          monto_prometido: number | null
          monto_recibido: number | null
          observaciones: string | null
          resultado: string
          tipo_gestion: string
        }
        Insert: {
          created_at?: string | null
          fecha_gestion?: string
          fecha_promesa?: string | null
          id_asesor: string
          id_cliente: string
          id_credito: string
          id_gestion?: string
          monto_prometido?: number | null
          monto_recibido?: number | null
          observaciones?: string | null
          resultado: string
          tipo_gestion: string
        }
        Update: {
          created_at?: string | null
          fecha_gestion?: string
          fecha_promesa?: string | null
          id_asesor?: string
          id_cliente?: string
          id_credito?: string
          id_gestion?: string
          monto_prometido?: number | null
          monto_recibido?: number | null
          observaciones?: string | null
          resultado?: string
          tipo_gestion?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestion_cobranza_id_asesor_fkey"
            columns: ["id_asesor"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestion_cobranza_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "gestion_cobranza_id_credito_fkey"
            columns: ["id_credito"]
            isOneToOne: false
            referencedRelation: "credito"
            referencedColumns: ["id_credito"]
          },
        ]
      }
      log_descarga_documento: {
        Row: {
          descargado_at: string
          id_cliente: string
          id_documento_legal: string
          id_log: string
          ip_cliente: string | null
          user_agent: string | null
        }
        Insert: {
          descargado_at?: string
          id_cliente: string
          id_documento_legal: string
          id_log?: string
          ip_cliente?: string | null
          user_agent?: string | null
        }
        Update: {
          descargado_at?: string
          id_cliente?: string
          id_documento_legal?: string
          id_log?: string
          ip_cliente?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_descarga_documento_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "log_descarga_documento_id_documento_legal_fkey"
            columns: ["id_documento_legal"]
            isOneToOne: false
            referencedRelation: "documento_legal"
            referencedColumns: ["id_documento_legal"]
          },
        ]
      }
      log_error_registro: {
        Row: {
          created_at: string | null
          email_auth: string | null
          error_detalle: string | null
          id_auth_user: string | null
          id_log: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          email_auth?: string | null
          error_detalle?: string | null
          id_auth_user?: string | null
          id_log?: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          email_auth?: string | null
          error_detalle?: string | null
          id_auth_user?: string | null
          id_log?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      modelo_score: {
        Row: {
          activo: boolean
          created_at: string | null
          descripcion: string | null
          id_modelo_score: string
          nombre_modelo: string
          puntaje_maximo: number
          puntaje_minimo: number
          vigente_desde: string
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          id_modelo_score?: string
          nombre_modelo: string
          puntaje_maximo?: number
          puntaje_minimo?: number
          vigente_desde?: string
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          id_modelo_score?: string
          nombre_modelo?: string
          puntaje_maximo?: number
          puntaje_minimo?: number
          vigente_desde?: string
        }
        Relationships: []
      }
      motivo_rechazo: {
        Row: {
          activo: boolean
          created_at: string | null
          descripcion_motivo: string
          id_motivo: string
          visible_cliente: boolean
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          descripcion_motivo: string
          id_motivo?: string
          visible_cliente?: boolean
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          descripcion_motivo?: string
          id_motivo?: string
          visible_cliente?: boolean
        }
        Relationships: []
      }
      municipio: {
        Row: {
          activo: boolean
          id_departamento: string
          id_municipio: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id_departamento: string
          id_municipio?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id_departamento?: string
          id_municipio?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipio_id_departamento_fkey"
            columns: ["id_departamento"]
            isOneToOne: false
            referencedRelation: "departamento"
            referencedColumns: ["id_departamento"]
          },
        ]
      }
      notificacion: {
        Row: {
          asunto: string | null
          canal: string
          created_at: string | null
          cuerpo: string | null
          destinatario: string
          enviado_at: string | null
          error_detalle: string | null
          estado_envio: string
          id_cliente: string
          id_credito: string | null
          id_notificacion: string
          id_solicitud: string | null
          id_tipo_notif: string
          intentos: number
          proveedor: string | null
          referencia_proveedor: string | null
        }
        Insert: {
          asunto?: string | null
          canal: string
          created_at?: string | null
          cuerpo?: string | null
          destinatario: string
          enviado_at?: string | null
          error_detalle?: string | null
          estado_envio?: string
          id_cliente: string
          id_credito?: string | null
          id_notificacion?: string
          id_solicitud?: string | null
          id_tipo_notif: string
          intentos?: number
          proveedor?: string | null
          referencia_proveedor?: string | null
        }
        Update: {
          asunto?: string | null
          canal?: string
          created_at?: string | null
          cuerpo?: string | null
          destinatario?: string
          enviado_at?: string | null
          error_detalle?: string | null
          estado_envio?: string
          id_cliente?: string
          id_credito?: string | null
          id_notificacion?: string
          id_solicitud?: string | null
          id_tipo_notif?: string
          intentos?: number
          proveedor?: string | null
          referencia_proveedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacion_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "notificacion_id_credito_fkey"
            columns: ["id_credito"]
            isOneToOne: false
            referencedRelation: "credito"
            referencedColumns: ["id_credito"]
          },
          {
            foreignKeyName: "notificacion_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
          {
            foreignKeyName: "notificacion_id_tipo_notif_fkey"
            columns: ["id_tipo_notif"]
            isOneToOne: false
            referencedRelation: "tipo_notificacion"
            referencedColumns: ["id_tipo_notif"]
          },
        ]
      }
      opcion_pregunta: {
        Row: {
          activo: boolean
          id_opcion: string
          id_pregunta: string
          orden: number | null
          texto_opcion: string
          valor_puntos: number
        }
        Insert: {
          activo?: boolean
          id_opcion?: string
          id_pregunta: string
          orden?: number | null
          texto_opcion: string
          valor_puntos?: number
        }
        Update: {
          activo?: boolean
          id_opcion?: string
          id_pregunta?: string
          orden?: number | null
          texto_opcion?: string
          valor_puntos?: number
        }
        Relationships: [
          {
            foreignKeyName: "opcion_pregunta_id_pregunta_fkey"
            columns: ["id_pregunta"]
            isOneToOne: false
            referencedRelation: "pregunta"
            referencedColumns: ["id_pregunta"]
          },
        ]
      }
      otp_recuperacion: {
        Row: {
          celular: string
          created_at: string | null
          expiracion: string
          id_otp: string
          otp_code: string
          usado: boolean | null
        }
        Insert: {
          celular: string
          created_at?: string | null
          expiracion: string
          id_otp?: string
          otp_code: string
          usado?: boolean | null
        }
        Update: {
          celular?: string
          created_at?: string | null
          expiracion?: string
          id_otp?: string
          otp_code?: string
          usado?: boolean | null
        }
        Relationships: []
      }
      pago: {
        Row: {
          comprobante_url: string | null
          created_at: string | null
          estado: string
          fecha_pago: string
          id_credito: string
          id_cuota: string
          id_recibo: string
          id_usuario_receptor: string | null
          intentos_cobro: number
          metodo_pago: string
          monto_capital: number
          monto_interes: number
          monto_mora: number
          monto_pagado: number
          referencia_externa: string | null
          updated_at: string | null
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string | null
          estado?: string
          fecha_pago?: string
          id_credito: string
          id_cuota: string
          id_recibo?: string
          id_usuario_receptor?: string | null
          intentos_cobro?: number
          metodo_pago: string
          monto_capital?: number
          monto_interes?: number
          monto_mora?: number
          monto_pagado: number
          referencia_externa?: string | null
          updated_at?: string | null
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string | null
          estado?: string
          fecha_pago?: string
          id_credito?: string
          id_cuota?: string
          id_recibo?: string
          id_usuario_receptor?: string | null
          intentos_cobro?: number
          metodo_pago?: string
          monto_capital?: number
          monto_interes?: number
          monto_mora?: number
          monto_pagado?: number
          referencia_externa?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pago_id_credito_fkey"
            columns: ["id_credito"]
            isOneToOne: false
            referencedRelation: "credito"
            referencedColumns: ["id_credito"]
          },
          {
            foreignKeyName: "pago_id_cuota_fkey"
            columns: ["id_cuota"]
            isOneToOne: false
            referencedRelation: "cuota"
            referencedColumns: ["id_cuota"]
          },
          {
            foreignKeyName: "pago_id_usuario_receptor_fkey"
            columns: ["id_usuario_receptor"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_usuario: {
        Row: {
          activo: boolean
          bloqueado_hasta: string | null
          created_at: string | null
          id: string
          id_rol: string
          intentos_fallidos: number
          primer_apellido: string | null
          primer_nombre: string | null
          segundo_apellido: string | null
          segundo_nombre: string | null
          ultimo_login: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          bloqueado_hasta?: string | null
          created_at?: string | null
          id: string
          id_rol: string
          intentos_fallidos?: number
          primer_apellido?: string | null
          primer_nombre?: string | null
          segundo_apellido?: string | null
          segundo_nombre?: string | null
          ultimo_login?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          bloqueado_hasta?: string | null
          created_at?: string | null
          id?: string
          id_rol?: string
          intentos_fallidos?: number
          primer_apellido?: string | null
          primer_nombre?: string | null
          segundo_apellido?: string | null
          segundo_nombre?: string | null
          ultimo_login?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_usuario_id_rol_fkey"
            columns: ["id_rol"]
            isOneToOne: false
            referencedRelation: "rol"
            referencedColumns: ["id_rol"]
          },
        ]
      }
      plan_pago: {
        Row: {
          created_at: string | null
          fecha_fin_cobro: string
          fecha_inicio_cobro: string
          frecuencia_pago: string
          id_credito: string
          id_plan_pago: string
          num_cuotas_totales: number
          tasa_mora_diaria: number
        }
        Insert: {
          created_at?: string | null
          fecha_fin_cobro: string
          fecha_inicio_cobro: string
          frecuencia_pago?: string
          id_credito: string
          id_plan_pago?: string
          num_cuotas_totales: number
          tasa_mora_diaria?: number
        }
        Update: {
          created_at?: string | null
          fecha_fin_cobro?: string
          fecha_inicio_cobro?: string
          frecuencia_pago?: string
          id_credito?: string
          id_plan_pago?: string
          num_cuotas_totales?: number
          tasa_mora_diaria?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_pago_id_credito_fkey"
            columns: ["id_credito"]
            isOneToOne: false
            referencedRelation: "credito"
            referencedColumns: ["id_credito"]
          },
        ]
      }
      pqr: {
        Row: {
          asunto: string
          created_at: string
          descripcion: string
          estado: string
          fecha_respuesta: string | null
          id_cliente: string
          id_pqr: string
          id_respondido_por: string | null
          respuesta: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          asunto: string
          created_at?: string
          descripcion: string
          estado?: string
          fecha_respuesta?: string | null
          id_cliente: string
          id_pqr?: string
          id_respondido_por?: string | null
          respuesta?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          asunto?: string
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_respuesta?: string | null
          id_cliente?: string
          id_pqr?: string
          id_respondido_por?: string | null
          respuesta?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pqr_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "pqr_id_respondido_por_fkey"
            columns: ["id_respondido_por"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      pregunta: {
        Row: {
          activo: boolean
          created_at: string | null
          enunciado: string
          id_pregunta: string
          obligatoria: boolean
          orden: number | null
          tipo_input: string
          tipo_pregunta: string
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          enunciado: string
          id_pregunta?: string
          obligatoria?: boolean
          orden?: number | null
          tipo_input?: string
          tipo_pregunta: string
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          enunciado?: string
          id_pregunta?: string
          obligatoria?: boolean
          orden?: number | null
          tipo_input?: string
          tipo_pregunta?: string
        }
        Relationships: []
      }
      rango_puntaje_pregunta: {
        Row: {
          activo: boolean
          created_at: string | null
          id_pregunta: string
          id_rango: string
          puntos: number
          valor_max: number | null
          valor_min: number
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          id_pregunta: string
          id_rango?: string
          puntos: number
          valor_max?: number | null
          valor_min?: number
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          id_pregunta?: string
          id_rango?: string
          puntos?: number
          valor_max?: number | null
          valor_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "rango_puntaje_pregunta_id_pregunta_fkey"
            columns: ["id_pregunta"]
            isOneToOne: false
            referencedRelation: "pregunta"
            referencedColumns: ["id_pregunta"]
          },
        ]
      }
      respuesta_cliente: {
        Row: {
          fecha_respuesta: string
          id_opcion: string | null
          id_pregunta: string
          id_respuesta: string
          id_solicitud: string
          respuesta_numerica: number | null
          respuesta_texto: string | null
        }
        Insert: {
          fecha_respuesta?: string
          id_opcion?: string | null
          id_pregunta: string
          id_respuesta?: string
          id_solicitud: string
          respuesta_numerica?: number | null
          respuesta_texto?: string | null
        }
        Update: {
          fecha_respuesta?: string
          id_opcion?: string | null
          id_pregunta?: string
          id_respuesta?: string
          id_solicitud?: string
          respuesta_numerica?: number | null
          respuesta_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respuesta_cliente_id_opcion_fkey"
            columns: ["id_opcion"]
            isOneToOne: false
            referencedRelation: "opcion_pregunta"
            referencedColumns: ["id_opcion"]
          },
          {
            foreignKeyName: "respuesta_cliente_id_pregunta_fkey"
            columns: ["id_pregunta"]
            isOneToOne: false
            referencedRelation: "pregunta"
            referencedColumns: ["id_pregunta"]
          },
          {
            foreignKeyName: "respuesta_cliente_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
        ]
      }
      rol: {
        Row: {
          activo: boolean
          created_at: string | null
          descripcion: string | null
          id_rol: string
          nombre_rol: string
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          id_rol?: string
          nombre_rol: string
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          id_rol?: string
          nombre_rol?: string
        }
        Relationships: []
      }
      score: {
        Row: {
          created_at: string | null
          fecha_evaluacion: string
          id_modelo_score: string
          id_score: string
          id_solicitud: string
          porcentaje: number | null
          puntaje_maximo_posible: number | null
          puntaje_total: number
          recomendacion: string | null
        }
        Insert: {
          created_at?: string | null
          fecha_evaluacion?: string
          id_modelo_score: string
          id_score?: string
          id_solicitud: string
          porcentaje?: number | null
          puntaje_maximo_posible?: number | null
          puntaje_total?: number
          recomendacion?: string | null
        }
        Update: {
          created_at?: string | null
          fecha_evaluacion?: string
          id_modelo_score?: string
          id_score?: string
          id_solicitud?: string
          porcentaje?: number | null
          puntaje_maximo_posible?: number | null
          puntaje_total?: number
          recomendacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_id_modelo_score_fkey"
            columns: ["id_modelo_score"]
            isOneToOne: false
            referencedRelation: "modelo_score"
            referencedColumns: ["id_modelo_score"]
          },
          {
            foreignKeyName: "score_id_solicitud_fkey"
            columns: ["id_solicitud"]
            isOneToOne: false
            referencedRelation: "solicitud_credito"
            referencedColumns: ["id_solicitud"]
          },
        ]
      }
      solicitud_credito: {
        Row: {
          canal_solicitud: string
          comentarios_analista: string | null
          comentarios_cliente: string | null
          created_at: string | null
          fecha_asignacion: string | null
          fecha_decision: string | null
          fecha_solicitud: string
          id_cliente: string
          id_estado_solicitud: string
          id_motivo_rechazo: string | null
          id_solicitud: string
          id_usuario_evaluador: string | null
          ip_solicitud: string | null
          monto_solicitado: number
          plazo_meses: number
          proposito: string | null
          tasa_interes_propuesta: number | null
          updated_at: string | null
        }
        Insert: {
          canal_solicitud?: string
          comentarios_analista?: string | null
          comentarios_cliente?: string | null
          created_at?: string | null
          fecha_asignacion?: string | null
          fecha_decision?: string | null
          fecha_solicitud?: string
          id_cliente: string
          id_estado_solicitud: string
          id_motivo_rechazo?: string | null
          id_solicitud?: string
          id_usuario_evaluador?: string | null
          ip_solicitud?: string | null
          monto_solicitado: number
          plazo_meses: number
          proposito?: string | null
          tasa_interes_propuesta?: number | null
          updated_at?: string | null
        }
        Update: {
          canal_solicitud?: string
          comentarios_analista?: string | null
          comentarios_cliente?: string | null
          created_at?: string | null
          fecha_asignacion?: string | null
          fecha_decision?: string | null
          fecha_solicitud?: string
          id_cliente?: string
          id_estado_solicitud?: string
          id_motivo_rechazo?: string | null
          id_solicitud?: string
          id_usuario_evaluador?: string | null
          ip_solicitud?: string | null
          monto_solicitado?: number
          plazo_meses?: number
          proposito?: string | null
          tasa_interes_propuesta?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitud_credito_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "solicitud_credito_id_estado_solicitud_fkey"
            columns: ["id_estado_solicitud"]
            isOneToOne: false
            referencedRelation: "estado_solicitud"
            referencedColumns: ["id_estado_solicitud"]
          },
          {
            foreignKeyName: "solicitud_credito_id_motivo_rechazo_fkey"
            columns: ["id_motivo_rechazo"]
            isOneToOne: false
            referencedRelation: "motivo_rechazo"
            referencedColumns: ["id_motivo"]
          },
          {
            foreignKeyName: "solicitud_credito_id_usuario_evaluador_fkey"
            columns: ["id_usuario_evaluador"]
            isOneToOne: false
            referencedRelation: "perfil_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_documento_identidad: {
        Row: {
          activo: boolean
          codigo: string
          id_tipo_doc: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          id_tipo_doc?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          id_tipo_doc?: string
          nombre?: string
        }
        Relationships: []
      }
      tipo_documento_legal: {
        Row: {
          activo: boolean
          codigo: string
          descripcion: string | null
          id_tipo_doc_legal: string
          max_descargas_dia: number
          nombre: string
          requiere_credito_cancelado: boolean
        }
        Insert: {
          activo?: boolean
          codigo: string
          descripcion?: string | null
          id_tipo_doc_legal?: string
          max_descargas_dia?: number
          nombre: string
          requiere_credito_cancelado?: boolean
        }
        Update: {
          activo?: boolean
          codigo?: string
          descripcion?: string | null
          id_tipo_doc_legal?: string
          max_descargas_dia?: number
          nombre?: string
          requiere_credito_cancelado?: boolean
        }
        Relationships: []
      }
      tipo_negocio: {
        Row: {
          activo: boolean
          id_tipo_negocio: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id_tipo_negocio?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id_tipo_negocio?: string
          nombre?: string
        }
        Relationships: []
      }
      tipo_notificacion: {
        Row: {
          activo: boolean
          canal: string
          codigo: string
          id_tipo_notif: string
          nombre: string
          plantilla_asunto: string | null
          plantilla_cuerpo: string | null
        }
        Insert: {
          activo?: boolean
          canal: string
          codigo: string
          id_tipo_notif?: string
          nombre: string
          plantilla_asunto?: string | null
          plantilla_cuerpo?: string | null
        }
        Update: {
          activo?: boolean
          canal?: string
          codigo?: string
          id_tipo_notif?: string
          nombre?: string
          plantilla_asunto?: string | null
          plantilla_cuerpo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      asignar_asesor_a_cliente: {
        Args: { p_id_asesor: string; p_id_cliente: string }
        Returns: string
      }
      es_admin: { Args: never; Returns: boolean }
      es_analista_o_admin: { Args: never; Returns: boolean }
      es_asesor_de_cliente: { Args: { p_id_cliente: string }; Returns: boolean }
      es_staff: { Args: never; Returns: boolean }
      es_supervisor_o_admin: { Args: never; Returns: boolean }
      fn_crear_solicitud_completa: {
        Args: {
          p_docs?: Json
          p_ip?: string
          p_monto: number
          p_plazo: number
          p_respuestas?: Json
        }
        Returns: Json
      }
      fn_detectar_mora: { Args: never; Returns: undefined }
      fn_format_nombre: {
        Args: {
          p_primer_apellido?: string
          p_primer_nombre: string
          p_segundo_apellido?: string
          p_segundo_nombre?: string
        }
        Returns: string
      }
      fn_parse_nombre: {
        Args: { p_nombre: string }
        Returns: Record<string, unknown>
      }
      fn_puede_descargar_documento: {
        Args: { p_id_cliente: string; p_id_documento_legal: string }
        Returns: boolean
      }
      fn_verificar_disponibilidad: {
        Args: { p_dni?: string; p_email?: string }
        Returns: Json
      }
      fn_verificar_elegibilidad: { Args: never; Returns: Json }
      mi_id_cliente: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
