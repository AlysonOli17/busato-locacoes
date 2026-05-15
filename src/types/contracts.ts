export interface Empresa { id: string; nome: string; cnpj: string; razao_social: string; nome_fantasia: string; inscricao_estadual: string; inscricao_municipal: string; endereco_logradouro: string; endereco_numero: string; endereco_complemento: string; endereco_bairro: string; endereco_cidade: string; endereco_uf: string; endereco_cep: string; contato: string | null; telefone: string | null; email: string; atividade_principal: string; }
export interface Equipamento { id: string; tipo: string; modelo: string; tag_placa: string | null; numero_serie: string | null; }
export interface ContratoEquipamento { id: string; equipamento_id: string; valor_hora: number; horas_contratadas: number; valor_hora_excedente: number; hora_minima: number; data_entrega: string | null; data_devolucao: string | null; equipamentos: Equipamento; }
export interface Contrato {
  id: string;
  empresa_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  observacoes: string | null;
  status: string;
  empresas: Empresa;
  equipamentos: Equipamento;
  contratos_equipamentos?: ContratoEquipamento[];
}
export interface FormEquipItem {
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  valor_hora_excedente: number;
  hora_minima: number;
  data_entrega: string;
  data_devolucao: string;
}
export interface EquipUsage {
  equipamento_id: string;
  equipamento: Equipamento;
  valor_hora: number;
  horas_contratadas: number;
  horas_utilizadas: number;
  custo_real: number;
  custo_contratado: number;
  percentual: number;
  origem: string;
}
export interface AjusteTemporario {
  id: string;
  contrato_id: string;
  equipamento_id: string;
  valor_hora: number;
  valor_hora_excedente: number;
  hora_minima: number;
  horas_contratadas: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  created_at: string;
  desconto_percentual: number;
}
export interface Aditivo {
  id: string;
  contrato_id: string;
  numero: number;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  observacoes: string;
  created_at: string;
  aditivos_equipamentos?: AditivoEquipamento[];
}
export interface AditivoEquipamento {
  id: string;
  aditivo_id: string;
  equipamento_id: string;
  valor_hora: number;
  horas_contratadas: number;
  valor_hora_excedente: number;
  hora_minima: number;
  data_entrega: string | null;
  data_devolucao: string | null;
}
