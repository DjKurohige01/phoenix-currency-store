# Guia Rápido: Como Adicionar Novos Jogos, Currencies, Itens e Services

Toda a inteligência da loja fica centralizada em um único arquivo super fácil de editar:
👉 **`phoenix-currency-store/catalog-config.js`**

Você não precisa mexer no HTML para adicionar novos jogos, mudar preços de Divine Orb ou cadastrar novos Services (Leveling, Boost, Carry) e Itens!

---

## 1. Como alterar o preço de uma Currency (ex: Divine Orb)
Abra o arquivo `catalog-config.js`, procure pelo produto (ex: `id: "poe2-divine-orb"`) e mude apenas o campo `pricePerUnit`:
```js
pricePerUnit: 4.50, // Mude para o valor em R$ (ou coloque 0 para ficar "Sob Consulta")
```

---

## 2. Como ativar ou adicionar um Novo Jogo (ex: Diablo IV, Last Epoch, WoW)
Na lista `games: [ ... ]` do `catalog-config.js`, já deixamos **Diablo IV** e **Last Epoch** pré-configurados como `"em_breve"`.
- Para ativar um deles, basta mudar:
  ```js
  status: "ativo", // antes estava "em_breve"
  tag: "NOVO",
  ```
- Para criar um jogo totalmente novo, basta copiar um bloco:
  ```js
  {
    id: "wow",
    name: "World of Warcraft",
    shortName: "WoW",
    tag: "NOVO",
    status: "ativo",
    description: "Gold, Mythic+ Boost, Raid Carry e Leveling.",
    leagues: [
      { id: "wow-retail", name: "Retail — The War Within", badge: "Principal" },
    ],
  },
  ```

---

## 3. Como adicionar um Novo Item ou Service (Leveling, Boost, Carry)
Na lista `products: [ ... ]` do `catalog-config.js`, basta colar um novo bloco apontando para a categoria desejada:
- `categoryId: "currency"` → Aparece na aba **Currency (Moedas)**
- `categoryId: "services"` → Aparece na aba **Services & Boost** (Leveling, Rush, Boss Carry)
- `categoryId: "items"` → Aparece na aba **Itens & Equips** (Mageblood, Headhunter, Builds)

Exemplo de novo Service de Boost:
```js
{
  id: "poe2-boss-carry-pinnacle",
  gameId: "poe2",             // "poe2", "poe1", "diablo4", etc.
  categoryId: "services",     // "currency", "services" ou "items"
  name: "Pinnacle Boss Carry (Arbiter of Ash / Xesht)",
  subtitle: "Derrotamos qualquer Boss Endgame na sua instância com loot 100% seu",
  badge: "Loot Seu",
  featured: true,
  pricePerUnit: 45.00,        // Coloque 0 se quiser "Sob Consulta"
  unitLabel: "1x Boss Kill",
  minQty: 1,
  stepQty: 1,
  quickPresets: [1, 2, 5],
  stockStatus: "Carry Online Agora",
  iconType: "service-boost",  // orb-divine, orb-exalted, orb-chaos, service-boost, service-leveling, item-unique
  rarityColor: "orange",      // amber, orange, purple, red, cyan
  highlights: [
    "Você entra no final para pegar os pontos do Atlas e o Loot",
    "Execução em menos de 5 minutos",
  ],
},
```
