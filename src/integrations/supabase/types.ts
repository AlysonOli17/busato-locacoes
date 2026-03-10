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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      aditivos_equipamentos: {
        Row: {
          aditivo_id: string
          created_at: string
          data_devolucao: string | null
          data_entrega: string | null
          equipamento_id: string
          hora_minima: number
          horas_contratadas: number
          id: string
          valor_hora: number
          valor_hora_excedente: number
        }
        Insert: {
          aditivo_id: string
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string | null
          equipamento_id: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Update: {
          aditivo_id?: string
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string | null
          equipamento_id?: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Relationships: [
          {
            foreignKeyName: "aditivos_equipamentos_aditivo_id_fkey"
            columns: ["aditivo_id"]
            isOneToOne: false
            referencedRelation: "contratos_aditivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aditivos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      apolices: {
        Row: {
          created_at: string
          id: string
          numero_parcelas: number
          renovacao_automatica: boolean
          seguradora: string
          status: string
          tem_adesao: boolean
          tem_parcelamento: boolean
          updated_at: string
          valor: number
          valor_adesao: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero_parcelas?: number
          renovacao_automatica?: boolean
          seguradora: string
          status?: string
          tem_adesao?: boolean
          tem_parcelamento?: boolean
          updated_at?: string
          valor?: number
          valor_adesao?: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          id?: string
          numero_parcelas?: number
          renovacao_automatica?: boolean
          seguradora?: string
          status?: string
          tem_adesao?: boolean
          tem_parcelamento?: boolean
          updated_at?: string
          valor?: number
          valor_adesao?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: []
      }
      apolices_equipamentos: {
        Row: {
          apolice_id: string
          created_at: string
          equipamento_id: string
          id: string
        }
        Insert: {
          apolice_id: string
          created_at?: string
          equipamento_id: string
          id?: string
        }
        Update: {
          apolice_id?: string
          created_at?: string
          equipamento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_equipamentos_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apolices_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          banco: string
          cnpj_cpf: string | null
          conta: string
          created_at: string
          id: string
          observacoes: string | null
          pix: string | null
          tipo_conta: string
          titular: string
          updated_at: string
        }
        Insert: {
          agencia: string
          banco: string
          cnpj_cpf?: string | null
          conta: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pix?: string | null
          tipo_conta?: string
          titular: string
          updated_at?: string
        }
        Update: {
          agencia?: string
          banco?: string
          cnpj_cpf?: string | null
          conta?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          pix?: string | null
          tipo_conta?: string
          titular?: string
          updated_at?: string
        }
        Relationships: []
      }
      contratos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          dia_medicao_fim: number
          dia_medicao_inicio: number
          empresa_id: string
          equipamento_id: string
          horas_contratadas: number
          id: string
          observacoes: string | null
          prazo_faturamento: number
          status: string
          updated_at: string
          valor_hora: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          dia_medicao_fim?: number
          dia_medicao_inicio?: number
          empresa_id: string
          equipamento_id: string
          horas_contratadas?: number
          id?: string
          observacoes?: string | null
          prazo_faturamento?: number
          status?: string
          updated_at?: string
          valor_hora?: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dia_medicao_fim?: number
          dia_medicao_inicio?: number
          empresa_id?: string
          equipamento_id?: string
          horas_contratadas?: number
          id?: string
          observacoes?: string | null
          prazo_faturamento?: number
          status?: string
          updated_at?: string
          valor_hora?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_aditivos: {
        Row: {
          contrato_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          motivo: string
          numero: number
          observacoes: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          motivo?: string
          numero?: number
          observacoes?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string
          numero?: number
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_equipamentos: {
        Row: {
          contrato_id: string
          created_at: string
          data_devolucao: string | null
          data_entrega: string | null
          equipamento_id: string
          hora_minima: number
          horas_contratadas: number
          id: string
          valor_hora: number
          valor_hora_excedente: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string | null
          equipamento_id: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_devolucao?: string | null
          data_entrega?: string | null
          equipamento_id?: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_equipamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_equipamentos_ajustes: {
        Row: {
          contrato_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          equipamento_id: string
          hora_minima: number
          horas_contratadas: number
          id: string
          motivo: string
          valor_hora: number
          valor_hora_excedente: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          equipamento_id: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          motivo?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          equipamento_id?: string
          hora_minima?: number
          horas_contratadas?: number
          id?: string
          motivo?: string
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_equipamentos_ajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_equipamentos_ajustes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          atividade_principal: string | null
          cnpj: string
          contato: string | null
          created_at: string
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome: string
          nome_fantasia: string | null
          razao_social: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          atividade_principal?: string | null
          cnpj: string
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome: string
          nome_fantasia?: string | null
          razao_social?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          atividade_principal?: string | null
          cnpj?: string
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome?: string
          nome_fantasia?: string | null
          razao_social?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ano: number | null
          created_at: string
          id: string
          modelo: string
          numero_serie: string | null
          observacoes: string | null
          status: string
          tag_placa: string | null
          tipo: string
          updated_at: string
          valor_bem: number | null
        }
        Insert: {
          ano?: number | null
          created_at?: string
          id?: string
          modelo: string
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag_placa?: string | null
          tipo: string
          updated_at?: string
          valor_bem?: number | null
        }
        Update: {
          ano?: number | null
          created_at?: string
          id?: string
          modelo?: string
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag_placa?: string | null
          tipo?: string
          updated_at?: string
          valor_bem?: number | null
        }
        Relationships: []
      }
      faturamento: {
        Row: {
          conta_bancaria_id: string | null
          contrato_id: string
          created_at: string
          emissao: string
          horas_excedentes: number
          horas_normais: number
          id: string
          numero_nota: string | null
          numero_sequencial: number
          periodo: string
          periodo_medicao_fim: string | null
          periodo_medicao_inicio: string | null
          status: string
          total_gastos: number
          valor_excedente_hora: number
          valor_hora: number
          valor_total: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          contrato_id: string
          created_at?: string
          emissao?: string
          horas_excedentes?: number
          horas_normais?: number
          id?: string
          numero_nota?: string | null
          numero_sequencial?: number
          periodo: string
          periodo_medicao_fim?: string | null
          periodo_medicao_inicio?: string | null
          status?: string
          total_gastos?: number
          valor_excedente_hora?: number
          valor_hora?: number
          valor_total?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          contrato_id?: string
          created_at?: string
          emissao?: string
          horas_excedentes?: number
          horas_normais?: number
          id?: string
          numero_nota?: string | null
          numero_sequencial?: number
          periodo?: string
          periodo_medicao_fim?: string | null
          periodo_medicao_inicio?: string | null
          status?: string
          total_gastos?: number
          valor_excedente_hora?: number
          valor_hora?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento_equipamentos: {
        Row: {
          created_at: string
          equipamento_id: string
          faturamento_id: string
          hora_minima: number
          horas_excedentes: number
          horas_medidas: number
          horas_normais: number
          id: string
          primeiro_mes: boolean
          valor_hora: number
          valor_hora_excedente: number
        }
        Insert: {
          created_at?: string
          equipamento_id: string
          faturamento_id: string
          hora_minima?: number
          horas_excedentes?: number
          horas_medidas?: number
          horas_normais?: number
          id?: string
          primeiro_mes?: boolean
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Update: {
          created_at?: string
          equipamento_id?: string
          faturamento_id?: string
          hora_minima?: number
          horas_excedentes?: number
          horas_medidas?: number
          horas_normais?: number
          id?: string
          primeiro_mes?: boolean
          valor_hora?: number
          valor_hora_excedente?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_equipamentos_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamento"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamento_gastos: {
        Row: {
          created_at: string
          faturamento_id: string
          gasto_id: string
          id: string
        }
        Insert: {
          created_at?: string
          faturamento_id: string
          gasto_id: string
          id?: string
        }
        Update: {
          created_at?: string
          faturamento_id?: string
          gasto_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturamento_gastos_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamento_gastos_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          created_at: string
          data: string
          descricao: string
          equipamento_id: string
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          equipamento_id: string
          id?: string
          tipo?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          equipamento_id?: string
          id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "gastos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          created_at: string
          data: string
          equipamento_id: string
          horas_trabalhadas: number | null
          horimetro_final: number
          horimetro_inicial: number
          id: string
        }
        Insert: {
          created_at?: string
          data?: string
          equipamento_id: string
          horas_trabalhadas?: number | null
          horimetro_final?: number
          horimetro_inicial?: number
          id?: string
        }
        Update: {
          created_at?: string
          data?: string
          equipamento_id?: string
          horas_trabalhadas?: number | null
          horimetro_final?: number
          horimetro_inicial?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      propostas: {
        Row: {
          analise_cadastral_texto: string | null
          consultor_email: string
          consultor_email_2: string | null
          consultor_nome: string
          consultor_nome_2: string | null
          consultor_telefone: string
          consultor_telefone_2: string | null
          conta_bancaria_id: string | null
          created_at: string
          created_by: string | null
          data: string
          disponibilidade_texto: string | null
          empresa_id: string
          franquia_horas_texto: string | null
          horas_excedentes_texto: string | null
          id: string
          numero_sequencial: number
          observacoes: string | null
          prazo_pagamento: number
          seguro_texto: string | null
          status: string
          updated_at: string
          validade_dias: number
          valor_mobilizacao: number
          valor_mobilizacao_texto: string
        }
        Insert: {
          analise_cadastral_texto?: string | null
          consultor_email?: string
          consultor_email_2?: string | null
          consultor_nome?: string
          consultor_nome_2?: string | null
          consultor_telefone?: string
          consultor_telefone_2?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          disponibilidade_texto?: string | null
          empresa_id: string
          franquia_horas_texto?: string | null
          horas_excedentes_texto?: string | null
          id?: string
          numero_sequencial?: number
          observacoes?: string | null
          prazo_pagamento?: number
          seguro_texto?: string | null
          status?: string
          updated_at?: string
          validade_dias?: number
          valor_mobilizacao?: number
          valor_mobilizacao_texto?: string
        }
        Update: {
          analise_cadastral_texto?: string | null
          consultor_email?: string
          consultor_email_2?: string | null
          consultor_nome?: string
          consultor_nome_2?: string | null
          consultor_telefone?: string
          consultor_telefone_2?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          disponibilidade_texto?: string | null
          empresa_id?: string
          franquia_horas_texto?: string | null
          horas_excedentes_texto?: string | null
          id?: string
          numero_sequencial?: number
          observacoes?: string | null
          prazo_pagamento?: number
          seguro_texto?: string | null
          status?: string
          updated_at?: string
          validade_dias?: number
          valor_mobilizacao?: number
          valor_mobilizacao_texto?: string
        }
        Relationships: []
      }
      propostas_equipamentos: {
        Row: {
          created_at: string
          equipamento_tipo: string
          franquia_mensal: number
          id: string
          proposta_id: string
          quantidade: number
          valor_hora: number
        }
        Insert: {
          created_at?: string
          equipamento_tipo?: string
          franquia_mensal?: number
          id?: string
          proposta_id: string
          quantidade?: number
          valor_hora?: number
        }
        Update: {
          created_at?: string
          equipamento_tipo?: string
          franquia_mensal?: number
          id?: string
          proposta_id?: string
          quantidade?: number
          valor_hora?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_equipamentos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_responsabilidades: {
        Row: {
          atividade: string
          created_at: string
          id: string
          proposta_id: string
          responsavel_busato: boolean
          responsavel_cliente: boolean
        }
        Insert: {
          atividade: string
          created_at?: string
          id?: string
          proposta_id: string
          responsavel_busato?: boolean
          responsavel_cliente?: boolean
        }
        Update: {
          atividade?: string
          created_at?: string
          id?: string
          proposta_id?: string
          responsavel_busato?: boolean
          responsavel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "propostas_responsabilidades_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sinistros: {
        Row: {
          apolice_id: string
          created_at: string
          data_previsao_retorno: string | null
          data_retorno: string | null
          data_sinistro: string
          equipamento_id: string
          franquia: number
          id: string
          observacoes: string | null
          status: string
          tipo_sinistro: string
          updated_at: string
        }
        Insert: {
          apolice_id: string
          created_at?: string
          data_previsao_retorno?: string | null
          data_retorno?: string | null
          data_sinistro?: string
          equipamento_id: string
          franquia?: number
          id?: string
          observacoes?: string | null
          status?: string
          tipo_sinistro?: string
          updated_at?: string
        }
        Update: {
          apolice_id?: string
          created_at?: string
          data_previsao_retorno?: string | null
          data_retorno?: string | null
          data_sinistro?: string
          equipamento_id?: string
          franquia?: number
          id?: string
          observacoes?: string | null
          status?: string
          tipo_sinistro?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_apolice_id_fkey"
            columns: ["apolice_id"]
            isOneToOne: false
            referencedRelation: "apolices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_user_ids: { Args: never; Returns: string[] }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "visualizador"
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
    Enums: {
      app_role: ["admin", "operador", "visualizador"],
    },
  },
} as const
