<p align="center">
  <img src="public/app-icon.svg" width="128" height="128" alt="MyWalletB3 Logo" />
</p>

<h1 align="center">MyWalletB3</h1>

<p align="center">
  <strong>Aplicativo Desktop de Gestão de Carteira de Investimentos, Preço Médio e Fiscal B3</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite" alt="Vite 6" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Package%20Manager-Bun-f472b6?logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/Database-SQLite%20Local-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

O **MyWalletB3** é um aplicativo desktop completo para acompanhamento de investimentos no mercado financeiro brasileiro (B3). Focado em **privacidade absoluta**, o aplicativo armazena todos os seus dados em um banco de dados SQLite local no seu próprio computador — **sem assinaturas, sem intermediários e sem envio de informações patrimoniais para servidores de terceiros**.

---

## 🚀 Principais Funcionalidades

- 📈 **Gestão de Carteira Consolidada:** Posição atual de Ações, FIIs, FI-Infra, BDRs e Opções, com quantidade, Preço Médio (PM), valor investido e valor de mercado atualizado.
- ⚡ **Cotações ao Vivo da B3:** Cotações atualizadas em tempo real via Yahoo Finance e brapi.dev com estratégia inteligente de failover e tolerância a falhas.
- 📊 **Gráficos Interativos de Alocação:** Visualização comparativa de valor investido vs. valor atual de mercado com rolagem horizontal e destaques por classe de ativo.
- 🔄 **Compras e Vendas:** Acompanhamento de operações realizadas, apuração de lucro/prejuízo em vendas parciais ou totais e cálculo de preço médio de compra ponderado.
- 💵 **Proventos & Rendimentos:** Controle automático de Dividendos, Juros sobre Capital Próprio (JCP) e Rendimentos de Fundos Imobiliários recebidos no ano/mês.
- 📅 **Calendário Diário de Trades:** Visualização em calendário destacando dias apenas com compras (azul), dias de lucro realizado (verde) e dias com prejuízo (vermelho).
- 📑 **Extrato Unificado:** Histórico detalhado de todas as operações e movimentações importadas com paginação contínua e filtros.
- 🛡️ **Reconciliação e Correções de Custódia:**
  - Comparação automática entre os dados do app e a custódia oficial da B3.
  - Detecção inteligente de desdobramentos de ações/cotas.
  - Tratamento de opções expiradas a pó sem distorção fiscal.
  - Assistente de conversão/incorporação de tickers (ex: `IRDM11` → `IRIM11`).
  - Histórico de correções aplicadas com suporte a **Rollback (Desfazer)**.
- 🧮 **Calculadora Fiscal & DARF:**
  - Regra de isenção de R$ 20.000/mês para vendas de ações comuns.
  - Alíquotas oficiais: 15% para Swing Trade, 20% para Day Trade, FIIs e Units.
  - Compensação automática de prejuízos acumulados de meses anteriores.
  - Resumo pronto para preenchimento de DARF mensal.
- 📋 **Informe IRPF Anual:** Dados consolidados em 31/12 para preenchimento fácil da ficha de **Bens e Direitos**, **Rendimentos Isentos** e **Rendimentos Sujeitos à Tributação Exclusiva**.
- 💾 **Backup & Dados:** Exportação e restauração atômica do banco de dados em formato JSON com validação estrita de integridade.

---

## 📖 Como Usar o MyWalletB3

### 1. Exportando os Dados da B3

O MyWalletB3 foi construído para ler os arquivos oficiais disponibilizados pela própria B3 (Bolsa de Valores do Brasil):

