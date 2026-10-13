import React, { useState, useEffect } from "react";
import type { Relequip, RelequipInsert } from "@/lib/relequip/types";
import {
  SITUACOES,
  SITUACOES_CADASTRO,
  TIPOS_FROTA,
  OPCOES_MEV,
  UFS,
} from "@/lib/relequip/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck, Check, Loader2 } from "lucide-react";

interface RelequipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro?: Relequip | null;
  onSalvar: (dados: Partial<RelequipInsert>) => Promise<void>;
}

export const RelequipFormDialog: React.FC<RelequipFormDialogProps> = ({
  open,
  onOpenChange,
  registro,
  onSalvar,
}) => {
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState<Partial<RelequipInsert>>({});

  useEffect(() => {
    if (registro) {
      setFormData({
        te_tag: registro.te_tag,
        placa: registro.placa,
        tag: registro.tag,
        te: registro.te,
        grupo: (registro.grupo as any) || "frota",
        centro_custo: registro.centro_custo,
        gestor: registro.gestor,
        mev: registro.mev,
        situacao: registro.situacao,
        situacao_cadastro: registro.situacao_cadastro,
        frota: registro.frota,
        tipo_implemento: registro.tipo_implemento,
        modelo: registro.modelo,
        descricao: registro.descricao,
        fabricante: registro.fabricante,
        capacidade: registro.capacidade,
        peso_operacional: registro.peso_operacional,
        ano_fabricacao: registro.ano_fabricacao,
        ano_modelo: registro.ano_modelo,
        combustivel: registro.combustivel,
        cor: registro.cor,
        estado: registro.estado,
        chassi_serie: registro.chassi_serie,
        renavam: registro.renavam,
        nota_fiscal: registro.nota_fiscal,
        data_compra: registro.data_compra,
        garantia_fabrica: registro.garantia_fabrica,
        comprador: registro.comprador,
        comprado_de: registro.comprado_de,
        data_venda: registro.data_venda,
        vendido_para: registro.vendido_para,
        observacao: registro.observacao,
        observacao_baixa: registro.observacao_baixa,
        custo_recuperacao: registro.custo_recuperacao,
        custo_recuperacao_obs: registro.custo_recuperacao_obs,
        tempo_parado: registro.tempo_parado,
        observacao_venda: registro.observacao_venda,
      });
    } else {
      setFormData({
        grupo: "frota",
        situacao: "Atuando",
        situacao_cadastro: "Ativo",
        frota: "Próprio",
        mev: "Não",
        estado: "ES",
      });
    }
  }, [registro, open]);

  const handleChange = (campo: keyof RelequipInsert, valor: any) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.te_tag?.trim()) {
      alert("O campo TE + TAG é obrigatório.");
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(formData);
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {registro ? `Editar Equipamento — ${registro.te_tag}` : "Novo Equipamento (RELEQUIP)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="identificacao" className="text-xs">Identificação</TabsTrigger>
              <TabsTrigger value="operacao" className="text-xs">Operação</TabsTrigger>
              <TabsTrigger value="especificacoes" className="text-xs">Especificações</TabsTrigger>
              <TabsTrigger value="venda" className="text-xs">Venda & Baixa</TabsTrigger>
            </TabsList>

            {/* Aba 1: Identificação */}
            <TabsContent value="identificacao" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">TE + TAG *</Label>
                  <Input
                    required
                    placeholder="Ex: PC-105, CB-630"
                    value={formData.te_tag || ""}
                    onChange={(e) => handleChange("te_tag", e.target.value.toUpperCase())}
                    disabled={!!registro}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Placa</Label>
                  <Input
                    placeholder="Ex: PPG9605 (ou N/A)"
                    value={formData.placa || ""}
                    onChange={(e) => handleChange("placa", e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TAG</Label>
                  <Input
                    placeholder="Ex: 105"
                    value={formData.tag || ""}
                    onChange={(e) => handleChange("tag", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo da Frota</Label>
                  <Select
                    value={formData.frota || "Próprio"}
                    onValueChange={(v) => handleChange("frota", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_FROTA.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Situação Cadastral</Label>
                  <Select
                    value={formData.situacao_cadastro || "Ativo"}
                    onValueChange={(v) => handleChange("situacao_cadastro", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SITUACOES_CADASTRO.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grupo</Label>
                  <Select
                    value={formData.grupo || "frota"}
                    onValueChange={(v) => handleChange("grupo", v as any)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frota">Frota Ativa</SelectItem>
                      <SelectItem value="baixado">Baixado / Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Aba 2: Operação */}
            <TabsContent value="operacao" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Situação Operacional</Label>
                  <Select
                    value={formData.situacao || "Atuando"}
                    onValueChange={(v) => handleChange("situacao", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SITUACOES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Centro de Custo</Label>
                  <Input
                    placeholder="Ex: BASE (ES), USINA (ES)"
                    value={formData.centro_custo || ""}
                    onChange={(e) => handleChange("centro_custo", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Gestor</Label>
                  <Input
                    placeholder="Ex: Alyson Oliveira"
                    value={formData.gestor || ""}
                    onChange={(e) => handleChange("gestor", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MEV</Label>
                  <Select
                    value={formData.mev || "Não"}
                    onValueChange={(v) => handleChange("mev", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPCOES_MEV.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado (UF)</Label>
                  <Select
                    value={formData.estado || "ES"}
                    onValueChange={(v) => handleChange("estado", v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Localidade</Label>
                  <Input
                    placeholder="Ex: Vitória - Tubarão"
                    value={formData.localidade || ""}
                    onChange={(e) => handleChange("localidade", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs">Observação / Inventário</Label>
                <Textarea
                  rows={3}
                  placeholder="Observações operacionais ou de pátio..."
                  value={formData.observacao || ""}
                  onChange={(e) => handleChange("observacao", e.target.value)}
                />
              </div>
            </TabsContent>

            {/* Aba 3: Especificações */}
            <TabsContent value="especificacoes" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Implemento</Label>
                  <Input
                    placeholder="Ex: Pá Carregadeira, Basculante"
                    value={formData.tipo_implemento || ""}
                    onChange={(e) => handleChange("tipo_implemento", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fabricante</Label>
                  <Input
                    placeholder="Ex: Caterpillar, Mercedes-Benz"
                    value={formData.fabricante || ""}
                    onChange={(e) => handleChange("fabricante", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modelo</Label>
                  <Input
                    placeholder="Ex: 962 H, Axor 4144"
                    value={formData.modelo || ""}
                    onChange={(e) => handleChange("modelo", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano Fabricação</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 2018"
                    value={formData.ano_fabricacao ?? ""}
                    onChange={(e) => handleChange("ano_fabricacao", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano Modelo</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 2019"
                    value={formData.ano_modelo ?? ""}
                    onChange={(e) => handleChange("ano_modelo", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Combustível</Label>
                  <Input
                    placeholder="Diesel, Flex, GLP..."
                    value={formData.combustivel || ""}
                    onChange={(e) => handleChange("combustivel", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Chassi ou Série</Label>
                  <Input
                    placeholder="Número de chassi..."
                    value={formData.chassi_serie || ""}
                    onChange={(e) => handleChange("chassi_serie", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Renavam</Label>
                  <Input
                    placeholder="Renavam..."
                    value={formData.renavam || ""}
                    onChange={(e) => handleChange("renavam", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cor</Label>
                  <Input
                    placeholder="Amarelo, Branco, Vermelho..."
                    value={formData.cor || ""}
                    onChange={(e) => handleChange("cor", e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Aba 4: Venda & Baixa */}
            <TabsContent value="venda" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tempo Parado</Label>
                  <Input
                    placeholder="Ex: 1 ANO (+), 60 DIAS, ATUANDO"
                    value={formData.tempo_parado || ""}
                    onChange={(e) => handleChange("tempo_parado", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custo Recuperação (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 16000"
                    value={formData.custo_recuperacao ?? ""}
                    onChange={(e) => handleChange("custo_recuperacao", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status do Orçamento</Label>
                  <Input
                    placeholder="Ex: ORÇANDO, AVALIAR"
                    value={formData.custo_recuperacao_obs || ""}
                    onChange={(e) => handleChange("custo_recuperacao_obs", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data da Venda/Baixa</Label>
                  <Input
                    type="date"
                    value={formData.data_venda || ""}
                    onChange={(e) => handleChange("data_venda", e.target.value)}
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Vendido para / Destino</Label>
                  <Input
                    placeholder="Nome do comprador ou empresa"
                    value={formData.vendido_para || ""}
                    onChange={(e) => handleChange("vendido_para", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs">Observação Técnica de Venda</Label>
                <Textarea
                  rows={2}
                  placeholder="Diagnóstico técnico, peças necessárias ou motivo da venda..."
                  value={formData.observacao_venda || ""}
                  onChange={(e) => handleChange("observacao_venda", e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
