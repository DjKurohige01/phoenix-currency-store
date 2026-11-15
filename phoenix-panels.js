/**
 * ============================================================================
 * PHOENIX STORE — INTERFACE DE USUÁRIO, PAINÉIS (CLIENTE / VENDEDOR / ADMIN),
 *                 PONTE DE PAGAMENTO E CHAT AO VIVO INTEGRADO
 * ============================================================================
 */

(function () {
  const PB = window.PhoenixBackend;
  if (!PB) return;

  function formatBRL(value) {
    return (Number(value) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDateTime(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  function getStatusMeta(status) {
    const map = {
      awaiting_payment: {
        label: "Aguardando Pagamento",
        cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      },
      paid_waiting_seller: {
        label: "Pago • Na Fila de Entrega",
        cls: "border-primary/50 bg-primary/15 text-primary",
      },
      seller_assigned: {
        label: "Vendedor Separando",
        cls: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
      },
      in_hideout: {
        label: "No Hideout (Party Enviada)",
        cls: "border-purple-500/40 bg-purple-500/15 text-purple-300",
      },
      delivered: {
        label: "Entregue ✓",
        cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
      },
      cancelled: {
        label: "Cancelado",
        cls: "border-red-500/40 bg-red-500/10 text-red-300",
      },
    };
    return map[status] || map.paid_waiting_seller;
  }

  // Estado local dos painéis e modais
  const uiState = {
    activeDashboardTab: "orders", // 'orders' | 'catalog' | 'my_sales' | 'admin_finance' | 'admin_users' | 'admin_settings'
    selectedChatOrderCode: "PHX-9041",
    authTab: "login", // 'login' | 'register'
    pendingCheckoutPayload: null,
  };

  function injectUIContainers() {
    // 1. Barra Superior de Demonstração / Troca Rápida entre os 3 Perfis
    const roleSwitcherBar = document.createElement("div");
    roleSwitcherBar.id = "phoenix-role-switcher-bar";
    roleSwitcherBar.className =
      "border-b border-border bg-black/90 px-4 py-2 text-xs text-white backdrop-blur";
    document.body.prepend(roleSwitcherBar);

    // 2. Container Global de Modais e Painéis (Auth, Pagamento, Painel Vendedor/Admin, Chat)
    const modalsRoot = document.createElement("div");
    modalsRoot.id = "phoenix-modals-root";
    document.body.appendChild(modalsRoot);

    renderRoleSwitcherBar();
    renderHeaderUserArea();
    renderModalsStructure();
  }

  // ==========================================================================
  // 1. BARRA SUPERIOR DE PERFIS (1 CLIQUE PARA TESTAR CLIENTE, VENDEDOR E ADMIN)
  // ==========================================================================
  function renderRoleSwitcherBar() {
    const bar = document.getElementById("phoenix-role-switcher-bar");
    if (!bar) return;
    const user = PB.getCurrentUser();
    const role = user ? user.role : "client";
    const sbConfig = PB.getSupabaseConfig();

    const queueOrders = PB.getVisibleOrdersForCurrentUser().filter(
      (o) => o.deliveryStatus === "paid_waiting_seller"
    );

    bar.innerHTML = `
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
            <i data-lucide="shield-check" class="h-3 w-3"></i>
            Sistema 3 Perfis + RLS
          </span>
          <span class="text-muted-foreground hidden sm:inline">Testar visão como:</span>
          <div class="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              data-switch-role="client"
              class="rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                role === "client"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-white"
              }"
            >
              👤 Cliente
            </button>
            <button
              type="button"
              data-switch-role="seller"
              class="rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                role === "seller"
                  ? "bg-emerald-500 text-black shadow"
                  : "text-muted-foreground hover:text-white"
              }"
            >
              🛠️ Vendedor ${
                queueOrders.length > 0
                  ? `<span class="ml-1 rounded-full bg-black/80 px-1.5 py-0.2 text-[10px] text-emerald-400">${queueOrders.length}</span>`
                  : ""
              }
            </button>
            <button
              type="button"
              data-switch-role="admin"
              class="rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                role === "admin"
                  ? "bg-amber-500 text-black shadow"
                  : "text-muted-foreground hover:text-white"
              }"
            >
              👑 Administrador
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          ${
            role === "seller" || role === "admin"
              ? `
              <button
                type="button"
                id="top-open-dashboard-btn"
                class="inline-flex items-center gap-1.5 rounded-lg border ${
                  role === "admin"
                    ? "border-amber-400/60 bg-amber-500/20 text-amber-300"
                    : "border-emerald-400/60 bg-emerald-500/20 text-emerald-300"
                } px-3 py-1 text-[11px] font-extrabold hover:opacity-90"
              >
                <i data-lucide="layout-dashboard" class="h-3.5 w-3.5"></i>
                ${
                  role === "admin"
                    ? "Abrir Painel Supremo do Admin"
                    : "Abrir Painel do Vendedor (Preços & Entregas)"
                }
              </button>
            `
              : `
              <a
                href="./pos-compra.html"
                class="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <i data-lucide="messages-square" class="h-3.5 w-3.5"></i>
                Ver Página Pós-Compra & Chat Direto
              </a>
            `
          }
          <span class="hidden md:inline-flex items-center gap-1 text-[11px] ${
            sbConfig.connected ? "text-emerald-400" : "text-amber-300"
          }">
            <span class="h-1.5 w-1.5 rounded-full ${
              sbConfig.connected ? "bg-emerald-400" : "bg-amber-400"
            }"></span>
            ${sbConfig.connected ? "Supabase Cloud Ativo" : "Banco Local + Supabase Pronto"}
          </span>
        </div>
      </div>
    `;

    bar.querySelectorAll("[data-switch-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetRole = btn.getAttribute("data-switch-role");
        const switched = PB.quickSwitchRole(targetRole);
        if (switched) {
          if (typeof window.showToast === "function") {
            const labels = {
              client: `Visão alterada para CLIENTE (${switched.fullName})`,
              seller: `Visão alterada para VENDEDOR (${switched.fullName}) — Permissão de preços e entregas!`,
              admin: `Visão alterada para ADMINISTRADOR SUPREMO (${switched.fullName}) — Acesso Total!`,
            };
            window.showToast(labels[targetRole]);
          }
          refreshAllAuthUI();
          if (targetRole === "seller" || targetRole === "admin") {
            uiState.activeDashboardTab = targetRole === "admin" ? "admin_finance" : "orders";
            openDashboardModal();
          } else {
            closeDashboardModal();
          }
        }
      });
    });

    const dashBtn = document.getElementById("top-open-dashboard-btn");
    if (dashBtn) {
      dashBtn.addEventListener("click", () => {
        openDashboardModal();
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // 2. BOTÕES DE CONTA / PAINEL NO HEADER PRINCIPAL DA LOJA
  // ==========================================================================
  function renderHeaderUserArea() {
    const cartBtn = document.getElementById("open-cart-btn");
    if (!cartBtn || !cartBtn.parentElement) return;

    let userContainer = document.getElementById("header-user-controls");
    if (!userContainer) {
      userContainer = document.createElement("div");
      userContainer.id = "header-user-controls";
      userContainer.className = "flex items-center gap-2";
      cartBtn.parentElement.insertBefore(userContainer, cartBtn);
    }

    const user = PB.getCurrentUser();
    const visibleOrders = PB.getVisibleOrdersForCurrentUser();

    if (!user) {
      userContainer.innerHTML = `
        <button
          type="button"
          id="header-open-auth-btn"
          class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-white transition-colors hover:border-primary"
        >
          <i data-lucide="user" class="h-4 w-4 text-primary"></i>
          <span>Entrar / Cadastrar</span>
        </button>
      `;
      document.getElementById("header-open-auth-btn").addEventListener("click", openAuthModal);
    } else {
      const roleBadge =
        user.role === "admin"
          ? `<span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-300">Admin</span>`
          : user.role === "seller"
          ? `<span class="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-300">Vendedor</span>`
          : `<span class="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-primary">Cliente</span>`;

      userContainer.innerHTML = `
        ${
          user.role === "client"
            ? `
            <a
              href="./pos-compra.html"
              class="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-white transition-colors hover:border-primary"
              title="Meus Pedidos e Chat Pós-Compra"
            >
              <i data-lucide="message-square-text" class="h-4 w-4 text-primary"></i>
              <span>Meus Pedidos (${visibleOrders.length})</span>
            </a>
          `
            : `
            <button
              type="button"
              id="header-staff-panel-btn"
              class="inline-flex items-center gap-1.5 rounded-lg border ${
                user.role === "admin"
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                  : "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              } px-3 py-2 text-xs font-extrabold transition-colors hover:opacity-90"
            >
              <i data-lucide="sliders" class="h-4 w-4"></i>
              <span class="hidden sm:inline">${
                user.role === "admin" ? "Painel Admin" : "Painel Vendedor"
              }</span>
            </button>
          `
        }
        <button
          type="button"
          id="header-user-profile-btn"
          class="inline-flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-primary"
          title="Abrir Área de Usuário / Trocar Conta"
        >
          <i data-lucide="user-check" class="h-4 w-4 text-primary"></i>
          <span class="hidden lg:inline max-w-[120px] truncate">${PB.escapeHtml(user.fullName)}</span>
          ${roleBadge}
        </button>
      `;

      const staffBtn = document.getElementById("header-staff-panel-btn");
      if (staffBtn) {
        staffBtn.addEventListener("click", openDashboardModal);
      }
      document.getElementById("header-user-profile-btn").addEventListener("click", openAuthModal);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // 3. ESTRUTURA HTML DOS MODAIS (AUTH, PONTE DE PAGAMENTO, PAINEL VENDEDOR/ADMIN)
  // ==========================================================================
  function renderModalsStructure() {
    const root = document.getElementById("phoenix-modals-root");
    if (!root) return;

    root.innerHTML = `
      <!-- ================================================================ -->
      <!-- MODAL 1: LOGIN / CADASTRO DE CLIENTE (SEM CARTÃO DE CRÉDITO)      -->
      <!-- ================================================================ -->
      <div
        id="phoenix-auth-modal"
        class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      >
        <div class="relative w-full max-w-md rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl">
          <button
            type="button"
            id="close-auth-modal-btn"
            class="absolute right-4 top-4 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-white"
          >
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>

          <div class="flex items-center gap-2.5">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <i data-lucide="shield" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-extrabold text-white">Área do Usuário PhoenixStore</h3>
              <p class="text-xs text-muted-foreground">Acesso protegido com validação e RLS</p>
            </div>
          </div>

          <div id="auth-modal-body" class="mt-5"></div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- MODAL 2: PONTE DO MEIO DE PAGAMENTO EXTERNO -> PÓS-COMPRA        -->
      <!-- ================================================================ -->
      <div
        id="phoenix-payment-modal"
        class="fixed inset-0 z-50 hidden items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      >
        <div class="relative w-full max-w-lg rounded-2xl border border-primary/50 bg-card p-6 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.5)]">
          <button
            type="button"
            id="close-payment-modal-btn"
            class="absolute right-4 top-4 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-white"
          >
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>

          <div id="payment-modal-body"></div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- MODAL 3: EDIÇÃO RÁPIDA DE PREÇO / ESTOQUE (VENDEDOR & ADMIN)      -->
      <!-- ================================================================ -->
      <div
        id="phoenix-quick-edit-modal"
        class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      >
        <div class="relative w-full max-w-md rounded-2xl border border-emerald-500/40 bg-card p-6 shadow-2xl">
          <button
            type="button"
            id="close-quick-edit-btn"
            class="absolute right-4 top-4 rounded-lg border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-white"
          >
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
          <div id="quick-edit-modal-body"></div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- MODAL 4: PAINEL DE GESTÃO (VENDEDOR vs ADMINISTRADOR SUPREMO)     -->
      <!-- ================================================================ -->
      <div
        id="phoenix-dashboard-modal"
        class="fixed inset-0 z-50 hidden items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md"
      >
        <div class="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-2xl">
          <!-- Cabeçalho do Painel -->
          <div id="dashboard-modal-header" class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-6 py-4"></div>

          <!-- Navegação de Abas do Painel -->
          <div id="dashboard-modal-tabs" class="flex flex-wrap items-center gap-2 border-b border-border bg-background/50 px-6 py-2.5"></div>

          <!-- Conteúdo Rolável do Painel -->
          <div id="dashboard-modal-content" class="flex-1 overflow-y-auto p-6"></div>
        </div>
      </div>
    `;

    document.getElementById("close-auth-modal-btn").addEventListener("click", closeAuthModal);
    document.getElementById("close-payment-modal-btn").addEventListener("click", closePaymentModal);
    document.getElementById("close-quick-edit-btn").addEventListener("click", closeQuickEditModal);
  }

  // ==========================================================================
  // 4. MODAL DE LOGIN E CADASTRO DE CLIENTE (SEM CARTÃO, COM MAXLENGTH)
  // ==========================================================================
  function openAuthModal() {
    const modal = document.getElementById("phoenix-auth-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    renderAuthModalBody();
  }

  function closeAuthModal() {
    const modal = document.getElementById("phoenix-auth-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function renderAuthModalBody() {
    const body = document.getElementById("auth-modal-body");
    const currentUser = PB.getCurrentUser();

    body.innerHTML = `
      <!-- Conta Atual Logada -->
      ${
        currentUser
          ? `
          <div class="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-muted-foreground">Conectado como:</span>
                <p class="text-sm font-extrabold text-white">${PB.escapeHtml(currentUser.fullName)}</p>
                <p class="text-[11px] text-muted-foreground">${PB.escapeHtml(currentUser.email)} • Perfil: <strong class="uppercase text-primary">${PB.escapeHtml(currentUser.role)}</strong></p>
              </div>
              <button
                type="button"
                id="auth-logout-btn"
                class="rounded-lg border border-border bg-background px-3 py-1.5 font-bold text-red-400 hover:border-red-400"
              >
                Sair
              </button>
            </div>
          </div>
        `
          : ""
      }

      <!-- Abas Entrar vs Criar Conta de Cliente -->
      <div class="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1">
        <button
          type="button"
          data-auth-tab="login"
          class="rounded-lg py-2 text-xs font-extrabold transition-colors ${
            uiState.authTab === "login"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-white"
          }"
        >
          Entrar na Conta
        </button>
        <button
          type="button"
          data-auth-tab="register"
          class="rounded-lg py-2 text-xs font-extrabold transition-colors ${
            uiState.authTab === "register"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-white"
          }"
        >
          Cadastro de Cliente
        </button>
      </div>

      ${
        uiState.authTab === "login"
          ? `
          <form id="auth-login-form" class="mt-4 space-y-3">
            <div>
              <label class="block text-xs font-bold uppercase text-muted-foreground">E-mail (máx. 100 caracteres)</label>
              <input
                id="login-email"
                type="email"
                required
                maxlength="100"
                placeholder="seuemail@exemplo.com"
                class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-muted-foreground">Senha (máx. 64 caracteres)</label>
              <input
                id="login-password"
                type="password"
                required
                maxlength="64"
                placeholder="••••••••"
                class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <p id="auth-error-msg" class="hidden text-xs font-semibold text-red-400"></p>
            <button
              type="submit"
              class="glow-btn w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Entrar na Plataforma
            </button>
          </form>

          <!-- Botões de Acesso Rápido às 3 Contas de Teste -->
          <div class="mt-5 border-t border-border pt-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Contas Prontas para Teste (1 Clique):
            </p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                data-demo-login="client"
                class="rounded-lg border border-border bg-background p-2 text-left text-[11px] hover:border-primary"
              >
                <span class="block font-extrabold text-primary">👤 Cliente</span>
                <span class="text-[10px] text-muted-foreground">Compra & Chat</span>
              </button>
              <button
                type="button"
                data-demo-login="seller"
                class="rounded-lg border border-border bg-background p-2 text-left text-[11px] hover:border-emerald-400"
              >
                <span class="block font-extrabold text-emerald-400">🛠️ Vendedor</span>
                <span class="text-[10px] text-muted-foreground">Preços & Entrega</span>
              </button>
              <button
                type="button"
                data-demo-login="admin"
                class="rounded-lg border border-border bg-background p-2 text-left text-[11px] hover:border-amber-400"
              >
                <span class="block font-extrabold text-amber-400">👑 Admin</span>
                <span class="text-[10px] text-muted-foreground">Acesso Supremo</span>
              </button>
            </div>
          </div>
        `
          : `
          <form id="auth-register-form" class="mt-4 space-y-3">
            <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-200">
              🔒 <strong>Cadastro Rápido e Seguro:</strong> Não pedimos cartão de crédito nem dados bancários. Apenas o básico para identificar seu pedido e entregar no seu Hideout!
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-muted-foreground">Seu Nome ou Apelido *</label>
              <input
                id="reg-name"
                type="text"
                required
                maxlength="60"
                placeholder="Ex: Rafael Exiled"
                class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-muted-foreground">Seu E-mail *</label>
              <input
                id="reg-email"
                type="email"
                required
                maxlength="100"
                placeholder="seuemail@gmail.com"
                class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold uppercase text-muted-foreground">Nick no Jogo (IGN)</label>
                <input
                  id="reg-ign"
                  type="text"
                  maxlength="60"
                  placeholder="Ex: Monk_PoE2"
                  class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase text-muted-foreground">WhatsApp (Opcional)</label>
                <input
                  id="reg-whatsapp"
                  type="text"
                  maxlength="30"
                  placeholder="(47) 99999-9999"
                  class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase text-muted-foreground">Criar Senha *</label>
              <input
                id="reg-password"
                type="password"
                required
                maxlength="64"
                placeholder="Mínimo 4 caracteres"
                class="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
            <p id="auth-error-msg" class="hidden text-xs font-semibold text-red-400"></p>
            <button
              type="submit"
              class="glow-btn w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Criar Conta de Cliente
            </button>
          </form>
        `
      }
    `;

    body.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        uiState.authTab = btn.getAttribute("data-auth-tab");
        renderAuthModalBody();
      });
    });

    const logoutBtn = document.getElementById("auth-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        PB.logout();
        refreshAllAuthUI();
        renderAuthModalBody();
      });
    }

    body.querySelectorAll("[data-demo-login]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = btn.getAttribute("data-demo-login");
        PB.quickSwitchRole(role);
        closeAuthModal();
        refreshAllAuthUI();
        if (role === "seller" || role === "admin") {
          uiState.activeDashboardTab = role === "admin" ? "admin_finance" : "orders";
          openDashboardModal();
        }
      });
    });

    const loginForm = document.getElementById("auth-login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const errEl = document.getElementById("auth-error-msg");
        try {
          const user = PB.loginWithEmail(
            document.getElementById("login-email").value,
            document.getElementById("login-password").value
          );
          closeAuthModal();
          refreshAllAuthUI();
          if (typeof window.showToast === "function") {
            window.showToast(`Bem-vindo, ${user.fullName}!`);
          }
          if (user.role === "seller" || user.role === "admin") {
            openDashboardModal();
          }
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.remove("hidden");
        }
      });
    }

    const regForm = document.getElementById("auth-register-form");
    if (regForm) {
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const errEl = document.getElementById("auth-error-msg");
        try {
          const user = PB.registerClient({
            fullName: document.getElementById("reg-name").value,
            email: document.getElementById("reg-email").value,
            ignDefault: document.getElementById("reg-ign").value,
            whatsapp: document.getElementById("reg-whatsapp").value,
            password: document.getElementById("reg-password").value,
          });
          closeAuthModal();
          refreshAllAuthUI();
          if (typeof window.showToast === "function") {
            window.showToast(`Conta criada com sucesso, ${user.fullName}!`);
          }
        } catch (err) {
          errEl.textContent = err.message;
          errEl.classList.remove("hidden");
        }
      });
    }
  }

  // ==========================================================================
  // 5. PONTE DE COMUNICAÇÃO COM O MEIO DE PAGAMENTO -> REDIRECIONA PÓS-COMPRA
  // ==========================================================================
  function openPaymentBridgeModal(checkoutData) {
    uiState.pendingCheckoutPayload = checkoutData;
    const modal = document.getElementById("phoenix-payment-modal");
    const body = document.getElementById("payment-modal-body");
    const paySettings = PB.getPaymentSettings();
    const user = PB.getCurrentUser();

    const pixPayloadCode = `00020126580014BR.GOV.BCB.PIX0136${paySettings.pixKey}5204000053039865406${(
      checkoutData.total || 0
    ).toFixed(2)}5802BR5920${paySettings.pixReceiverName.slice(0, 20)}6009SAOPAULO62070503***6304ABCD`;

    body.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <i data-lucide="qr-code" class="h-6 w-6"></i>
        </div>
        <div>
          <span class="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            Ponte de Pagamento Seguro
          </span>
          <h3 class="mt-0.5 text-lg font-extrabold text-white">
            Finalizar Pagamento & Abrir Chat de Entrega
          </h3>
        </div>
      </div>

      <div class="mt-4 rounded-xl border border-border bg-background/90 p-4 text-xs space-y-2">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Comprador:</span>
          <span class="font-bold text-white">${PB.escapeHtml(user ? user.fullName : "Cliente PhoenixStore")}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Personagem no Jogo (IGN):</span>
          <span class="font-extrabold text-primary">${PB.escapeHtml(checkoutData.clientIgn)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Jogo / Servidor:</span>
          <span class="font-semibold text-white">${PB.escapeHtml(checkoutData.gameName)} • ${PB.escapeHtml(checkoutData.leagueName)}</span>
        </div>
        <div class="flex justify-between border-t border-border pt-2 text-sm">
          <span class="font-bold text-white">Valor Total a Pagar:</span>
          <span class="font-black text-emerald-400">${
            checkoutData.total > 0 ? formatBRL(checkoutData.total) : "Sob Consulta"
          }</span>
        </div>
      </div>

      <!-- Dados da Ponte do Meio de Pagamento Externo -->
      <div class="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-extrabold uppercase tracking-wider text-primary">
            ${PB.escapeHtml(paySettings.externalGatewayName)}
          </span>
          <span class="text-[11px] text-emerald-400 font-semibold">Recebedor: ${PB.escapeHtml(paySettings.pixReceiverName)}</span>
        </div>

        <div class="mt-3">
          <label class="block text-[11px] font-semibold text-muted-foreground">
            Chave PIX / Código Copia e Cola Oficial:
          </label>
          <div class="mt-1 flex gap-2">
            <input
              id="pix-copy-input"
              type="text"
              readonly
              value="${PB.escapeHtml(pixPayloadCode)}"
              class="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              id="copy-pix-code-btn"
              class="shrink-0 rounded-lg border border-primary/50 bg-primary/15 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Copiar PIX
            </button>
          </div>
        </div>

        ${
          paySettings.externalPaymentUrl
            ? `
            <div class="mt-3">
              <a
                href="${PB.escapeHtml(paySettings.externalPaymentUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-xs font-bold text-white hover:border-primary"
              >
                <i data-lucide="external-link" class="h-4 w-4 text-primary"></i>
                Abrir Link do Meio de Pagamento Externo
              </a>
            </div>
          `
            : ""
        }
      </div>

      <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Assim que clicar abaixo, o sistema registra seu pedido no banco, <strong>envia um aviso imediato para o Vendedor e Administrador</strong>, e encaminha você para a <strong>Página de Pós-Compra com Chat Direto no site</strong>!
      </p>

      <div class="mt-4 space-y-2">
        <button
          type="button"
          id="confirm-payment-redirect-btn"
          class="glow-btn flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-black hover:bg-emerald-400"
        >
          <i data-lucide="check-circle-2" class="h-5 w-5"></i>
          <span>Confirmar Pagamento & Abrir Chat Pós-Compra</span>
        </button>
      </div>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();

    document.getElementById("copy-pix-code-btn").addEventListener("click", () => {
      const inp = document.getElementById("pix-copy-input");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(inp.value).catch(() => {});
      }
      if (typeof window.showToast === "function") {
        window.showToast("Código PIX copiado para a área de transferência!");
      }
    });

    document.getElementById("confirm-payment-redirect-btn").addEventListener("click", () => {
      try {
        const createdOrder = PB.createPaidOrder(checkoutData);
        PB.playNotificationSound();
        closePaymentModal();
        // Redireciona o cliente para a página dedicada de Pós-Compra com o Chat Direto aberto!
        window.location.href = `./pos-compra.html?order=${encodeURIComponent(createdOrder.orderCode)}`;
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function closePaymentModal() {
    const modal = document.getElementById("phoenix-payment-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  // ==========================================================================
  // 6. MODAL DE EDIÇÃO RÁPIDA DE PREÇO / QUANTIDADE / ESTOQUE (VENDEDOR & ADMIN)
  // ==========================================================================
  function openQuickEditProductModal(productId) {
    const user = PB.getCurrentUser();
    if (!user || !["seller", "admin"].includes(user.role)) return;

    const storeObj = window.PHOENIX_STORE_DATA;
    const mergedProducts = PB.getMergedCatalogProducts(storeObj.products);
    const prod = mergedProducts.find((p) => p.id === productId);
    if (!prod) return;

    const modal = document.getElementById("phoenix-quick-edit-modal");
    const body = document.getElementById("quick-edit-modal-body");

    body.innerHTML = `
      <div class="flex items-center gap-2.5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <i data-lucide="tag" class="h-5 w-5"></i>
        </div>
        <div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
            Permissão de ${user.role === "admin" ? "Administrador" : "Vendedor"}
          </span>
          <h3 class="text-base font-extrabold text-white">Editar Preço & Estoque</h3>
        </div>
      </div>

      <form id="quick-edit-form" class="mt-4 space-y-3 text-xs">
        <div class="rounded-xl border border-border bg-background/80 p-3">
          <p class="font-extrabold text-white text-sm">${PB.escapeHtml(prod.name)}</p>
          <p class="text-muted-foreground">${PB.escapeHtml(prod.unitLabel)}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold uppercase text-muted-foreground">Preço Unitário (R$)</label>
            <input
              id="qe-price"
              type="number"
              step="0.01"
              min="0"
              value="${Number(prod.pricePerUnit || 0).toFixed(2)}"
              class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold text-white focus:border-primary focus:outline-none"
            />
            <span class="text-[10px] text-muted-foreground">Use 0 para "Sob Consulta"</span>
          </div>
          <div>
            <label class="block font-bold uppercase text-muted-foreground">Qtd Mínima Pedido</label>
            <input
              id="qe-min-qty"
              type="number"
              min="1"
              step="1"
              value="${prod.minQty || 1}"
              class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold text-white focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block font-bold uppercase text-muted-foreground">Status de Estoque / Entrega (máx. 80 carac.)</label>
          <input
            id="qe-stock-status"
            type="text"
            maxlength="80"
            value="${PB.escapeHtml(prod.stockStatus || "Em Estoque")}"
            class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-white focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="submit"
          class="glow-btn w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-black hover:bg-emerald-400"
        >
          Salvar Alterações no Catálogo
        </button>
      </form>
    `;

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();

    document.getElementById("quick-edit-form").addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        PB.updateProductPricingAndStock(productId, {
          pricePerUnit: document.getElementById("qe-price").value,
          minQty: document.getElementById("qe-min-qty").value,
          stockStatus: document.getElementById("qe-stock-status").value,
        });
        closeQuickEditModal();
        syncCatalogWithStore();
        if (typeof window.showToast === "function") {
          window.showToast(`Preço e estoque de "${prod.name}" atualizados!`);
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function closeQuickEditModal() {
    const modal = document.getElementById("phoenix-quick-edit-modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  // ==========================================================================
  // 7. PAINEL COMPLETO DO VENDEDOR ('seller') VS ADMINISTRADOR ('admin')
  // ==========================================================================
  function openDashboardModal() {
    const user = PB.getCurrentUser();
    if (!user || !["seller", "admin"].includes(user.role)) {
      openAuthModal();
      return;
    }
    const modal = document.getElementById("phoenix-dashboard-modal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    renderDashboardModal();
  }

  function closeDashboardModal() {
    const modal = document.getElementById("phoenix-dashboard-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function renderDashboardModal() {
    const user = PB.getCurrentUser();
    if (!user || !["seller", "admin"].includes(user.role)) return;

    const isAdmin = user.role === "admin";
    const header = document.getElementById("dashboard-modal-header");
    const tabsEl = document.getElementById("dashboard-modal-tabs");
    const contentEl = document.getElementById("dashboard-modal-content");

    // Se o usuário trocou para Vendedor e estava numa aba exclusiva de Admin, volta para 'orders'
    if (!isAdmin && ["admin_finance", "admin_users", "admin_settings"].includes(uiState.activeDashboardTab)) {
      uiState.activeDashboardTab = "orders";
    }

    header.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-2xl ${
          isAdmin ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
        }">
          <i data-lucide="${isAdmin ? "crown" : "headset"}" class="h-6 w-6"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-black text-white">
              ${isAdmin ? "Painel Supremo do Administrador" : "Painel de Operações do Vendedor"}
            </h2>
            <span class="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
              isAdmin ? "bg-amber-500 text-black" : "bg-emerald-500 text-black"
            }">
              ${isAdmin ? "Permissão Suprema" : "Funcionário • Acesso Controlado RLS"}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">
            Logado como <strong class="text-white">${PB.escapeHtml(user.fullName)}</strong> (${PB.escapeHtml(user.email)})
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          id="dash-switch-role-quick-btn"
          class="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-white"
        >
          Alternar para ${isAdmin ? "Visão Vendedor" : "Visão Administrador"}
        </button>
        <button
          type="button"
          id="close-dashboard-modal-btn"
          class="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-white hover:border-primary"
        >
          Fechar Painel ✕
        </button>
      </div>
    `;

    document.getElementById("close-dashboard-modal-btn").addEventListener("click", closeDashboardModal);
    document.getElementById("dash-switch-role-quick-btn").addEventListener("click", () => {
      PB.quickSwitchRole(isAdmin ? "seller" : "admin");
      refreshAllAuthUI();
      renderDashboardModal();
    });

    // Definição das Abas conforme permissões de cada Perfil
    const sellerTabs = [
      { id: "orders", label: "🔔 Entregas & Chat ao Vivo", icon: "messages-square" },
      { id: "catalog", label: "🏷️ Editar Preços & Estoque", icon: "tags" },
      { id: "my_sales", label: "📦 Minhas Vendas (Pessoal)", icon: "package-check" },
    ];

    const adminTabs = [
      { id: "admin_finance", label: "💰 Balanço Geral & Valores", icon: "bar-chart-3" },
      { id: "orders", label: "📋 Histórico Geral & Todos os Chats", icon: "messages-square" },
      { id: "catalog", label: "🏷️ Preços, Estoque & Produtos", icon: "tags" },
      { id: "admin_users", label: "👥 Base de Clientes & Vendedores", icon: "users" },
      { id: "admin_settings", label: "🔐 Meio de Pagamento & Supabase", icon: "lock" },
    ];

    const activeTabsList = isAdmin ? adminTabs : sellerTabs;

    tabsEl.innerHTML = `
      ${activeTabsList
        .map((t) => {
          const active = uiState.activeDashboardTab === t.id;
          return `
            <button
              type="button"
              data-dash-tab="${t.id}"
              class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-card hover:text-white"
              }"
            >
              <span>${t.label}</span>
            </button>
          `;
        })
        .join("")}
      ${
        !isAdmin
          ? `
          <span class="ml-auto hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-300">
            🔒 Base Geral de Clientes & Balanço Global ocultos (Exclusivo Admin)
          </span>
        `
          : ""
      }
    `;

    tabsEl.querySelectorAll("[data-dash-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        uiState.activeDashboardTab = btn.getAttribute("data-dash-tab");
        renderDashboardModal();
      });
    });

    // Renderiza o conteúdo da aba ativa
    if (uiState.activeDashboardTab === "orders") {
      renderDashboardOrdersAndChatTab(contentEl, isAdmin);
    } else if (uiState.activeDashboardTab === "catalog") {
      renderDashboardCatalogEditorTab(contentEl, isAdmin);
    } else if (uiState.activeDashboardTab === "my_sales") {
      renderDashboardSellerPersonalSalesTab(contentEl);
    } else if (uiState.activeDashboardTab === "admin_finance" && isAdmin) {
      renderDashboardAdminFinanceTab(contentEl);
    } else if (uiState.activeDashboardTab === "admin_users" && isAdmin) {
      renderDashboardAdminUsersTab(contentEl);
    } else if (uiState.activeDashboardTab === "admin_settings" && isAdmin) {
      renderDashboardAdminSettingsTab(contentEl);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --------------------------------------------------------------------------
  // ABA 1: FILA DE ENTREGAS & CHAT DIRETO AO VIVO (VENDEDOR VÊ FILA+DELE | ADMIN VÊ TUDO)
  // --------------------------------------------------------------------------
  function renderDashboardOrdersAndChatTab(container, isAdmin) {
    const visibleOrders = PB.getVisibleOrdersForCurrentUser();
    if (
      visibleOrders.length > 0 &&
      !visibleOrders.some((o) => o.orderCode === uiState.selectedChatOrderCode)
    ) {
      uiState.selectedChatOrderCode = visibleOrders[0].orderCode;
    }

    const activeOrder = visibleOrders.find((o) => o.orderCode === uiState.selectedChatOrderCode) || null;
    const messages = activeOrder ? PB.getOrderMessages(activeOrder.orderCode) : [];

    container.innerHTML = `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/80 px-4 py-3 text-xs">
        <div>
          <strong class="text-white">
            ${
              isAdmin
                ? "👑 Visão Administrador: Exibindo TODOS os pedidos e chats de toda a loja"
                : "🛠️ Visão Vendedor: Exibindo pedidos na fila de espera e as entregas assumidas por você"
            }
          </strong>
          <p class="text-[11px] text-muted-foreground">
            Quando o cliente finaliza o pagamento, o pedido entra aqui automaticamente e abre o Chat Direto com a página de Pós-Compra dele.
          </p>
        </div>
        <a
          href="./pos-compra.html?order=${encodeURIComponent(uiState.selectedChatOrderCode || "")}"
          target="_blank"
          class="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-bold text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <i data-lucide="external-link" class="h-3.5 w-3.5"></i>
          Abrir Tela Pós-Compra do Cliente
        </a>
      </div>

      <div class="grid gap-6 lg:grid-cols-12">
        <!-- Lista de Pedidos (5 colunas) -->
        <div class="space-y-3 lg:col-span-5">
          <h3 class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Pedidos Disponíveis (${visibleOrders.length})
          </h3>
          <div class="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
            ${visibleOrders
              .map((o) => {
                const isSelected = o.orderCode === uiState.selectedChatOrderCode;
                const st = getStatusMeta(o.deliveryStatus);
                const itemsText = (o.items || []).map((i) => `${i.qty}x ${i.name}`).join(", ");
                return `
                  <div
                    data-select-order="${PB.escapeHtml(o.orderCode)}"
                    class="cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/15 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.4)]"
                        : "border-border bg-background/80 hover:border-primary/40"
                    }"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-black text-white">#${PB.escapeHtml(o.orderCode)}</span>
                      <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${st.cls}">
                        ${st.label}
                      </span>
                    </div>
                    <p class="mt-1.5 text-xs font-bold text-primary">
                      IGN: ${PB.escapeHtml(o.clientIgn)} <span class="text-muted-foreground font-normal">• ${PB.escapeHtml(o.gameName)}</span>
                    </p>
                    <p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      ${PB.escapeHtml(itemsText)}
                    </p>
                    <div class="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
                      <span class="text-muted-foreground">
                        Vendedor: <strong class="text-white">${PB.escapeHtml(o.sellerName || "Fila Aberta")}</strong>
                      </span>
                      <span class="font-extrabold text-emerald-400">${formatBRL(o.total)}</span>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>

        <!-- Chat Direto & Controle de Entrega do Pedido Selecionado (7 colunas) -->
        <div class="lg:col-span-7">
          ${
            activeOrder
              ? `
              <div class="flex h-[550px] flex-col rounded-2xl border border-border bg-background/90">
                <!-- Topo do Pedido Ativo + Botões de Ação do Vendedor/Admin -->
                <div class="border-b border-border p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 class="text-base font-extrabold text-white">
                        Pedido <span class="text-primary">#${PB.escapeHtml(activeOrder.orderCode)}</span> — Personagem: <span class="text-emerald-400">${PB.escapeHtml(activeOrder.clientIgn)}</span>
                      </h4>
                      <p class="text-xs text-muted-foreground">
                        ${PB.escapeHtml(activeOrder.gameName)} • ${PB.escapeHtml(activeOrder.leagueName)} • Total Pago: <strong class="text-white">${formatBRL(activeOrder.total)}</strong>
                      </p>
                    </div>
                  </div>

                  <!-- Botões Rápidos de Status de Entrega -->
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <span class="text-[11px] font-bold text-muted-foreground">Ação de Entrega:</span>
                    <button
                      type="button"
                      data-set-order-status="seller_assigned"
                      class="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/25"
                    >
                      1. Assumir Entrega
                    </button>
                    <button
                      type="button"
                      data-set-order-status="in_hideout"
                      class="rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/25"
                    >
                      2. Já estou no Hideout (Party Enviada)
                    </button>
                    <button
                      type="button"
                      data-set-order-status="delivered"
                      class="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-extrabold text-emerald-300 hover:bg-emerald-500/30"
                    >
                      3. Marcar como Entregue ✓
                    </button>
                  </div>
                </div>

                <!-- Mensagens do Chat com o Cliente -->
                <div id="dash-chat-messages" class="flex-1 space-y-3 overflow-y-auto p-4">
                  ${messages
                    .map((m) => {
                      if (m.senderRole === "system") {
                        return `
                          <div class="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-[11px] text-amber-200">
                            <strong>⚡ ${PB.escapeHtml(m.senderName)}:</strong> ${PB.escapeHtml(m.message)}
                          </div>
                        `;
                      }
                      const isStaff = m.senderRole === "seller" || m.senderRole === "admin";
                      return `
                        <div class="flex flex-col ${isStaff ? "items-end" : "items-start"}">
                          <span class="mb-1 text-[10px] text-muted-foreground">
                            <strong class="text-white">${PB.escapeHtml(m.senderName)}</strong> (${m.senderRole.toUpperCase()}) • ${formatDateTime(m.createdAt)}
                          </span>
                          <div class="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            isStaff
                              ? "bg-primary text-primary-foreground font-medium"
                              : "border border-border bg-card text-white"
                          }">
                            ${PB.escapeHtml(m.message)}
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>

                <!-- Input para Responder ao Cliente na Página de Pós-Compra -->
                <form id="dash-chat-form" class="border-t border-border bg-card p-3">
                  <div class="flex gap-2">
                    <input
                      id="dash-chat-input"
                      type="text"
                      maxlength="500"
                      placeholder="Responder diretamente para ${PB.escapeHtml(activeOrder.clientIgn)} no chat pós-compra..."
                      class="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      class="glow-btn rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
                    >
                      Enviar no Chat
                    </button>
                  </div>
                </form>
              </div>
            `
              : `<div class="rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">Selecione um pedido ao lado.</div>`
          }
        </div>
      </div>
    `;

    container.querySelectorAll("[data-select-order]").forEach((el) => {
      el.addEventListener("click", () => {
        uiState.selectedChatOrderCode = el.getAttribute("data-select-order");
        renderDashboardModal();
      });
    });

    container.querySelectorAll("[data-set-order-status]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!activeOrder) return;
        const newSt = btn.getAttribute("data-set-order-status");
        try {
          PB.updateOrderStatus(activeOrder.orderCode, newSt);
          if (typeof window.showToast === "function") {
            window.showToast(`Status do pedido #${activeOrder.orderCode} atualizado!`);
          }
          renderDashboardModal();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    const chatForm = document.getElementById("dash-chat-form");
    if (chatForm && activeOrder) {
      const msgBox = document.getElementById("dash-chat-messages");
      if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;

      chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const inp = document.getElementById("dash-chat-input");
        const txt = inp.value.trim();
        if (!txt) return;
        PB.sendOrderChatMessage(activeOrder.orderCode, txt);
        inp.value = "";
        renderDashboardModal();
      });
    }
  }

  // --------------------------------------------------------------------------
  // ABA 2: EDITOR DE PREÇOS, QUANTIDADES E ESTOQUE (PERMITIDO PARA VENDEDOR E ADMIN)
  // --------------------------------------------------------------------------
  function renderDashboardCatalogEditorTab(container, isAdmin) {
    const storeObj = window.PHOENIX_STORE_DATA;
    const products = PB.getMergedCatalogProducts(storeObj.products);

    container.innerHTML = `
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
        <div>
          <strong class="text-emerald-300 text-sm">🏷️ Gerenciamento de Preços, Quantidades e Estoque</strong>
          <p class="mt-0.5 text-muted-foreground">
            Tanto o <strong>Vendedor</strong> quanto o <strong>Administrador</strong> têm permissão para atualizar preços unitários, quantidades mínimas e status de estoque. As alterações refletem na loja imediatamente!
          </p>
        </div>
      </div>

      <!-- Tabela de Edição Rápida de Produtos -->
      <div class="overflow-x-auto rounded-2xl border border-border bg-background/90">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-card text-[11px] font-extrabold uppercase text-muted-foreground">
            <tr>
              <th class="px-4 py-3">Jogo / Cat.</th>
              <th class="px-4 py-3">Produto</th>
              <th class="px-4 py-3">Preço Unit. (R$)</th>
              <th class="px-4 py-3">Qtd Mín.</th>
              <th class="px-4 py-3">Status de Estoque</th>
              <th class="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            ${products
              .map(
                (p) => `
                <tr class="hover:bg-card/60">
                  <td class="px-4 py-3 font-bold uppercase text-primary">
                    ${PB.escapeHtml(p.gameId)} • ${PB.escapeHtml(p.categoryId)}
                  </td>
                  <td class="px-4 py-3">
                    <p class="font-extrabold text-white">${PB.escapeHtml(p.name)}</p>
                    <p class="text-[11px] text-muted-foreground">${PB.escapeHtml(p.unitLabel)}</p>
                  </td>
                  <td class="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      data-row-price="${PB.escapeHtml(p.id)}"
                      value="${Number(p.pricePerUnit || 0).toFixed(2)}"
                      class="w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 font-bold text-white focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      data-row-minqty="${PB.escapeHtml(p.id)}"
                      value="${p.minQty || 1}"
                      class="w-16 rounded-lg border border-border bg-card px-2.5 py-1.5 font-bold text-white focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <input
                      type="text"
                      maxlength="80"
                      data-row-stock="${PB.escapeHtml(p.id)}"
                      value="${PB.escapeHtml(p.stockStatus || "Em Estoque")}"
                      class="w-full min-w-[180px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-white focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      data-save-row="${PB.escapeHtml(p.id)}"
                      class="rounded-lg bg-emerald-500 px-3 py-1.5 font-extrabold text-black hover:bg-emerald-400"
                    >
                      Salvar
                    </button>
                  </td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <!-- Formulário para Adicionar Novo Item / Currency / Service ao Catálogo -->
      <div class="mt-6 rounded-2xl border border-border bg-background/80 p-5">
        <h3 class="text-sm font-extrabold text-white">
          ➕ Adicionar Nova Currency, Item ou Service ao Catálogo
        </h3>
        <form id="add-new-product-form" class="mt-3 grid gap-3 sm:grid-cols-6 text-xs">
          <div>
            <label class="block font-bold text-muted-foreground">Jogo</label>
            <select id="np-game" class="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-white">
              <option value="poe2">Path of Exile 2</option>
              <option value="poe1">Path of Exile 1</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-muted-foreground">Categoria</label>
            <select id="np-cat" class="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-white">
              <option value="currency">Currency</option>
              <option value="services">Services & Boost</option>
              <option value="items">Itens & Builds</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="block font-bold text-muted-foreground">Nome do Produto</label>
            <input id="np-name" type="text" required maxlength="100" placeholder="Ex: Mirror Shard / Boss Carry" class="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-white" />
          </div>
          <div>
            <label class="block font-bold text-muted-foreground">Unidade</label>
            <input id="np-unit" type="text" required maxlength="50" placeholder="Ex: 1x Pacote" class="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-white" />
          </div>
          <div>
            <label class="block font-bold text-muted-foreground">Preço (R$)</label>
            <input id="np-price" type="number" step="0.01" min="0" value="15.00" class="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-white" />
          </div>
          <div class="sm:col-span-5">
            <input id="np-subtitle" type="text" maxlength="200" placeholder="Descrição curta do produto ou serviço..." class="w-full rounded-lg border border-border bg-card px-3 py-2 text-white" />
          </div>
          <div>
            <button type="submit" class="glow-btn w-full rounded-lg bg-primary py-2 font-extrabold text-primary-foreground">
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    `;

    container.querySelectorAll("[data-save-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pid = btn.getAttribute("data-save-row");
        const priceInp = container.querySelector(`[data-row-price="${pid}"]`);
        const minInp = container.querySelector(`[data-row-minqty="${pid}"]`);
        const stockInp = container.querySelector(`[data-row-stock="${pid}"]`);

        PB.updateProductPricingAndStock(pid, {
          pricePerUnit: priceInp.value,
          minQty: minInp.value,
          stockStatus: stockInp.value,
        });
        syncCatalogWithStore();
        if (typeof window.showToast === "function") {
          window.showToast("Produto atualizado com sucesso na loja!");
        }
      });
    });

    const addForm = document.getElementById("add-new-product-form");
    if (addForm) {
      addForm.addEventListener("submit", (e) => {
        e.preventDefault();
        try {
          PB.addCustomProduct({
            gameId: document.getElementById("np-game").value,
            categoryId: document.getElementById("np-cat").value,
            name: document.getElementById("np-name").value,
            unitLabel: document.getElementById("np-unit").value,
            pricePerUnit: document.getElementById("np-price").value,
            subtitle: document.getElementById("np-subtitle").value,
            minQty: 1,
            stockStatus: "Estoque Imediato",
          });
          syncCatalogWithStore();
          renderDashboardModal();
          if (typeof window.showToast === "function") {
            window.showToast("Novo item adicionado ao catálogo!");
          }
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // ABA 3 (VENDEDOR): MINHAS VENDAS PESSOAIS (VÊ APENAS O QUE ELE VENDEU/ENTREGOU)
  // --------------------------------------------------------------------------
  function renderDashboardSellerPersonalSalesTab(container) {
    const stats = PB.getSellerPersonalStats();

    container.innerHTML = `
      <!-- Aviso de Segurança RLS para o Vendedor -->
      <div class="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
        <p class="font-extrabold uppercase tracking-wider text-amber-300">
          🔒 Política de Acesso Restrito do Vendedor (Row Level Security):
        </p>
        <p class="mt-1 text-muted-foreground">
          Como <strong>Vendedor (${PB.escapeHtml(stats.sellerName)})</strong>, você visualiza <strong>exclusivamente as vendas atendidas por você</strong>. Você não possui acesso à base geral de clientes, nem às vendas de outros vendedores, nem ao balanço financeiro global da PhoenixStore.
        </p>
      </div>

      <!-- Cards das Vendas Pessoais deste Vendedor -->
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Minhas Vendas Atendidas</span>
          <p class="mt-2 text-3xl font-black text-white">${stats.mySalesCount}</p>
          <p class="mt-1 text-xs text-emerald-400">${stats.myDeliveredCount} concluídas • ${stats.myActiveDeliveriesCount} em andamento</p>
        </div>
        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Volume Entregue por Mim</span>
          <p class="mt-2 text-3xl font-black text-primary">${formatBRL(stats.myTotalVolumeBRL)}</p>
          <p class="mt-1 text-xs text-muted-foreground">Soma exclusiva dos pedidos que você atendeu</p>
        </div>
        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Pedidos na Fila Agora</span>
          <p class="mt-2 text-3xl font-black text-emerald-400">${stats.queueWaitingCount}</p>
          <p class="mt-1 text-xs text-muted-foreground">Aguardando um vendedor assumir</p>
        </div>
      </div>

      <!-- Lista de Vendas Exclusivas deste Vendedor -->
      <h3 class="mt-6 text-sm font-extrabold text-white">
        Histórico das Vendas Atendidas por ${PB.escapeHtml(stats.sellerName)}
      </h3>
      <div class="mt-3 space-y-2.5">
        ${stats.myOrders
          .map((o) => {
            const st = getStatusMeta(o.deliveryStatus);
            return `
              <div class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-background/85 p-4 text-xs">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-black text-white text-sm">#${PB.escapeHtml(o.orderCode)}</span>
                    <span class="rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${st.cls}">
                      ${st.label}
                    </span>
                  </div>
                  <p class="mt-1 text-muted-foreground">
                    Personagem (IGN): <strong class="text-primary">${PB.escapeHtml(o.clientIgn)}</strong> • ${PB.escapeHtml(o.gameName)} (${PB.escapeHtml(o.leagueName)})
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-base font-black text-emerald-400">${formatBRL(o.total)}</p>
                  <button
                    type="button"
                    data-open-seller-order-chat="${PB.escapeHtml(o.orderCode)}"
                    class="mt-1 text-[11px] font-bold text-primary hover:underline"
                  >
                    Abrir Chat desta Entrega →
                  </button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    container.querySelectorAll("[data-open-seller-order-chat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        uiState.selectedChatOrderCode = btn.getAttribute("data-open-seller-order-chat");
        uiState.activeDashboardTab = "orders";
        renderDashboardModal();
      });
    });
  }

  // --------------------------------------------------------------------------
  // ABA 4 (EXCLUSIVO ADMIN): BALANÇO FINANCEIRO GLOBAL & RANKING DE VENDEDORES
  // --------------------------------------------------------------------------
  function renderDashboardAdminFinanceTab(container) {
    const fin = PB.getAdminGlobalFinancialBalance();

    container.innerHTML = `
      <div class="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
        <strong class="text-amber-300 text-sm">👑 Visão Suprema do Administrador — Balanço Completo de Valores</strong>
        <p class="mt-0.5 text-muted-foreground">
          Estes dados financeiros consolidados são restritos exclusivamente ao perfil <strong>Administrador</strong>. Nenhum vendedor ou cliente possui acesso a esta tela.
        </p>
      </div>

      <!-- KPIs Financeiros Globais -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-2xl border border-primary/40 bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Balanço Líquido Confirmado</span>
          <p class="mt-2 text-3xl font-black text-primary">${formatBRL(fin.netRevenueBRL)}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">Bruto: ${formatBRL(fin.grossSubtotalBRL)} (Desc. PIX: -${formatBRL(fin.totalDiscountsBRL)})</p>
        </div>

        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Total de Compras Pagas</span>
          <p class="mt-2 text-3xl font-black text-white">${fin.paidOrdersCount}</p>
          <p class="mt-1 text-[11px] text-emerald-400">${fin.deliveredOrdersCount} entregues • ${fin.waitingQueueCount} na fila</p>
        </div>

        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Ticket Médio por Pedido</span>
          <p class="mt-2 text-3xl font-black text-emerald-400">${formatBRL(fin.averageTicketBRL)}</p>
          <p class="mt-1 text-[11px] text-muted-foreground">Média geral da loja</p>
        </div>

        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <span class="text-xs font-bold uppercase text-muted-foreground">Segurança Recebimento</span>
          <p class="mt-2 text-lg font-extrabold text-amber-300">PIX / Gateway Blindado</p>
          <p class="mt-1 text-[11px] text-muted-foreground">Somente Admin altera conta destino</p>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <!-- Balanço de Vendas Separado por Vendedor -->
        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <h3 class="text-sm font-extrabold text-white">
            📊 Desempenho e Vendas por Vendedor
          </h3>
          <p class="text-xs text-muted-foreground">
            Veja exatamente quanto cada funcionário vendeu/entregou (cada vendedor só enxerga a própria linha no painel dele).
          </p>
          <div class="mt-4 space-y-2.5">
            ${fin.salesBySeller
              .map(
                (s) => `
                <div class="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-xs">
                  <div>
                    <p class="font-extrabold text-white">${PB.escapeHtml(s.sellerName)}</p>
                    <p class="text-[11px] text-muted-foreground">${s.ordersCount} pedido(s) • ${s.deliveredCount} entregue(s)</p>
                  </div>
                  <span class="text-sm font-black text-primary">${formatBRL(s.totalBRL)}</span>
                </div>
              `
              )
              .join("")}
          </div>
        </div>

        <!-- Balanço por Jogo -->
        <div class="rounded-2xl border border-border bg-background/90 p-5">
          <h3 class="text-sm font-extrabold text-white">
            🎮 Faturamento por Jogo (PoE 2 vs PoE 1)
          </h3>
          <p class="text-xs text-muted-foreground">
            Volume financeiro acumulado por jogo ativo no catálogo.
          </p>
          <div class="mt-4 space-y-2.5">
            ${fin.salesByGame
              .map(
                (g) => `
                <div class="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 text-xs">
                  <div>
                    <p class="font-extrabold text-white">${PB.escapeHtml(g.gameName)}</p>
                    <p class="text-[11px] text-muted-foreground">${g.ordersCount} compra(s) confirmada(s)</p>
                  </div>
                  <span class="text-sm font-black text-emerald-400">${formatBRL(g.totalBRL)}</span>
                </div>
              `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // ABA 5 (EXCLUSIVO ADMIN): BASE DE CLIENTES & GESTÃO DE VENDEDORES
  // --------------------------------------------------------------------------
  function renderDashboardAdminUsersTab(container) {
    const users = PB.getUsersForAdmin();

    container.innerHTML = `
      <div class="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
        <strong class="text-amber-300 text-sm">👥 Base Completa de Clientes & Equipe (Exclusivo Administrador)</strong>
        <p class="mt-0.5 text-muted-foreground">
          O Vendedor <strong>não tem acesso</strong> a esta base de clientes. Aqui você pode visualizar todos os clientes cadastrados, promover um usuário para <strong>Vendedor</strong> ou cadastrar novos funcionários.
        </p>
      </div>

      <!-- Cadastrar Novo Funcionário / Vendedor -->
      <div class="mb-6 rounded-2xl border border-border bg-background/90 p-5">
        <h3 class="text-sm font-extrabold text-white">➕ Cadastrar Novo Vendedor ou Administrador</h3>
        <form id="admin-add-staff-form" class="mt-3 grid gap-3 sm:grid-cols-5 text-xs">
          <input id="st-name" type="text" required maxlength="60" placeholder="Nome do Funcionário" class="rounded-lg border border-border bg-card px-3 py-2 text-white" />
          <input id="st-email" type="email" required maxlength="100" placeholder="E-mail de Login" class="rounded-lg border border-border bg-card px-3 py-2 text-white" />
          <input id="st-ign" type="text" maxlength="60" placeholder="IGN de Entrega" class="rounded-lg border border-border bg-card px-3 py-2 text-white" />
          <select id="st-role" class="rounded-lg border border-border bg-card px-3 py-2 text-white font-bold">
            <option value="seller">Cargo: Vendedor</option>
            <option value="admin">Cargo: Administrador</option>
            <option value="client">Cargo: Cliente</option>
          </select>
          <button type="submit" class="glow-btn rounded-lg bg-primary py-2 font-extrabold text-primary-foreground">
            Adicionar Usuário
          </button>
        </form>
      </div>

      <!-- Tabela de Todos os Usuários -->
      <div class="overflow-x-auto rounded-2xl border border-border bg-background/90">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-card text-[11px] font-extrabold uppercase text-muted-foreground">
            <tr>
              <th class="px-4 py-3">Nome</th>
              <th class="px-4 py-3">E-mail</th>
              <th class="px-4 py-3">IGN / WhatsApp</th>
              <th class="px-4 py-3">Perfil Atual</th>
              <th class="px-4 py-3 text-right">Alterar Permissão</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            ${users
              .map(
                (u) => `
                <tr class="hover:bg-card/60">
                  <td class="px-4 py-3 font-bold text-white">${PB.escapeHtml(u.fullName)}</td>
                  <td class="px-4 py-3 text-muted-foreground">${PB.escapeHtml(u.email)}</td>
                  <td class="px-4 py-3 text-muted-foreground">
                    <span class="text-primary font-semibold">${PB.escapeHtml(u.ignDefault || "-")}</span>
                    ${u.whatsapp ? ` • ${PB.escapeHtml(u.whatsapp)}` : ""}
                  </td>
                  <td class="px-4 py-3">
                    <span class="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      u.role === "admin"
                        ? "bg-amber-500/20 text-amber-300"
                        : u.role === "seller"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-primary/20 text-primary"
                    }">
                      ${PB.escapeHtml(u.role)}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <select
                      data-change-user-role="${PB.escapeHtml(u.id)}"
                      class="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-bold text-white"
                    >
                      <option value="client" ${u.role === "client" ? "selected" : ""}>Cliente</option>
                      <option value="seller" ${u.role === "seller" ? "selected" : ""}>Vendedor</option>
                      <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrador</option>
                    </select>
                  </td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-change-user-role]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const uid = sel.getAttribute("data-change-user-role");
        PB.updateUserRoleByAdmin(uid, sel.value);
        if (typeof window.showToast === "function") {
          window.showToast("Permissão do usuário atualizada!");
        }
        renderDashboardModal();
      });
    });

    const staffForm = document.getElementById("admin-add-staff-form");
    if (staffForm) {
      staffForm.addEventListener("submit", (e) => {
        e.preventDefault();
        try {
          PB.createStaffUserByAdmin({
            fullName: document.getElementById("st-name").value,
            email: document.getElementById("st-email").value,
            ignDefault: document.getElementById("st-ign").value,
            role: document.getElementById("st-role").value,
          });
          renderDashboardModal();
          if (typeof window.showToast === "function") {
            window.showToast("Novo membro cadastrado com sucesso!");
          }
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // ABA 6 (EXCLUSIVO ADMIN): MEIO DE PAGAMENTO BLINDADO & CONEXÃO SUPABASE
  // --------------------------------------------------------------------------
  function renderDashboardAdminSettingsTab(container) {
    const pay = PB.getPaymentSettings();
    const sb = PB.getSupabaseConfig();

    container.innerHTML = `
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Configuração Blindada do Meio de Pagamento -->
        <div class="rounded-2xl border border-amber-500/40 bg-background/90 p-6">
          <div class="flex items-center gap-2 text-amber-300">
            <i data-lucide="shield-check" class="h-5 w-5"></i>
            <h3 class="text-base font-extrabold text-white">Ponte do Meio de Pagamento (Blindado Admin)</h3>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            Protegido via RLS: somente o Administrador Supremo pode alterar a chave PIX ou URL de checkout externo para evitar desvios.
          </p>

          <form id="admin-payment-settings-form" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-bold uppercase text-muted-foreground">Chave PIX Oficial da Loja</label>
              <input id="ps-pix-key" type="text" maxlength="140" value="${PB.escapeHtml(pay.pixKey)}" class="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-white" />
            </div>
            <div>
              <label class="block font-bold uppercase text-muted-foreground">Nome do Recebedor (Titular)</label>
              <input id="ps-receiver" type="text" maxlength="80" value="${PB.escapeHtml(pay.pixReceiverName)}" class="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-white" />
            </div>
            <div>
              <label class="block font-bold uppercase text-muted-foreground">Link de Gateway Externo (MercadoPago / Stripe / Asaas - Opcional)</label>
              <input id="ps-ext-url" type="url" maxlength="300" placeholder="https://..." value="${PB.escapeHtml(pay.externalPaymentUrl || "")}" class="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-white" />
            </div>
            <button type="submit" class="glow-btn w-full rounded-xl bg-amber-500 py-3 font-black text-black hover:bg-amber-400">
              Salvar Configuração de Pagamento
            </button>
          </form>
        </div>

        <!-- Conexão com o Banco de Dados Supabase -->
        <div class="rounded-2xl border border-emerald-500/40 bg-background/90 p-6">
          <div class="flex items-center gap-2 text-emerald-400">
            <i data-lucide="database" class="h-5 w-5"></i>
            <h3 class="text-base font-extrabold text-white">Conexão Supabase (PostgreSQL + Realtime)</h3>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            O arquivo <code>supabase-schema.sql</code> na pasta do projeto já contém todas as tabelas e políticas RLS prontas para a sua conta <strong>DjKurohige01</strong>!
          </p>

          <form id="admin-supabase-config-form" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="block font-bold uppercase text-muted-foreground">Supabase Project URL</label>
              <input id="sb-url" type="url" maxlength="200" placeholder="https://xyzcompany.supabase.co" value="${PB.escapeHtml(sb.url || "")}" class="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-white" />
            </div>
            <div>
              <label class="block font-bold uppercase text-muted-foreground">Supabase Anon Public Key</label>
              <input id="sb-key" type="text" maxlength="400" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${PB.escapeHtml(sb.anonKey || "")}" class="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-white" />
            </div>
            <button type="submit" class="glow-btn w-full rounded-xl bg-emerald-500 py-3 font-black text-black hover:bg-emerald-400">
              Conectar / Salvar Credenciais Supabase
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById("admin-payment-settings-form").addEventListener("submit", (e) => {
      e.preventDefault();
      PB.updatePaymentSettings({
        pixKey: document.getElementById("ps-pix-key").value,
        pixReceiverName: document.getElementById("ps-receiver").value,
        pixDiscountPercent: 5,
        externalGatewayName: "PIX Instantâneo / Gateway Externo",
        externalPaymentUrl: document.getElementById("ps-ext-url").value,
      });
      if (typeof window.showToast === "function") {
        window.showToast("Configurações do meio de pagamento salvas com segurança!");
      }
      renderDashboardModal();
    });

    document.getElementById("admin-supabase-config-form").addEventListener("submit", (e) => {
      e.preventDefault();
      PB.saveSupabaseConfig(
        document.getElementById("sb-url").value,
        document.getElementById("sb-key").value
      );
      refreshAllAuthUI();
      if (typeof window.showToast === "function") {
        window.showToast("Credenciais do Supabase salvas!");
      }
      renderDashboardModal();
    });
  }

  // ==========================================================================
  // 8. INTEGRAÇÃO COM O CATÁLOGO E O CARRINHO DA PÁGINA PRINCIPAL
  // ==========================================================================
  let BaseCatalogBackup = null;

  function syncCatalogWithStore() {
    if (!window.PHOENIX_STORE_DATA) return;
    if (!BaseCatalogBackup) {
      BaseCatalogBackup = window.PHOENIX_STORE_DATA.products.map((p) => ({ ...p }));
    }
    const merged = PB.getMergedCatalogProducts(BaseCatalogBackup);
    window.PHOENIX_STORE_DATA.products.length = 0;
    merged.forEach((p) => window.PHOENIX_STORE_DATA.products.push(p));

    if (typeof window.renderAll === "function") {
      window.renderAll();
    }
    decorateProductCardsForStaff();
  }

  /**
   * Se o usuário logado for Vendedor ou Admin, adiciona um botão "✏️ Editar Preço/Estoque"
   * diretamente em cada card de produto na loja!
   */
  function decorateProductCardsForStaff() {
    const user = PB.getCurrentUser();
    const isStaff = user && ["seller", "admin"].includes(user.role);
    document.querySelectorAll(".staff-edit-product-btn").forEach((el) => el.remove());

    if (!isStaff) return;

    document.querySelectorAll("[data-add-cart]").forEach((addBtn) => {
      const pid = addBtn.getAttribute("data-add-cart");
      const card = addBtn.closest(".card-hover");
      if (!card) return;

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className =
        "staff-edit-product-btn mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-2 text-[11px] font-extrabold text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-black";
      editBtn.innerHTML = `✏️ Editar Preço / Estoque (${user.role === "admin" ? "Admin" : "Vendedor"})`;
      editBtn.addEventListener("click", () => openQuickEditProductModal(pid));

      card.appendChild(editBtn);
    });
  }

  /**
   * Adiciona no Drawer do Carrinho o botão principal:
   * "Finalizar & Pagar no Site (Ir para Pós-Compra & Chat Direto)"
   */
  function enhanceCartCheckoutDrawer() {
    const waBtn = document.getElementById("checkout-whatsapp-btn");
    const ignInput = document.getElementById("checkout-ign");
    if (!waBtn || !waBtn.parentElement) return;

    // Aplica maxlength de segurança contra injeção no input de IGN
    if (ignInput) {
      ignInput.setAttribute("maxlength", "60");
      const user = PB.getCurrentUser();
      if (user && user.ignDefault && !ignInput.value) {
        ignInput.value = user.ignDefault;
      }
    }

    if (document.getElementById("checkout-site-pay-btn")) return;

    const sitePayBtn = document.createElement("button");
    sitePayBtn.id = "checkout-site-pay-btn";
    sitePayBtn.type = "button";
    sitePayBtn.className =
      "glow-btn inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-black text-black hover:bg-emerald-400";
    sitePayBtn.innerHTML = `
      <i data-lucide="shield-check" class="h-4 w-4"></i>
      <span>Pagar & Abrir Chat Pós-Compra no Site</span>
    `;

    waBtn.parentElement.prepend(sitePayBtn);

    // Ajusta estilo do botão de WhatsApp para secundário abaixo do Checkout do Site
    waBtn.className =
      "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-xs font-bold text-primary-foreground hover:opacity-95";

    sitePayBtn.addEventListener("click", () => {
      if (!window.state || !window.state.cart || window.state.cart.length === 0) {
        if (typeof window.showToast === "function") {
          window.showToast("Adicione pelo menos 1 item ao carrinho primeiro!");
        }
        return;
      }

      const rawIgn = document.getElementById("checkout-ign").value.trim();
      const user = PB.getCurrentUser();
      const clientIgn = PB.sanitizeText(rawIgn || (user && user.ignDefault) || "", 60);

      if (!clientIgn) {
        document.getElementById("checkout-ign").focus();
        if (typeof window.showToast === "function") {
          window.showToast("Digite o nome do seu Personagem (IGN) para entregarmos no Hideout!");
        }
        return;
      }

      const paymentMethod = document.getElementById("checkout-payment").value;
      const isPix = paymentMethod.includes("PIX");
      const firstItem = window.state.cart[0];
      const gameName = firstItem?.game?.name || "Path of Exile 2";
      const gameId = firstItem?.game?.id || "poe2";
      const leagueName = firstItem?.league?.name || "Liga Atual — Softcore";

      let subtotal = 0;
      window.state.cart.forEach((item) => {
        const p = Number(item.product.pricePerUnit) || 0;
        if (p > 0) subtotal += p * item.qty;
      });
      const discount = isPix ? subtotal * 0.05 : 0;
      const total = subtotal - discount;

      openPaymentBridgeModal({
        clientIgn,
        paymentMethod,
        gameId,
        gameName,
        leagueName,
        cartItems: window.state.cart,
        subtotal,
        discount,
        total,
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function refreshAllAuthUI() {
    renderRoleSwitcherBar();
    renderHeaderUserArea();
    syncCatalogWithStore();
    enhanceCartCheckoutDrawer();
  }

  // Inicializa quando o DOM estiver pronto
  window.addEventListener("DOMContentLoaded", () => {
    // Aplica maxlength no campo de busca também por segurança
    const searchInp = document.getElementById("product-search");
    if (searchInp) searchInp.setAttribute("maxlength", "80");

    injectUIContainers();
    syncCatalogWithStore();
    enhanceCartCheckoutDrawer();

    // Se veio com ?openPanel=seller ou ?openPanel=admin da página de Pós-Compra, já abre o painel!
    const urlParams = new URLSearchParams(window.location.search);
    const openPanelParam = urlParams.get("openPanel");
    if (openPanelParam === "seller" || openPanelParam === "admin") {
      PB.quickSwitchRole(openPanelParam);
      refreshAllAuthUI();
      openDashboardModal();
    }

    // Re-decora os cards toda vez que o grid de produtos atualizar
    const grid = document.getElementById("products-grid");
    if (grid && typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(() => {
        decorateProductCardsForStaff();
      });
      mo.observe(grid, { childList: true });
    }

    // Escuta eventos em tempo real (nova venda paga, mensagem no chat, atualização de preço)
    PB.onRealtimeEvent((ev) => {
      if (ev.type === "NEW_ORDER_PAID") {
        PB.playNotificationSound();
        const user = PB.getCurrentUser();
        if (user && (user.role === "seller" || user.role === "admin")) {
          if (typeof window.showToast === "function") {
            window.showToast(
              `🔔 NOVA COMPRA PAGA (#${ev.payload.order.orderCode})! Cliente ${ev.payload.order.clientIgn} aguardando no Chat!`
            );
          }
        }
        refreshAllAuthUI();
        const dashModal = document.getElementById("phoenix-dashboard-modal");
        if (dashModal && !dashModal.classList.contains("hidden")) {
          renderDashboardModal();
        }
      } else if (ev.type === "NEW_CHAT_MESSAGE" || ev.type === "ORDER_STATUS_UPDATED") {
        PB.playNotificationSound();
        const dashModal = document.getElementById("phoenix-dashboard-modal");
        if (dashModal && !dashModal.classList.contains("hidden")) {
          renderDashboardModal();
        }
      } else if (ev.type === "CATALOG_UPDATED") {
        syncCatalogWithStore();
      }
    });
  });
})();
