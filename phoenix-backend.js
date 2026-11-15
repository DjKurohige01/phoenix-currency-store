/**
 * ============================================================================
 * PHOENIX STORE — MOTOR DE AUTENTICAÇÃO, PERFIS (RLS), PAGAMENTO & CHAT AO VIVO
 * ============================================================================
 * Perfis Suportados:
 * 1. 'client' (Cliente): Cadastra sem cartão, realiza compras, acompanha pedido e
 *    conversa no Chat Direto Pós-Compra com o Vendedor ou Administrador.
 * 2. 'seller' (Vendedor): Funcionário do Admin. Pode alterar preços, quantidades e
 *    status de estoque do catálogo, recebe avisos de novas compras em tempo real,
 *    atende clientes no Chat do Pedido e vê APENAS as vendas que ELE mesmo fez.
 *    (Sem acesso à base geral de clientes, sem balanço global da loja e sem mexer no pagamento).
 * 3. 'admin'  (Administrador): Dono da loja com permissões supremas. Acesso total ao
 *    balanço financeiro, histórico completo de compras de todos os vendedores, base de
 *    clientes/equipe, catálogo completo, todos os chats e configuração de pagamento/Supabase.
 * ============================================================================
 */

(function () {
  const STORAGE_KEYS = {
    USERS: "phoenix_store_users_v1",
    SESSION: "phoenix_store_session_v1",
    PRODUCT_OVERRIDES: "phoenix_store_product_overrides_v1",
    CUSTOM_PRODUCTS: "phoenix_store_custom_products_v1",
    ORDERS: "phoenix_store_orders_v1",
    MESSAGES: "phoenix_store_messages_v1",
    PAYMENT_SETTINGS: "phoenix_store_payment_settings_v1",
    SUPABASE_CONFIG: "phoenix_store_supabase_config_v1",
  };

  // Limites rígidos de caracteres (Recomendação de Segurança contra XSS / Injeção)
  const CHAR_LIMITS = {
    name: 60,
    email: 100,
    password: 64,
    ign: 60,
    whatsapp: 30,
    chatMessage: 500,
    stockStatus: 80,
    productName: 100,
    productSubtitle: 220,
    pixKey: 140,
    gatewayUrl: 300,
  };

  /**
   * Sanitiza texto removendo tags HTML/scripts e aplicando limite estrito de caracteres
   */
  function sanitizeText(input, maxLen = 100) {
    if (input === null || input === undefined) return "";
    const raw = String(input)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/javascript:/gi, "")
      .trim();
    return raw.slice(0, maxLen);
  }

  /**
   * Escapa caracteres especiais HTML para renderização segura no DOM
   */
  function escapeHtml(input) {
    if (input === null || input === undefined) return "";
    return String(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeJsonParse(str, fallback) {
    try {
      return str ? JSON.parse(str) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  // Canal de sincronização em tempo real entre abas (ex: aba Pós-Compra <-> aba Vendedor/Admin)
  let broadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      broadcastChannel = new BroadcastChannel("phoenix_store_realtime_v1");
    }
  } catch (_) {}

  const listeners = new Set();
  function notifyListeners(eventPayload) {
    listeners.forEach((fn) => {
      try {
        fn(eventPayload);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function emitRealtimeEvent(type, payload = {}) {
    const eventObj = { type, payload, timestamp: Date.now() };
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(eventObj);
      } catch (_) {}
    }
    if (supabaseRealtimeChannel) {
      try {
        supabaseRealtimeChannel.send({
          type: "broadcast",
          event: "store-event",
          payload: eventObj,
        });
      } catch (_) {}
    }
    notifyListeners(eventObj);
  }

  if (broadcastChannel) {
    broadcastChannel.onmessage = (event) => {
      if (event && event.data) {
        notifyListeners(event.data);
      }
    };
  }

  window.addEventListener("storage", (e) => {
    if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
      notifyListeners({ type: "STORAGE_SYNC", key: e.key, timestamp: Date.now() });
    }
  });

  // ==========================================================================
  // DADOS INICIAIS (SEED) PARA DEMONSTRAÇÃO IMEDIATA DOS 3 PERFIS
  // ==========================================================================
  const DEFAULT_USERS = [
    {
      id: "usr-admin-01",
      fullName: "Rafa & Denner (Admin)",
      email: "dennerinfo@gmail.com",
      passwordHash: "admin123",
      ignDefault: "PhoenixBoss_PoE",
      whatsapp: "+55 47 8888-1427",
      role: "admin",
      createdAt: "2026-11-10T12:00:00Z",
    },
    {
      id: "usr-seller-01",
      fullName: "Lucas — Vendedor #01",
      email: "vendedor@phoenixstore.com",
      passwordHash: "vendedor123",
      ignDefault: "PhoenixTrader_01",
      whatsapp: "+55 47 9999-1111",
      role: "seller",
      createdAt: "2026-11-11T14:20:00Z",
    },
    {
      id: "usr-seller-02",
      fullName: "Mateus — Vendedor #02",
      email: "vendedor2@phoenixstore.com",
      passwordHash: "vendedor123",
      ignDefault: "PhoenixTrader_02",
      whatsapp: "+55 47 9999-2222",
      role: "seller",
      createdAt: "2026-11-12T16:00:00Z",
    },
    {
      id: "usr-client-01",
      fullName: "Exiled Player (Cliente)",
      email: "cliente@phoenixstore.com",
      passwordHash: "cliente123",
      ignDefault: "ExiledMonk_BR",
      whatsapp: "+55 11 98888-7777",
      role: "client",
      createdAt: "2026-11-14T18:30:00Z",
    },
    {
      id: "usr-client-02",
      fullName: "Gabriel Silva",
      email: "gabriel.poe@gmail.com",
      passwordHash: "cliente123",
      ignDefault: "Deadeye_Gabriel",
      whatsapp: "+55 21 97777-6666",
      role: "client",
      createdAt: "2026-11-15T10:15:00Z",
    },
  ];

  const DEFAULT_PAYMENT_SETTINGS = {
    pixKey: "pix@phoenixstore.com.br",
    pixReceiverName: "PHOENIX STORE OFICIAL",
    pixDiscountPercent: 5,
    externalGatewayName: "Gateway Externo / PIX Instantâneo",
    externalPaymentUrl: "",
    webhookSecret: "whsec_phoenix_live_98a7bc",
    updatedAt: "2026-11-15T18:00:00Z",
  };

  const DEFAULT_ORDERS = [
    {
      id: "ord-demo-1001",
      orderCode: "PHX-9041",
      clientId: "usr-client-01",
      clientName: "Exiled Player (Cliente)",
      clientEmail: "cliente@phoenixstore.com",
      clientIgn: "ExiledMonk_BR",
      gameId: "poe2",
      gameName: "Path of Exile 2",
      leagueName: "Liga Atual — Softcore",
      items: [
        {
          productId: "poe2-divine-orb",
          name: "Divine Orb",
          unitLabel: "1x Divine Orb",
          qty: 20,
          pricePerUnit: 4.5,
          lineTotal: 90.0,
        },
        {
          productId: "poe2-exalted-orb-pack",
          name: "Exalted Orb (Pacote 10x)",
          unitLabel: "Pacote c/ 10x Exalted Orbs",
          qty: 5,
          pricePerUnit: 6.9,
          lineTotal: 34.5,
        },
      ],
      subtotal: 124.5,
      discount: 6.23,
      total: 118.27,
      paymentMethod: "PIX (5% OFF)",
      paymentStatus: "paid",
      paymentReference: "PIX-TX-883920",
      deliveryStatus: "in_hideout",
      sellerId: "usr-seller-01",
      sellerName: "Lucas — Vendedor #01",
      createdAt: "2026-11-15T17:40:00Z",
      deliveredAt: null,
    },
    {
      id: "ord-demo-1002",
      orderCode: "PHX-9038",
      clientId: "usr-client-02",
      clientName: "Gabriel Silva",
      clientEmail: "gabriel.poe@gmail.com",
      clientIgn: "Deadeye_Gabriel",
      gameId: "poe2",
      gameName: "Path of Exile 2",
      leagueName: "Liga Atual — Softcore",
      items: [
        {
          productId: "poe2-service-ascendancy-carry",
          name: "Ascendancy Carry (1ª à 4ª Ascendancy)",
          unitLabel: "1x Run Completa",
          qty: 1,
          pricePerUnit: 39.9,
          lineTotal: 39.9,
        },
      ],
      subtotal: 39.9,
      discount: 2.0,
      total: 37.9,
      paymentMethod: "PIX (5% OFF)",
      paymentStatus: "paid",
      paymentReference: "PIX-TX-883110",
      deliveryStatus: "delivered",
      sellerId: "usr-seller-01",
      sellerName: "Lucas — Vendedor #01",
      createdAt: "2026-11-15T15:10:00Z",
      deliveredAt: "2026-11-15T15:24:00Z",
    },
    {
      id: "ord-demo-1003",
      orderCode: "PHX-9025",
      clientId: "usr-client-02",
      clientName: "Gabriel Silva",
      clientEmail: "gabriel.poe@gmail.com",
      clientIgn: "RighteousFire_BR",
      gameId: "poe1",
      gameName: "Path of Exile 1",
      leagueName: "Liga Atual — Softcore",
      items: [
        {
          productId: "poe1-divine-orb",
          name: "Divine Orb (PoE 1)",
          unitLabel: "1x Divine Orb",
          qty: 100,
          pricePerUnit: 1.8,
          lineTotal: 180.0,
        },
      ],
      subtotal: 180.0,
      discount: 9.0,
      total: 171.0,
      paymentMethod: "PIX (5% OFF)",
      paymentStatus: "paid",
      paymentReference: "PIX-TX-882004",
      deliveryStatus: "delivered",
      sellerId: "usr-seller-02",
      sellerName: "Mateus — Vendedor #02",
      createdAt: "2026-11-15T13:00:00Z",
      deliveredAt: "2026-11-15T13:09:00Z",
    },
    {
      id: "ord-demo-1004",
      orderCode: "PHX-9045",
      clientId: "usr-client-01",
      clientName: "Exiled Player (Cliente)",
      clientEmail: "cliente@phoenixstore.com",
      clientIgn: "ExiledMonk_BR",
      gameId: "poe2",
      gameName: "Path of Exile 2",
      leagueName: "Liga Atual — Softcore",
      items: [
        {
          productId: "poe2-gold-pack",
          name: "Pacote de Gold (500k Ouro)",
          unitLabel: "500.000 Gold",
          qty: 2,
          pricePerUnit: 14.9,
          lineTotal: 29.8,
        },
      ],
      subtotal: 29.8,
      discount: 1.49,
      total: 28.31,
      paymentMethod: "PIX (5% OFF)",
      paymentStatus: "paid",
      paymentReference: "PIX-TX-884501",
      deliveryStatus: "paid_waiting_seller",
      sellerId: null,
      sellerName: null,
      createdAt: "2026-11-15T18:55:00Z",
      deliveredAt: null,
    },
  ];

  const DEFAULT_MESSAGES = [
    {
      id: "msg-1",
      orderId: "ord-demo-1001",
      orderCode: "PHX-9041",
      senderId: "system",
      senderName: "Sistema PhoenixStore",
      senderRole: "system",
      message:
        "Pagamento confirmado! Bem-vindo ao Chat Direto de Entrega. Um vendedor ou administrador já foi notificado para entregar no seu Hideout.",
      createdAt: "2026-11-15T17:40:05Z",
    },
    {
      id: "msg-2",
      orderId: "ord-demo-1001",
      orderCode: "PHX-9041",
      senderId: "usr-client-01",
      senderName: "Exiled Player (Cliente)",
      senderRole: "client",
      message: "Opa! Já estou online no meu Hideout. Meu personagem é ExiledMonk_BR.",
      createdAt: "2026-11-15T17:41:10Z",
    },
    {
      id: "msg-3",
      orderId: "ord-demo-1001",
      orderCode: "PHX-9041",
      senderId: "usr-seller-01",
      senderName: "Lucas — Vendedor #01",
      senderRole: "seller",
      message:
        "Show! Assumi seu pedido #PHX-9041. Já separei os 20 Divine Orbs + 50 Exalted Orbs e estou te mandando Party in-game agora! Lembra de colocar 1 item raro amarelo qualquer na janela de trade.",
      createdAt: "2026-11-15T17:42:00Z",
    },
    {
      id: "msg-4",
      orderId: "ord-demo-1004",
      orderCode: "PHX-9045",
      senderId: "system",
      senderName: "Sistema PhoenixStore",
      senderRole: "system",
      message:
        "Pagamento confirmado para o pedido #PHX-9045! Nossa equipe de vendedores já recebeu o alerta sonoro e vai te chamar aqui em instantes.",
      createdAt: "2026-11-15T18:55:02Z",
    },
  ];

  function ensureSeedData() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENT_SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.PAYMENT_SETTINGS, JSON.stringify(DEFAULT_PAYMENT_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(DEFAULT_MESSAGES));
    }

    // Se o usuário entrou pelo link de experiência real de cliente (?visao=cliente ou ?cliente=1),
    // limpa qualquer sessão anterior de Admin/Vendedor para simular um visitante real vindo do Google
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("visao") === "cliente" || urlParams.get("cliente") === "1") {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        sessionStorage.setItem("phoenix_pure_customer_mode", "1");
      } else if (urlParams.get("openPanel") || urlParams.get("painel") === "equipe") {
        sessionStorage.removeItem("phoenix_pure_customer_mode");
      }
    } catch (_) {}
  }

  ensureSeedData();

  // ==========================================================================
  // CONEXÃO SUPABASE OFICIAL (CONECTADO AO PROJETO: vzwuhkjspssqbstblloa)
  // Organização: DjKurohige01's Org (sa-east-1 • São Paulo)
  // ==========================================================================
  const DEFAULT_SUPABASE_CONFIG = {
    url: "https://vzwuhkjspssqbstblloa.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6d3Voa2pzcHNzcWJzdGJsbG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NzgxODYsImV4cCI6MjExMDM1NDE4Nn0.jlfnIG8Qs8x5tgjbTyXdatSSPQXyv0N6LYQCjH83Y2E",
    publishableKey: "sb_publishable_ySKxC7mYFDH4iUCvpFonnA_DMwCrKJN",
    projectId: "vzwuhkjspssqbstblloa",
    orgName: "DjKurohige01's Org",
    region: "sa-east-1 (São Paulo)",
    connected: true,
  };

  let supabaseClient = null;
  let supabaseRealtimeChannel = null;

  function getSupabaseConfig() {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG), null);
    if (saved && saved.url && saved.anonKey) {
      return { ...DEFAULT_SUPABASE_CONFIG, ...saved, connected: true };
    }
    return DEFAULT_SUPABASE_CONFIG;
  }

  function initSupabaseIfConfigured() {
    const cfg = getSupabaseConfig();
    if (cfg && cfg.url && cfg.anonKey && window.supabase && typeof window.supabase.createClient === "function") {
      try {
        supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);

        // Canal Realtime no Supabase para sincronizar eventos entre máquinas diferentes
        try {
          supabaseRealtimeChannel = supabaseClient
            .channel("phoenix-store-live")
            .on("broadcast", { event: "store-event" }, (msg) => {
              const ev = msg && msg.payload;
              if (!ev) return;
              if (ev.type === "NEW_ORDER_PAID" && ev.payload && ev.payload.order) {
                const orders = getAllOrdersInternal();
                if (!orders.some((o) => o.orderCode === ev.payload.order.orderCode)) {
                  orders.unshift(ev.payload.order);
                  saveAllOrdersInternal(orders);
                }
              } else if (ev.type === "NEW_CHAT_MESSAGE" && ev.payload && ev.payload.message) {
                const messages = getAllMessagesInternal();
                if (!messages.some((m) => m.id === ev.payload.message.id)) {
                  messages.push(ev.payload.message);
                  saveAllMessagesInternal(messages);
                }
              } else if (ev.type === "ORDER_STATUS_UPDATED" && ev.payload && ev.payload.orderCode) {
                const orders = getAllOrdersInternal();
                const idx = orders.findIndex((o) => o.orderCode === ev.payload.orderCode);
                if (idx >= 0) {
                  orders[idx].deliveryStatus = ev.payload.deliveryStatus;
                  if (ev.payload.sellerName) orders[idx].sellerName = ev.payload.sellerName;
                  saveAllOrdersInternal(orders);
                }
              }
              notifyListeners(ev);
            })
            .subscribe();
        } catch (_) {}

        // Sincroniza preços e estoques salvos na tabela public.products do Supabase
        supabaseClient
          .from("products")
          .select("id, price_per_unit, min_qty, stock_status, custom_price_label, badge")
          .then(({ data, error }) => {
            if (!error && Array.isArray(data) && data.length > 0) {
              const overrides = getProductOverrides();
              data.forEach((row) => {
                if (!overrides[row.id]) {
                  overrides[row.id] = {
                    pricePerUnit: Number(row.price_per_unit),
                    minQty: row.min_qty || 1,
                    stockStatus: row.stock_status || "Em Estoque",
                    customPriceLabel: row.custom_price_label || null,
                    badge: row.badge || null,
                  };
                }
              });
              localStorage.setItem(STORAGE_KEYS.PRODUCT_OVERRIDES, JSON.stringify(overrides));
              notifyListeners({ type: "CATALOG_UPDATED", timestamp: Date.now() });
            }
          })
          .catch(() => {});

        return true;
      } catch (err) {
        console.warn("Erro ao iniciar cliente Supabase:", err);
      }
    }
    supabaseClient = null;
    return false;
  }

  initSupabaseIfConfigured();

  function saveSupabaseConfig(url, anonKey) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Acesso negado: Apenas o Administrador pode configurar a conexão do banco Supabase.");
    }
    const cleanUrl = sanitizeText(url, 200);
    const cleanKey = sanitizeText(anonKey, 400);
    const cfg = {
      url: cleanUrl,
      anonKey: cleanKey,
      connected: Boolean(cleanUrl && cleanKey),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(cfg));
    initSupabaseIfConfigured();
    emitRealtimeEvent("SUPABASE_CONFIG_UPDATED", cfg);
    return cfg;
  }

  // ==========================================================================
  // AUTENTICAÇÃO E GESTÃO DE PERFIS (CLIENTE / VENDEDOR / ADMIN)
  // ==========================================================================
  function getAllUsersInternal() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.USERS), DEFAULT_USERS);
  }

  function getCurrentUser() {
    const session = safeJsonParse(localStorage.getItem(STORAGE_KEYS.SESSION), null);
    if (!session) return null;
    const users = getAllUsersInternal();
    const fresh = users.find((u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase());
    return fresh || session;
  }

  function setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    } else {
      const safeUser = { ...user };
      delete safeUser.passwordHash;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(safeUser));
    }
    emitRealtimeEvent("AUTH_CHANGED", { user: getCurrentUser() });
  }

  /**
   * Troca rápida de perfil para demonstração / testes em 1 clique
   */
  function quickSwitchRole(role) {
    const users = getAllUsersInternal();
    const target = users.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
      return target;
    }
    return null;
  }

  function loginWithEmail(email, password) {
    const cleanEmail = sanitizeText(email, CHAR_LIMITS.email).toLowerCase();
    const cleanPass = sanitizeText(password, CHAR_LIMITS.password);

    if (!cleanEmail || !cleanPass) {
      throw new Error("Preencha seu e-mail e senha para entrar.");
    }

    const users = getAllUsersInternal();
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user || (user.passwordHash && user.passwordHash !== cleanPass)) {
      throw new Error("E-mail ou senha incorretos.");
    }

    setCurrentUser(user);
    return getCurrentUser();
  }

  /**
   * Cadastro de Cliente (Sem cartão de crédito — apenas dados básicos para entrega in-game)
   */
  function registerClient({ fullName, email, password, ignDefault, whatsapp }) {
    const cleanName = sanitizeText(fullName, CHAR_LIMITS.name);
    const cleanEmail = sanitizeText(email, CHAR_LIMITS.email).toLowerCase();
    const cleanPass = sanitizeText(password, CHAR_LIMITS.password);
    const cleanIgn = sanitizeText(ignDefault, CHAR_LIMITS.ign);
    const cleanWhatsapp = sanitizeText(whatsapp, CHAR_LIMITS.whatsapp);

    if (cleanName.length < 2) {
      throw new Error("Informe seu nome ou apelido (mínimo 2 caracteres).");
    }
    if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
      throw new Error("Informe um e-mail válido.");
    }
    if (cleanPass.length < 4) {
      throw new Error("A senha deve ter pelo menos 4 caracteres.");
    }

    const users = getAllUsersInternal();
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error("Este e-mail já está cadastrado. Faça login na aba Entrar.");
    }

    const newUser = {
      id: "usr-client-" + Date.now().toString(36),
      fullName: cleanName,
      email: cleanEmail,
      passwordHash: cleanPass,
      ignDefault: cleanIgn,
      whatsapp: cleanWhatsapp,
      role: "client", // Sempre cliente no auto-cadastro
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    setCurrentUser(newUser);
    return getCurrentUser();
  }

  /**
   * Lista de usuários — PROTEGIDO POR RLS:
   * - Vendedor NÃO tem acesso à base de clientes (retorna erro/vazio).
   * - Apenas Administrador tem acesso à base completa de clientes e vendedores.
   */
  function getUsersForAdmin() {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error("Acesso Restrito (RLS): Apenas o Administrador tem acesso à base de clientes e usuários.");
    }
    return getAllUsersInternal().map((u) => {
      const copy = { ...u };
      delete copy.passwordHash;
      return copy;
    });
  }

  function updateUserRoleByAdmin(userId, newRole) {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error("Acesso negado: Apenas o Administrador pode alterar permissões de usuários.");
    }
    if (!["client", "seller", "admin"].includes(newRole)) {
      throw new Error("Perfil inválido.");
    }
    const users = getAllUsersInternal();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("Usuário não encontrado.");
    users[idx].role = newRole;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    emitRealtimeEvent("USERS_UPDATED", { userId, newRole });
    return users[idx];
  }

  function createStaffUserByAdmin({ fullName, email, password, role, ignDefault }) {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error("Acesso negado: Apenas o Administrador pode cadastrar vendedores ou administradores.");
    }
    const cleanName = sanitizeText(fullName, CHAR_LIMITS.name);
    const cleanEmail = sanitizeText(email, CHAR_LIMITS.email).toLowerCase();
    const cleanPass = sanitizeText(password || "phoenix123", CHAR_LIMITS.password);
    const cleanIgn = sanitizeText(ignDefault || "PhoenixStaff", CHAR_LIMITS.ign);
    const validRole = ["seller", "admin", "client"].includes(role) ? role : "seller";

    if (!cleanName || !cleanEmail.includes("@")) {
      throw new Error("Preencha o nome e um e-mail válido para o funcionário.");
    }

    const users = getAllUsersInternal();
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error("Já existe um usuário com este e-mail.");
    }

    const staff = {
      id: `usr-${validRole}-` + Date.now().toString(36),
      fullName: cleanName,
      email: cleanEmail,
      passwordHash: cleanPass,
      ignDefault: cleanIgn,
      whatsapp: "",
      role: validRole,
      createdAt: new Date().toISOString(),
    };
    users.push(staff);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    emitRealtimeEvent("USERS_UPDATED", { userId: staff.id, newRole: validRole });
    return staff;
  }

  /**
   * Permite que o Administrador Supremo exclua qualquer usuário (Cliente, Vendedor ou outro Admin),
   * protegendo apenas contra a exclusão da própria conta em que ele está logado no momento.
   */
  function deleteUserByAdmin(userId) {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error("Acesso negado: Apenas o Administrador pode excluir usuários.");
    }
    if (userId === current.id) {
      throw new Error("Você não pode excluir a própria conta de Administrador em que está conectado no momento.");
    }

    const users = getAllUsersInternal();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      throw new Error("Usuário não encontrado.");
    }

    const filtered = users.filter((u) => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));

    if (supabaseClient) {
      supabaseClient
        .from("profiles")
        .delete()
        .eq("id", userId)
        .then(() => {})
        .catch(() => {});
    }

    emitRealtimeEvent("USERS_UPDATED", { deletedUserId: userId, deletedName: target.fullName });
    return target;
  }

  // ==========================================================================
  // GESTÃO DE PREÇOS, QUANTIDADES E CATÁLOGO (PERMITIDO PARA VENDEDOR E ADMIN)
  // ==========================================================================
  function getProductOverrides() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.PRODUCT_OVERRIDES), {});
  }

  function getCustomProducts() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.CUSTOM_PRODUCTS), []);
  }

  function getMergedCatalogProducts(baseProducts) {
    const overrides = getProductOverrides();
    const custom = getCustomProducts();
    const all = [...baseProducts, ...custom];
    return all
      .map((p) => {
        const ov = overrides[p.id];
        if (!ov) return { ...p };
        return {
          ...p,
          ...ov,
        };
      })
      .filter((p) => p.active !== false);
  }

  /**
   * Vendedor ('seller') e Administrador ('admin') podem editar preços,
   * quantidades mínimas e status de estoque dos produtos!
   */
  function updateProductPricingAndStock(productId, { pricePerUnit, minQty, stockStatus, customPriceLabel, badge }) {
    const current = getCurrentUser();
    if (!current || !["seller", "admin"].includes(current.role)) {
      throw new Error("Permissão negada: Apenas Vendedores e Administradores podem editar preços e estoque.");
    }

    const overrides = getProductOverrides();
    const numPrice = Number(pricePerUnit);
    const validPrice = isNaN(numPrice) || numPrice < 0 ? 0 : Number(numPrice.toFixed(2));
    const numMinQty = Math.max(1, parseInt(minQty, 10) || 1);
    const cleanStock = sanitizeText(stockStatus || "Em Estoque", CHAR_LIMITS.stockStatus);
    const cleanCustomLabel = customPriceLabel
      ? sanitizeText(customPriceLabel, 40)
      : validPrice === 0
      ? "Sob Consulta"
      : null;

    overrides[productId] = {
      ...(overrides[productId] || {}),
      pricePerUnit: validPrice,
      minQty: numMinQty,
      stockStatus: cleanStock,
      customPriceLabel: cleanCustomLabel,
      ...(badge !== undefined ? { badge: badge ? sanitizeText(badge, 40) : null } : {}),
      updatedBy: current.fullName,
      updatedByRole: current.role,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.PRODUCT_OVERRIDES, JSON.stringify(overrides));
    emitRealtimeEvent("CATALOG_UPDATED", { productId, updatedBy: current.fullName });
    return overrides[productId];
  }

  function addCustomProduct({
    gameId,
    categoryId,
    name,
    subtitle,
    unitLabel,
    pricePerUnit,
    minQty,
    stockStatus,
    badge,
    iconFile,
  }) {
    const current = getCurrentUser();
    if (!current || !["seller", "admin"].includes(current.role)) {
      throw new Error("Permissão negada: Apenas Vendedores e Administradores podem adicionar itens ao catálogo.");
    }
    const cleanName = sanitizeText(name, CHAR_LIMITS.productName);
    if (!cleanName) throw new Error("Informe o nome do produto/currency/service.");

    const numPrice = Math.max(0, Number(pricePerUnit) || 0);
    const newProd = {
      id: `${sanitizeText(gameId, 20)}-${Date.now().toString(36)}`,
      gameId: sanitizeText(gameId || "poe2", 20),
      categoryId: ["currency", "services", "items"].includes(categoryId) ? categoryId : "currency",
      name: cleanName,
      subtitle: sanitizeText(subtitle || "Entrega rápida e segura no seu Hideout.", CHAR_LIMITS.productSubtitle),
      unitLabel: sanitizeText(unitLabel || "1x Unidade", 50),
      badge: badge ? sanitizeText(badge, 35) : "Novo",
      featured: true,
      pricePerUnit: Number(numPrice.toFixed(2)),
      customPriceLabel: numPrice <= 0 ? "Sob Consulta" : null,
      minQty: Math.max(1, parseInt(minQty, 10) || 1),
      stepQty: 1,
      quickPresets: [1, 5, 10, 20],
      stockStatus: sanitizeText(stockStatus || "Estoque Imediato", CHAR_LIMITS.stockStatus),
      iconFile: iconFile || (gameId === "poe1" ? "poe1-divine.png" : "poe2-divine.png"),
      rarityColor: "orange",
      highlights: [
        "Trade seguro no seu Hideout",
        "Atendimento direto no Chat Pós-Compra",
      ],
      createdBy: current.fullName,
      createdAt: new Date().toISOString(),
    };

    const customList = getCustomProducts();
    customList.push(newProd);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PRODUCTS, JSON.stringify(customList));
    emitRealtimeEvent("CATALOG_UPDATED", { productId: newProd.id, updatedBy: current.fullName });
    return newProd;
  }

  // ==========================================================================
  // CONFIGURAÇÃO DO MEIO DE PAGAMENTO (EXCLUSIVO ADMIN — BLINDADO CONTRA VENDEDOR/CLIENTE)
  // ==========================================================================
  function getPaymentSettings() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.PAYMENT_SETTINGS), DEFAULT_PAYMENT_SETTINGS);
  }

  function updatePaymentSettings({ pixKey, pixReceiverName, pixDiscountPercent, externalGatewayName, externalPaymentUrl }) {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error(
        "Segurança RLS: Apenas o Administrador Supremo pode alterar a chave PIX ou configurações do meio de pagamento."
      );
    }

    const currentSettings = getPaymentSettings();
    const updated = {
      ...currentSettings,
      pixKey: sanitizeText(pixKey, CHAR_LIMITS.pixKey) || currentSettings.pixKey,
      pixReceiverName: sanitizeText(pixReceiverName, 80) || currentSettings.pixReceiverName,
      pixDiscountPercent: Math.min(50, Math.max(0, Number(pixDiscountPercent) || 0)),
      externalGatewayName: sanitizeText(externalGatewayName, 80) || currentSettings.externalGatewayName,
      externalPaymentUrl: sanitizeText(externalPaymentUrl, CHAR_LIMITS.gatewayUrl),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.PAYMENT_SETTINGS, JSON.stringify(updated));
    emitRealtimeEvent("PAYMENT_SETTINGS_UPDATED", updated);
    return updated;
  }

  // ==========================================================================
  // PEDIDOS / COMPRAS & REGRAS ESTRITAS DE VISIBILIDADE (RLS)
  // ==========================================================================
  function getAllOrdersInternal() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.ORDERS), DEFAULT_ORDERS);
  }

  function saveAllOrdersInternal(orders) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  /**
   * Retorna os pedidos respeitando rigorosamente o perfil logado (RLS):
   * - 'admin': Vê TODOS os pedidos da loja inteira.
   * - 'seller': Vê APENAS:
   *     1. Pedidos pagos na fila sem vendedor atribuído (`sellerId === null`) para poder assumir a entrega.
   *     2. As vendas que ELE mesmo realizou/assumiu (`sellerId === current.id`).
   *     (NÃO vê vendas de outros vendedores!)
   * - 'client': Vê APENAS os pedidos que ele mesmo comprou (`clientId === current.id`).
   */
  function getVisibleOrdersForCurrentUser() {
    const current = getCurrentUser();
    const allOrders = getAllOrdersInternal();
    if (!current) return [];

    if (current.role === "admin") {
      return [...allOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (current.role === "seller") {
      return allOrders
        .filter((o) => o.sellerId === current.id || (o.sellerId === null && o.paymentStatus === "paid"))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Cliente
    return allOrders
      .filter((o) => o.clientId === current.id || (current.email && o.clientEmail === current.email))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Busca um pedido específico por código (ex: PHX-9041) ou ID para a página de Pós-Compra
   */
  function getOrderByCodeOrId(codeOrId) {
    if (!codeOrId) return null;
    const clean = sanitizeText(codeOrId, 50).toUpperCase();
    const allOrders = getAllOrdersInternal();
    return (
      allOrders.find(
        (o) =>
          (o.orderCode && o.orderCode.toUpperCase() === clean) ||
          (o.id && o.id.toUpperCase() === clean)
      ) || null
    );
  }

  /**
   * Cria um novo pedido após confirmação da Ponte de Meio de Pagamento
   * e dispara alerta em tempo real para os Vendedores e Administrador!
   */
  function createPaidOrder({
    clientIgn,
    paymentMethod,
    gameId,
    gameName,
    leagueName,
    cartItems,
    subtotal,
    discount,
    total,
    paymentReference,
  }) {
    let current = getCurrentUser();
    const cleanIgn = sanitizeText(clientIgn, CHAR_LIMITS.ign);
    if (!cleanIgn) {
      throw new Error("Informe o nome do seu personagem (IGN) para receber a entrega no Hideout.");
    }

    if (!current) {
      current = DEFAULT_USERS.find((u) => u.role === "client") || DEFAULT_USERS[3];
      setCurrentUser(current);
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `PHX-${randomNum}`;
    const orderId = "ord-" + Date.now().toString(36);

    const formattedItems = (cartItems || []).map((item) => ({
      productId: item.product.id,
      name: sanitizeText(item.product.name, 100),
      unitLabel: sanitizeText(item.product.unitLabel, 60),
      qty: Math.max(1, parseInt(item.qty, 10) || 1),
      pricePerUnit: Number(item.product.pricePerUnit) || 0,
      lineTotal: (Number(item.product.pricePerUnit) || 0) * (parseInt(item.qty, 10) || 1),
    }));

    const newOrder = {
      id: orderId,
      orderCode,
      clientId: current.id,
      clientName: sanitizeText(current.fullName, CHAR_LIMITS.name),
      clientEmail: sanitizeText(current.email, CHAR_LIMITS.email),
      clientIgn: cleanIgn,
      gameId: sanitizeText(gameId || "poe2", 30),
      gameName: sanitizeText(gameName || "Path of Exile 2", 60),
      leagueName: sanitizeText(leagueName || "Liga Atual — Softcore", 80),
      items: formattedItems,
      subtotal: Number((Number(subtotal) || 0).toFixed(2)),
      discount: Number((Number(discount) || 0).toFixed(2)),
      total: Number((Number(total) || 0).toFixed(2)),
      paymentMethod: sanitizeText(paymentMethod || "PIX (5% OFF)", 50),
      paymentStatus: "paid",
      paymentReference: sanitizeText(paymentReference || `PIX-${Date.now().toString().slice(-6)}`, 80),
      deliveryStatus: "paid_waiting_seller",
      sellerId: null,
      sellerName: null,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
    };

    const allOrders = getAllOrdersInternal();
    allOrders.unshift(newOrder);
    saveAllOrdersInternal(allOrders);

    // Cria mensagem automática de boas-vindas no Chat Direto Pós-Compra
    const welcomeMsg = {
      id: "msg-" + Date.now().toString(36),
      orderId: newOrder.id,
      orderCode: newOrder.orderCode,
      senderId: "system",
      senderName: "Sistema PhoenixStore",
      senderRole: "system",
      message: `Pagamento confirmado com sucesso! Pedido #${newOrder.orderCode} registrado para o personagem "${newOrder.clientIgn}" (${newOrder.gameName} • ${newOrder.leagueName}). Nossos vendedores e o administrador acabaram de receber o aviso sonoro e já vão falar com você aqui no chat!`,
      createdAt: new Date().toISOString(),
    };

    const allMessages = getAllMessagesInternal();
    allMessages.push(welcomeMsg);
    saveAllMessagesInternal(allMessages);

    emitRealtimeEvent("NEW_ORDER_PAID", { order: newOrder });
    return newOrder;
  }

  /**
   * Vendedor ou Administrador assume o pedido ou atualiza o status de entrega
   */
  function updateOrderStatus(orderCodeOrId, newDeliveryStatus) {
    const current = getCurrentUser();
    if (!current || !["seller", "admin"].includes(current.role)) {
      throw new Error("Apenas Vendedores ou Administradores podem atualizar o status de entrega.");
    }

    const validStatuses = [
      "awaiting_payment",
      "paid_waiting_seller",
      "seller_assigned",
      "in_hideout",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(newDeliveryStatus)) {
      throw new Error("Status de entrega inválido.");
    }

    const allOrders = getAllOrdersInternal();
    const idx = allOrders.findIndex(
      (o) => o.orderCode === orderCodeOrId || o.id === orderCodeOrId
    );
    if (idx === -1) throw new Error("Pedido não encontrado.");

    const order = allOrders[idx];

    // Regra RLS Vendedor: Vendedor não pode mexer em pedido de outro vendedor
    if (current.role === "seller" && order.sellerId && order.sellerId !== current.id) {
      throw new Error("Este pedido já está sendo atendido por outro vendedor.");
    }

    if (!order.sellerId) {
      order.sellerId = current.id;
      order.sellerName = current.fullName;
    }

    order.deliveryStatus = newDeliveryStatus;
    if (newDeliveryStatus === "delivered") {
      order.deliveredAt = new Date().toISOString();
    }

    allOrders[idx] = order;
    saveAllOrdersInternal(allOrders);

    const statusLabels = {
      paid_waiting_seller: "Aguardando Vendedor",
      seller_assigned: `${current.fullName} assumiu sua entrega e está separando os itens no Stash!`,
      in_hideout: `${current.fullName} já está no Hideout e enviou Party in-game para ${order.clientIgn}!`,
      delivered: `Entrega concluída no Hideout por ${current.fullName}! Bom jogo, Exile!`,
      cancelled: `Pedido marcado como cancelado.`,
    };

    if (statusLabels[newDeliveryStatus]) {
      sendOrderChatMessage(
        order.orderCode,
        `[Atualização de Status] ${statusLabels[newDeliveryStatus]}`,
        true
      );
    }

    emitRealtimeEvent("ORDER_STATUS_UPDATED", {
      orderCode: order.orderCode,
      deliveryStatus: newDeliveryStatus,
      sellerName: order.sellerName,
    });

    return order;
  }

  // ==========================================================================
  // BALANÇO FINANCEIRO (EXCLUSIVO ADMIN VS RESUMO PESSOAL DO VENDEDOR)
  // ==========================================================================
  /**
   * Vendedor vê APENAS os números das vendas que ELE mesmo realizou.
   */
  function getSellerPersonalStats() {
    const current = getCurrentUser();
    if (!current || !["seller", "admin"].includes(current.role)) {
      throw new Error("Acesso restrito.");
    }
    const allOrders = getAllOrdersInternal();
    const mySales = allOrders.filter((o) => o.sellerId === current.id && o.paymentStatus === "paid");
    const queueCount = allOrders.filter((o) => o.sellerId === null && o.paymentStatus === "paid").length;
    const deliveredSales = mySales.filter((o) => o.deliveryStatus === "delivered");
    const activeDeliveries = mySales.filter((o) => o.deliveryStatus !== "delivered" && o.deliveryStatus !== "cancelled");
    const myTotalVolume = mySales.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

    return {
      sellerId: current.id,
      sellerName: current.fullName,
      mySalesCount: mySales.length,
      myDeliveredCount: deliveredSales.length,
      myActiveDeliveriesCount: activeDeliveries.length,
      queueWaitingCount: queueCount,
      myTotalVolumeBRL: Number(myTotalVolume.toFixed(2)),
      myOrders: mySales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };
  }

  /**
   * Administrador Supremo vê o Balanço Financeiro Completo da loja inteira,
   * faturamento bruto/líquido, vendas por vendedor e base completa.
   */
  function getAdminGlobalFinancialBalance() {
    const current = getCurrentUser();
    if (!current || current.role !== "admin") {
      throw new Error("Segurança RLS: Apenas o Administrador tem acesso ao Balanço de Valores global da loja.");
    }

    const allOrders = getAllOrdersInternal();
    const paidOrders = allOrders.filter((o) => o.paymentStatus === "paid" && o.deliveryStatus !== "cancelled");

    const grossSubtotal = paidOrders.reduce((acc, o) => acc + (Number(o.subtotal) || 0), 0);
    const totalDiscounts = paidOrders.reduce((acc, o) => acc + (Number(o.discount) || 0), 0);
    const netRevenue = paidOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const avgTicket = paidOrders.length > 0 ? netRevenue / paidOrders.length : 0;

    // Balanço por Vendedor
    const bySellerMap = {};
    paidOrders.forEach((o) => {
      const key = o.sellerId || "unassigned";
      const label = o.sellerName || "Fila (Aguardando Vendedor)";
      if (!bySellerMap[key]) {
        bySellerMap[key] = {
          sellerId: key,
          sellerName: label,
          ordersCount: 0,
          deliveredCount: 0,
          totalBRL: 0,
        };
      }
      bySellerMap[key].ordersCount += 1;
      if (o.deliveryStatus === "delivered") {
        bySellerMap[key].deliveredCount += 1;
      }
      bySellerMap[key].totalBRL += Number(o.total) || 0;
    });

    // Balanço por Jogo
    const byGameMap = {};
    paidOrders.forEach((o) => {
      const gKey = o.gameName || "Path of Exile 2";
      if (!byGameMap[gKey]) {
        byGameMap[gKey] = { gameName: gKey, ordersCount: 0, totalBRL: 0 };
      }
      byGameMap[gKey].ordersCount += 1;
      byGameMap[gKey].totalBRL += Number(o.total) || 0;
    });

    return {
      totalOrdersCount: allOrders.length,
      paidOrdersCount: paidOrders.length,
      deliveredOrdersCount: paidOrders.filter((o) => o.deliveryStatus === "delivered").length,
      waitingQueueCount: paidOrders.filter((o) => !o.sellerId || o.deliveryStatus === "paid_waiting_seller").length,
      grossSubtotalBRL: Number(grossSubtotal.toFixed(2)),
      totalDiscountsBRL: Number(totalDiscounts.toFixed(2)),
      netRevenueBRL: Number(netRevenue.toFixed(2)),
      averageTicketBRL: Number(avgTicket.toFixed(2)),
      salesBySeller: Object.values(bySellerMap),
      salesByGame: Object.values(byGameMap),
    };
  }

  // ==========================================================================
  // CHAT DIRETO PÓS-COMPRA (CLIENTE <-> VENDEDOR LOGADO / ADMINISTRADOR)
  // ==========================================================================
  function getAllMessagesInternal() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.MESSAGES), DEFAULT_MESSAGES);
  }

  function saveAllMessagesInternal(messages) {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }

  function getOrderMessages(orderCodeOrId) {
    const order = getOrderByCodeOrId(orderCodeOrId);
    if (!order) return [];
    const all = getAllMessagesInternal();
    return all
      .filter((m) => m.orderId === order.id || m.orderCode === order.orderCode)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function sendOrderChatMessage(orderCodeOrId, rawMessage, isSystem = false, overrideSenderRole = null) {
    const order = getOrderByCodeOrId(orderCodeOrId);
    if (!order) throw new Error("Pedido não encontrado para enviar mensagem.");

    const cleanMessage = sanitizeText(rawMessage, CHAR_LIMITS.chatMessage);
    if (!cleanMessage) throw new Error("Digite uma mensagem válida.");

    const current = getCurrentUser();
    let senderId = "system";
    let senderName = "Sistema PhoenixStore";
    let senderRole = "system";

    if (!isSystem) {
      if (overrideSenderRole === "seller") {
        senderId = "usr-seller-01";
        senderName = order.sellerName || "Lucas — Vendedor #01";
        senderRole = "seller";
      } else if (overrideSenderRole === "admin") {
        senderId = "usr-admin-01";
        senderName = "Rafa & Denner (Admin)";
        senderRole = "admin";
      } else if (current) {
        senderId = current.id;
        senderName = current.fullName;
        senderRole = current.role;
      } else {
        senderId = order.clientId || "guest";
        senderName = order.clientName || "Cliente";
        senderRole = "client";
      }

      // Se um vendedor enviou mensagem e o pedido ainda estava sem vendedor atribuído, vincula automaticamente a ele
      if (senderRole === "seller" && !order.sellerId && current) {
        const allOrders = getAllOrdersInternal();
        const oIdx = allOrders.findIndex((o) => o.id === order.id);
        if (oIdx >= 0) {
          allOrders[oIdx].sellerId = current.id;
          allOrders[oIdx].sellerName = current.fullName;
          if (allOrders[oIdx].deliveryStatus === "paid_waiting_seller") {
            allOrders[oIdx].deliveryStatus = "seller_assigned";
          }
          saveAllOrdersInternal(allOrders);
        }
      }
    }

    const newMsg = {
      id: "msg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 5),
      orderId: order.id,
      orderCode: order.orderCode,
      senderId,
      senderName: sanitizeText(senderName, CHAR_LIMITS.name),
      senderRole,
      message: cleanMessage,
      createdAt: new Date().toISOString(),
    };

    const allMessages = getAllMessagesInternal();
    allMessages.push(newMsg);
    saveAllMessagesInternal(allMessages);

    emitRealtimeEvent("NEW_CHAT_MESSAGE", {
      orderCode: order.orderCode,
      message: newMsg,
    });

    return newMsg;
  }

  /**
   * Alerta sonoro suave (Web Audio API) quando chega nova venda ou mensagem para Vendedor/Admin
   */
  function playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  }

  // Expõe a API global da PhoenixStore
  window.PhoenixBackend = {
    CHAR_LIMITS,
    sanitizeText,
    escapeHtml,
    getSupabaseConfig,
    saveSupabaseConfig,
    getCurrentUser,
    quickSwitchRole,
    loginWithEmail,
    registerClient,
    logout: () => setCurrentUser(null),
    getUsersForAdmin,
    updateUserRoleByAdmin,
    createStaffUserByAdmin,
    deleteUserByAdmin,
    getMergedCatalogProducts,
    updateProductPricingAndStock,
    addCustomProduct,
    getPaymentSettings,
    updatePaymentSettings,
    getVisibleOrdersForCurrentUser,
    getOrderByCodeOrId,
    createPaidOrder,
    updateOrderStatus,
    getSellerPersonalStats,
    getAdminGlobalFinancialBalance,
    getOrderMessages,
    sendOrderChatMessage,
    playNotificationSound,
    onRealtimeEvent: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
})();