1. Acesse o **Portal da Área do Investidor**: [https://investidor.b3.com.br](https://investidor.b3.com.br/)
2. No menu principal, vá em **Extratos e Informativos**:
   - **Negociação:** Selecione o período desejado e clique no botão **Exportar (.xlsx)** para obter o extrato de compras e vendas.
   - **Movimentação:** Para obter dividendos, proventos e juros sobre capital próprio, exporte o extrato de movimentações em Excel (.xlsx).
   - **Posição:** Para conferir e conciliar sua custódia atual na aba de Correções, exporte a planilha de posição.

### 2. Importando no Aplicativo

1. Abra o **MyWalletB3**.
2. No canto superior direito, clique no botão **Importar Planilha B3** (ou arraste seus arquivos para o app).
3. Selecione um ou mais arquivos `.xlsx` exportados da B3.
4. O aplicativo detecta automaticamente o formato (Negociação, Movimentação ou Posição) e processa os dados de forma rápida e segura.

---

## 🖥️ Visão Geral das Abas

| Aba                  | Descrição                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carteira**         | Posição consolidada por ativo, preço médio, cotação atual, patrimônio total e gráfico de alocação por ativo e categoria.                                                                           |
| **Compras e Vendas** | Histórico consolidado de compras e vendas por ativo, preço médio de aquisição e apuração de resultados realizados.                                                                                 |
| **Proventos**        | Extrato completo de dividendos, JCP e rendimentos recebidos, com totais por tipo e agrupamento mensal.                                                                                             |
| **Extrato**          | Histórico cronológico de todas as operações e movimentações importadas com paginação e busca por ticker.                                                                                           |
| **Correções**        | Painel de auditoria que compara a custódia do app com a planilha de posição da B3, identifica desdobramentos, opções vencidas a pó, conversões de ticker e permite desfazer alterações (rollback). |
| **Calculadora DARF** | Apuração mensal do imposto de renda sobre ganhos líquidos em renda variável, controle de isenção de 20k em ações e compensação de prejuízos.                                                       |
| **Informe IRPF**     | Tabela detalhada de posições e rendimentos em 31 de dezembro com códigos da Receita Federal prontos para a Declaração Anual.                                                                       |
| **Backup & Dados**   | Exportação de cópia de segurança de todos os registros em arquivo JSON e restauração atômica.                                                                                                      |

---

## 🛠️ Tecnologias e Arquitetura

O projeto adota os princípios de **Clean Architecture**, garantindo que as regras de negócio de domínio financeiro sejam isoladas de bibliotecas e interfaces gráficas:

```
src/
├── core/                # Regras de negócio puras (sem dependência de UI ou IO)
│   ├── entities/        # Asset, Operation, Movement, ConsolidatedPosition, Darf
│   ├── repositories/    # Interfaces (IOperationRepository, IAssetRepository, IMovementRepository)
│   ├── services/        # Calculadoras fiscais, parsers B3, cotações ao vivo, reconciliação
│   └── controllers/     # DashboardController
├── infrastructure/      # Adaptadores e banco de dados SQLite (@tauri-apps/plugin-sql)
├── ui/                  # Interface pura com Vanilla TypeScript, CSS moderno e SVG
│   ├── components/      # Botões, Cards, Gráficos SVG, Ícones e TabBar
│   ├── utils/           # Sanitização XSS e utilitários
│   └── views/           # Views das abas do painel
└── tests/               # 85+ testes unitários cobrindo cálculos fiscais, parsers e regras de negócio
```

---

## 💻 Instalação e Execução Local

### Pré-requisitos

- [Bun](https://bun.sh/) (v1.1 ou superior)
- [Rust & Cargo](https://rustup.rs/) (para compilação do backend Tauri desktop)
- Dependências nativas de sistema para Tauri v2 no Linux:
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Passos para rodar o projeto

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/glaulher/MyWalletB3.git
   cd MyWalletB3
   ```

2. **Instale as dependências:**

   ```bash
   bun install
   ```

3. **Inicie o ambiente de desenvolvimento:**
   - Para rodar apenas o frontend no navegador (porta `1420`):
     ```bash
     bun dev
     ```
   - Para rodar a aplicação desktop completa com Tauri v2:
     ```bash
     bun run tauri dev
     ```

4. **Gerar executável / instalador de produção:**
   ```bash
   bun run tauri build
   ```
   Os instaladores serão gerados na pasta `src-tauri/target/release/bundle/`.

---

## 🧪 Testes e Qualidade de Código

O projeto conta com mais de 85 testes automatizados cobrindo regras críticas do mercado de capitais brasileiro:

```bash
# Executar todos os testes unitários
bun test

# Verificar tipos TypeScript
bunx tsc --noEmit

# Verificar formatação com Prettier
bunx prettier --check src/

# Formatar o código
bunx prettier --write src/
```

---

## 🔒 Privacidade e Segurança

- **100% Local:** Suas notas e movimentações financeiras são processadas no seu próprio computador.
- **Sem Telemetria:** O aplicativo não coleta dados de uso, carteira ou identidade.
- **Cotações Públicas:** As requisições de cotação consultam apenas os códigos públicos dos ativos (tickers da B3) para atualizar preços de mercado.

---

## 📄 Licença

Este projeto é distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.
