import { DPO_CONTACT, PRIVACY_POLICY_UPDATED_AT, PRIVACY_POLICY_VERSION } from "@/lib/security/lgpd";

const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{n}</span>
      {title}
    </h3>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2 pl-8">{children}</div>
  </section>
);

export const PrivacyPolicyContent = () => (
  <article className="space-y-6">
    <header>
      <h2 className="text-xl font-bold text-foreground">Política de Privacidade e Proteção de Dados</h2>
      <p className="text-xs text-muted-foreground mt-1">
        Versão {PRIVACY_POLICY_VERSION} • Atualizada em {PRIVACY_POLICY_UPDATED_AT} • Lei nº 13.709/2018 (LGPD)
      </p>
    </header>

    <Section n={1} title="Quem é o controlador">
      <p>
        A <strong>Busato Locações</strong> é a controladora dos dados pessoais tratados neste sistema, utilizado para
        gestão de frota, contratos, medições, faturamento, seguros e recursos humanos.
      </p>
    </Section>

    <Section n={2} title="Quais dados tratamos">
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Usuários do sistema:</strong> nome, e-mail, perfil de acesso, registros de login e atividades.</li>
        <li><strong>Contatos de clientes e fornecedores:</strong> nome, cargo, e-mail e telefone de representantes.</li>
        <li><strong>Colaboradores:</strong> nome, cargo, setor, data de admissão, contato, avaliações de desempenho e perfil comportamental (DISC).</li>
        <li><strong>Dados técnicos:</strong> navegador, dispositivo e endereço IP (armazenado criptografado) no momento do aceite.</li>
        <li><strong>Biometria:</strong> <u>não armazenamos</u> digitais ou imagens faciais. A biometria é verificada no próprio aparelho; guardamos apenas uma chave pública criptográfica.</li>
      </ul>
    </Section>

    <Section n={3} title="Finalidades e bases legais (Art. 7º)">
      <ul className="list-disc pl-4 space-y-1">
        <li><strong>Execução de contrato</strong> (VII, V): gestão de locações, medições e faturamento.</li>
        <li><strong>Obrigação legal/regulatória</strong> (II): guarda de documentos fiscais e contábeis.</li>
        <li><strong>Legítimo interesse</strong> (IX): segurança da informação, auditoria e prevenção a fraudes.</li>
        <li><strong>Consentimento</strong> (I): uso de biometria para desbloqueio e testes comportamentais.</li>
      </ul>
    </Section>

    <Section n={4} title="Como protegemos seus dados (Art. 46)">
      <ul className="list-disc pl-4 space-y-1">
        <li>Criptografia em trânsito (HTTPS/TLS 1.2+) e em repouso (AES-256).</li>
        <li>Criptografia adicional de campos sensíveis com chave em cofre (Supabase Vault).</li>
        <li>Controle de acesso por perfil e políticas de segurança por linha (RLS) no banco de dados.</li>
        <li>Autenticação biométrica (WebAuthn/Passkeys), 2º fator (TOTP) e bloqueio automático por inatividade.</li>
        <li>Registro imutável de auditoria das operações realizadas.</li>
      </ul>
    </Section>

    <Section n={5} title="Compartilhamento">
      <p>
        Os dados são processados por operadores contratados para hospedagem e infraestrutura (Supabase e Vercel), que
        podem armazenar dados fora do Brasil com garantias adequadas (Art. 33). Não vendemos dados pessoais. O
        compartilhamento com autoridades ocorre somente por obrigação legal.
      </p>
    </Section>

    <Section n={6} title="Por quanto tempo guardamos (Art. 15 e 16)">
      <ul className="list-disc pl-4 space-y-1">
        <li>Documentos fiscais e contratuais: pelo prazo legal (em regra, 5 anos).</li>
        <li>Dados de ex-colaboradores: anonimizados após o prazo de retenção definido.</li>
        <li>Contas de usuário excluídas: anonimizadas, preservando apenas o necessário para obrigações legais.</li>
      </ul>
    </Section>

    <Section n={7} title="Seus direitos (Art. 18)">
      <p>
        Você pode, a qualquer momento: confirmar a existência de tratamento, acessar, corrigir, solicitar
        anonimização ou eliminação, solicitar portabilidade, obter informações sobre compartilhamento e revogar
        consentimento. Use a área <strong>Privacidade &amp; Segurança → Meus Dados</strong> ou o contato abaixo.
        Respondemos em até 15 dias.
      </p>
    </Section>

    <Section n={8} title="Encarregado (DPO) e incidentes">
      <p>
        {DPO_CONTACT.nome} — <a className="text-primary underline" href={`mailto:${DPO_CONTACT.email}`}>{DPO_CONTACT.email}</a>.
        Em caso de incidente de segurança com risco relevante, os titulares e a ANPD serão comunicados (Art. 48).
      </p>
    </Section>
  </article>
);

export const TermsContent = () => (
  <article className="space-y-6">
    <header>
      <h2 className="text-xl font-bold text-foreground">Termos de Uso e Responsabilidade</h2>
      <p className="text-xs text-muted-foreground mt-1">Versão {PRIVACY_POLICY_VERSION}</p>
    </header>
    <Section n={1} title="Acesso pessoal e intransferível">
      <p>O login, a senha e a biometria cadastrada são pessoais. É proibido compartilhar credenciais.</p>
    </Section>
    <Section n={2} title="Uso adequado das informações">
      <p>
        Os dados acessados no sistema devem ser usados exclusivamente para as atividades profissionais da Busato
        Locações. Exportações (PDF/Excel) devem ser armazenadas em local seguro e descartadas quando não forem mais
        necessárias.
      </p>
    </Section>
    <Section n={3} title="Monitoramento">
      <p>As ações realizadas são registradas para fins de segurança e auditoria (legítimo interesse).</p>
    </Section>
    <Section n={4} title="Incidentes">
      <p>Qualquer suspeita de acesso indevido deve ser comunicada imediatamente ao administrador ou ao DPO.</p>
    </Section>
  </article>
);
