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
      apolices: {
        Row: {
          created_at: string
          equipamento_id: string
          id: string
          numero_apolice: string
          seguradora: string
          status: string
          updated_at: string
          valor: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          equipamento_id: string
          id?: string
          numero_apolice: string
          seguradora: string
          status?: string
          updated_at?: string
          valor?: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          equipamento_id?: string
          id?: string
          numero_apolice?: string
          seguradora?: string
          status?: string
          updated_at?: string
          valor?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "apolices_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          equipamento_id: string
          horas_contratadas: number
          id: string
          observacoes: string | null
          status: string
          updated_at: string
          valor_hora: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          empresa_id: string
          equipamento_id: string
          horas_contratadas?: number
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_hora?: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          empresa_id?: string
          equipamento_id?: string
          horas_contratadas?: number
          id?: string
          observacoes?: string | null
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
      contratos_equipamentos: {
        Row: {
          contrato_id: string
          created_at: string
          equipamento_id: string
          horas_contratadas: number
          id: string
          valor_hora: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          equipamento_id: string
          horas_contratadas?: number
          id?: string
          valor_hora?: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          equipamento_id?: string
          horas_contratadas?: number
          id?: string
          valor_hora?: number
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
          created_at: string
          id: string
          modelo: string
          numero_serie: string | null
          observacoes: string | null
          status: string
          tag_placa: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          modelo: string
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag_placa?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          modelo?: string
          numero_serie?: string | null
          observacoes?: string | null
          status?: string
          tag_placa?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      faturamento: {
        Row: {
          contrato_id: string
          created_at: string
          emissao: string
          horas_excedentes: number
          horas_normais: number
          id: string
          numero_nota: string | null
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
          contrato_id: string
          created_at?: string
          emissao?: string
          horas_excedentes?: number
          horas_normais?: number
          id?: string
          numero_nota?: string | null
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
          contrato_id?: string
          created_at?: string
          emissao?: string
          horas_excedentes?: number
          horas_normais?: number
          id?: string
          numero_nota?: string | null
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
            foreignKeyName: "faturamento_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
