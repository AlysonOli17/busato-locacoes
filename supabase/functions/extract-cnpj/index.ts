import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64 } = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um extrator de dados de Cartão CNPJ brasileiro. Analise a imagem e extraia os dados em JSON com exatamente estes campos (strings, sem formatação de CNPJ/CEP/telefone, apenas dígitos para campos numéricos):
{
  "cnpj": "somente dígitos, 14 chars",
  "razao_social": "",
  "nome_fantasia": "",
  "atividade_principal": "descrição da atividade principal",
  "inscricao_estadual": "",
  "inscricao_municipal": "",
  "endereco_logradouro": "",
  "endereco_numero": "",
  "endereco_complemento": "",
  "endereco_bairro": "",
  "endereco_cidade": "",
  "endereco_uf": "sigla de 2 letras",
  "endereco_cep": "somente dígitos, 8 chars",
  "email": "",
  "telefone": "somente dígitos"
}
Retorne APENAS o JSON, sem markdown, sem explicações. Se um campo não for encontrado, retorne string vazia.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${image_base64}`,
                },
              },
              {
                type: "text",
                text: "Extraia os dados deste Cartão CNPJ.",
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response, handling possible markdown wrapping
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const extracted = JSON.parse(jsonStr);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
