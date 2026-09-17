// Lista de Mercado v1.0.5
// Melhorias: adição rápida, quantidade +/-,
// resumo de pendentes/comprados/total e modo Compras.

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart3, CheckCircle2, Circle, ClipboardList, LayoutDashboard,
  ListChecks, Menu, Minus, Pencil, Plus, Search, Settings,
  ShoppingCart, Tags, Trash2, X
} from "lucide-react";

type Item = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  purchased: boolean;
};

type Filter = "Todos" | "Pendentes" | "Comprados";

type PurchaseHistory = {
  id: number;
  date: string;
  total: number;
  itemCount: number;
  items: Item[];
};

const KEY = "lista-mercado-items-v1";
const HISTORY_KEY = "lista-mercado-history-v1";
const BUDGET_KEY = "lista-mercado-budget-v1";

const categories = [
  "Alimentos", "Laticínios", "Hortifruti", "Higiene", "Limpeza",
  "Bebidas", "Carnes", "Padaria", "Pet", "Molhos", "Outros"
];

const categoryRules: Record<string, string[]> = {
  "Molhos": [
    "maionese", "maionose", "mostarda", "ketchup", "katchup",
    "molho de tomate", "molho tomate", "molho de pimenta",
    "molho barbecue", "molho"
  ],
  "Laticínios": [
    "leite", "queijo", "iogurte", "requeijão", "requeijao",
    "manteiga", "creme de leite", "coalhada", "danone"
  ],
  "Hortifruti": [
    "banana", "maçã", "maca", "laranja", "uva", "mamão", "mamao",
    "melancia", "abacaxi", "tomate", "batata", "cebola", "alho",
    "cenoura", "alface", "brócolis", "brocolis", "fruta", "verdura",
    "legume"
  ],
  "Higiene": [
    "sabonete", "shampoo", "condicionador", "desodorante",
    "pasta de dente", "escova de dente", "fio dental", "absorvente",
    "colgate", "oral-b", "oralb", "dove"
  ],
  "Limpeza": [
    "detergente", "sabão", "sabao", "sabão em pó", "sabao em po",
    "sabão em barra", "sabao em barra", "amaciante", "desinfetante",
    "água sanitária", "agua sanitaria", "esponja", "limpador",
    "multiuso", "papel toalha", "omo", "ype", "veja", "vanish", "comfort"
  ],
  "Bebidas": [
    "refrigerante", "suco", "água", "agua", "café", "cafe", "chá", "cha",
    "energético", "energetico", "isotônico", "isotonico", "cerveja", "vinho"
  ],
  "Carnes": [
    "frango", "carne", "bife", "linguiça", "linguica", "salsicha",
    "hambúrguer", "hamburguer", "peixe", "filé", "file", "bacon"
  ],
  "Padaria": [
    "pão", "pao", "bolo", "torrada", "croissant", "bisnaguinha"
  ],
  "Pet": [
    "ração", "racao", "petisco", "areia para gato", "shampoo pet",
    "brinquedo para cachorro", "brinquedo para gato"
  ],
  "Alimentos": [
    "arroz", "feijão", "feijao", "macarrão", "macarrao", "farinha",
    "açúcar", "acucar", "sal", "óleo", "oleo", "azeite", "milho",
    "ervilha", "biscoito", "bolacha", "bala", "chocolate", "cereal",
    "aveia", "farofa", "enlatado", "sardinha", "atum", "azeitona",
    "tempero", "pipoca", "nescau", "toddy", "nutella", "hellmann", "hellmans"
  ]
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectCategory(productName: string, fallback = "Outros") {
  const name = normalizeText(productName);
  if (!name) return fallback;

  for (const [category, terms] of Object.entries(categoryRules)) {
    if (terms.some(term => name.includes(normalizeText(term)))) {
      return category;
    }
  }

  return fallback;
}

const initial: Item[] = [
  { id: 1, name: "Arroz", category: "Alimentos", quantity: 2, unitPrice: 25, purchased: false },
  { id: 2, name: "Leite", category: "Laticínios", quantity: 4, unitPrice: 5.5, purchased: true },
  { id: 3, name: "Sabonete", category: "Higiene", quantity: 3, unitPrice: 3.5, purchased: false },
  { id: 4, name: "Banana", category: "Hortifruti", quantity: 1, unitPrice: 8.9, purchased: false },
  { id: 5, name: "Café", category: "Alimentos", quantity: 2, unitPrice: 18.5, purchased: false }
];

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function App() {
  const [history, setHistory] = useState<PurchaseHistory[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [items, setItems] = useState<Item[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null") || initial;
    } catch {
      return initial;
    }
  });

  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyMonth, setHistoryMonth] = useState("Todos");
  const [historyDetail, setHistoryDetail] = useState<PurchaseHistory | null>(null);
  const [formError, setFormError] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BUDGET_KEY)) || 1000;
    } catch {
      return 1000;
    }
  });
  const [form, setForm] = useState({
    name: "",
    category: "Alimentos",
    quantity: 1,
    unitPrice: ""
  });

  const detectedCategory = detectCategory(form.name, form.category);
  const categoryWasDetected =
    Boolean(form.name.trim()) && detectedCategory !== "Outros";

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
  }, [monthlyBudget]);

  const bought = items.filter(x => x.purchased).length;
  const pending = items.length - bought;

  const total = items.reduce(
    (sum, x) => sum + x.quantity * x.unitPrice,
    0
  );

  const pendingTotal = items
    .filter(x => !x.purchased)
    .reduce((sum, x) => sum + x.quantity * x.unitPrice, 0);

  const boughtTotal = items
    .filter(x => x.purchased)
    .reduce((sum, x) => sum + x.quantity * x.unitPrice, 0);

  const shown = useMemo(() => {
    let result = items.filter(x =>
      normalizeText(x.name).includes(normalizeText(search)) &&
      (
        filter === "Todos" ||
        (filter === "Comprados" && x.purchased) ||
        (filter === "Pendentes" && !x.purchased)
      ) &&
      (categoryFilter === "Todas" || x.category === categoryFilter)
    );

    if (shoppingMode) {
      result = result.filter(x => !x.purchased);
    }

    return [...result].sort((a, b) =>
      Number(a.purchased) - Number(b.purchased)
    );
  }, [items, search, filter, categoryFilter, shoppingMode]);

  const groupedShown = useMemo(() => {
    const groups = categories
      .map(category => {
        const categoryItems = shown.filter(item => item.category === category);
        if (!categoryItems.length) return null;

        return {
          category,
          items: categoryItems,
          total: categoryItems.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0
          ),
          pending: categoryItems.filter(item => !item.purchased).length
        };
      })
      .filter(Boolean) as {
        category: string;
        items: Item[];
        total: number;
        pending: number;
      }[];

    const others = shown.filter(item => !categories.includes(item.category));
    if (others.length) {
      groups.push({
        category: "Outros",
        items: others,
        total: others.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        pending: others.filter(item => !item.purchased).length
      });
    }

    return groups;
  }, [shown]);

  const historyMonths = useMemo(() => {
    const values = history.map(p =>
      new Date(p.date).toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric"
      })
    );
    return Array.from(new Set(values));
  }, [history]);

  const filteredHistory = useMemo(() => {
    const query = normalizeText(historySearch);

    return history.filter(purchase => {
      const month = new Date(purchase.date).toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric"
      });

      const matchesMonth =
        historyMonth === "Todos" || month === historyMonth;

      const matchesSearch =
        !query ||
        purchase.items.some(item =>
          normalizeText(item.name).includes(query)
        );

      return matchesMonth && matchesSearch;
    });
  }, [history, historySearch, historyMonth]);

  const filteredHistoryTotal = filteredHistory.reduce(
    (sum, purchase) => sum + purchase.total,
    0
  );

  const filteredHistoryAverage = filteredHistory.length
    ? filteredHistoryTotal / filteredHistory.length
    : 0;

  function deleteHistory(id: number) {
    if (confirm("Excluir este registro do histórico?")) {
      setHistory(v => v.filter(p => p.id !== id));
      if (historyDetail?.id === id) setHistoryDetail(null);
    }
  }

  function toggleCategory(category: string) {
    setCollapsedCategories(v => ({
      ...v,
      [category]: !v[category]
    }));
  }

  const currentMonthKey = new Date().toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric"
  });

  const currentMonthHistory = history.filter(p =>
    new Date(p.date).toLocaleDateString("pt-BR", {
      month: "2-digit",
      year: "numeric"
    }) === currentMonthKey
  );

  const currentMonthSpent = currentMonthHistory.reduce(
    (sum, purchase) => sum + purchase.total,
    0
  );

  const budgetRemaining = Math.max(0, monthlyBudget - currentMonthSpent);
  const budgetPercent = monthlyBudget > 0
    ? Math.min(100, (currentMonthSpent / monthlyBudget) * 100)
    : 0;

  const categorySpending = useMemo(() => {
    const totals: Record<string, number> = {};

    currentMonthHistory.forEach(purchase => {
      purchase.items.forEach(item => {
        totals[item.category] =
          (totals[item.category] || 0) + item.quantity * item.unitPrice;
      });
    });

    return Object.entries(totals)
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [currentMonthHistory]);

  const monthSpending = useMemo(() => {
    const totals: Record<string, number> = {};

    history.forEach(purchase => {
      const key = new Date(purchase.date).toLocaleDateString("pt-BR", {
        month: "2-digit",
        year: "numeric"
      });
      totals[key] = (totals[key] || 0) + purchase.total;
    });

    return Object.entries(totals)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => {
        const [am, ay] = a.month.split("/").map(Number);
        const [bm, by] = b.month.split("/").map(Number);
        return new Date(by, bm - 1).getTime() - new Date(ay, am - 1).getTime();
      })
      .slice(0, 6)
      .reverse();
  }, [history]);

  const averageCurrentPurchase = currentMonthHistory.length
    ? currentMonthSpent / currentMonthHistory.length
    : 0;

  const currentMonthItems = currentMonthHistory.reduce(
    (sum, purchase) => sum + purchase.itemCount,
    0
  );

  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Lista de Compras", ClipboardList],
    ["Categorias", Tags],
    ["Histórico", ListChecks],
    ["Orçamento", BarChart3],
    ["Configurações", Settings]
  ] as const;

  function toggle(id: number) {
    setItems(v =>
      v.map(x => x.id === id ? { ...x, purchased: !x.purchased } : x)
    );
  }

  function changeQuantity(id: number, delta: number) {
    setItems(v =>
      v.map(x =>
        x.id === id
          ? { ...x, quantity: Math.max(1, x.quantity + delta) }
          : x
      )
    );
  }

  function openAdd() {
    setFormError("");
    setEdit(null);
    setForm({
      name: "",
      category: "Alimentos",
      quantity: 1,
      unitPrice: ""
    });
    setModal(true);
  }

  function openEdit(x: Item) {
    setFormError("");
    setEdit(x.id);
    setForm({
      name: x.name,
      category: x.category,
      quantity: x.quantity,
      unitPrice: String(x.unitPrice)
    });
    setModal(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = form.name.trim();
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);

    if (!cleanName) {
      setFormError("Informe o nome do produto.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("A quantidade deve ser maior que zero.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setFormError("Informe um preço válido.");
      return;
    }

    const detectedCategory = detectCategory(cleanName, form.category);

    if (edit) {
      setItems(v => v.map(x =>
        x.id === edit
          ? { ...x, name: cleanName, category: detectedCategory, quantity, unitPrice }
          : x
      ));
    } else {
      setItems(v => [
        ...v,
        {
          id: Date.now(),
          name: cleanName,
          category: detectedCategory,
          quantity,
          unitPrice,
          purchased: false,
        },
      ]);
    }

    setFormError("");
    setModal(false);
    setEdit(null);
    setForm({ name: "", category: "Outros", quantity: 1, unitPrice: 0 });
  }

  function del(id: number) {
    const x = items.find(i => i.id === id);

    if (x && confirm(`Excluir "${x.name}" da lista?`)) {
      setItems(v => v.filter(i => i.id !== id));
    }
  }

  function finalizePurchase() {
    const purchasedItems = items.filter(x => x.purchased);
    if (!purchasedItems.length) return;

    const purchase: PurchaseHistory = {
      id: Date.now(),
      date: new Date().toISOString(),
      total: purchasedItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ),
      itemCount: purchasedItems.reduce((sum, item) => sum + item.quantity, 0),
      items: purchasedItems
    };

    setHistory(v => [purchase, ...v]);
    setItems(v => v.filter(x => !x.purchased));
  }

  function clearPurchased() {
    if (!bought) return;
    if (confirm(`Remover ${bought} item(ns) já comprado(s) da lista?`)) {
      setItems(v => v.filter(x => !x.purchased));
    }
  }

  function quickAdd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;

    const name = e.currentTarget.value.trim();
    if (!name) return;

    const category = detectCategory(name);
    setItems(v => [
      ...v,
      {
        id: Date.now(),
        name,
        category,
        quantity: 1,
        unitPrice: 0,
        purchased: false
      }
    ]);

    e.currentTarget.value = "";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white transition-transform lg:translate-x-0 ${
        mobile ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
            <div className="rounded-xl bg-emerald-500 p-2.5">
              <ShoppingCart size={23} />
            </div>
            <div>
              <b>Lista de Mercado</b>
              <div className="text-xs text-slate-400">versão 1.1.1</div>
            </div>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setMobile(false)}
            >
              <X />
            </button>
          </div>

          <nav className="space-y-1 p-4">
            {nav.map(([label, Icon]) => (
              <button
                key={label}
                onClick={() => {
                  setPage(label);
                  setMobile(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${
                  page === label
                    ? "bg-emerald-500"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-800 p-5 text-xs text-slate-500">
            Projeto pessoal • 100% responsivo
          </div>
        </div>
      </aside>

      {mobile && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}

      <main className="lg:ml-64">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 sm:px-8">
          <button className="lg:hidden" onClick={() => setMobile(true)}>
            <Menu />
          </button>

          <span className="hidden text-sm font-medium text-slate-500 lg:block">
            {page}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <b className="text-sm">Minha lista</b>
              <div className="text-xs text-slate-400">Compras do mês</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
              M
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl p-4 sm:p-8">
          {page === "Dashboard" ? (
            <>
              {shoppingMode && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="text-emerald-600" size={22} />
                    <div>
                      <p className="font-bold text-emerald-800">Modo Compras ativo</p>
                      <p className="text-sm text-emerald-700">
                        Mostrando apenas os produtos que ainda faltam comprar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-7">
                <p className="mb-1 text-sm font-medium text-emerald-600">
                  Boa tarde! 👋
                </p>
                <h1 className="text-3xl font-bold sm:text-4xl">
                  Sua lista de mercado
                </h1>
                <p className="mt-2 text-slate-500">
                  Aqui está o resumo da sua lista atual.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  icon={<ShoppingCart />}
                  title="Itens na lista"
                  value={String(items.length)}
                />
                <Stat
                  icon={<Circle />}
                  title="Pendentes"
                  value={String(pending)}
                />
                <Stat
                  icon={<CheckCircle2 />}
                  title="Comprados"
                  value={String(bought)}
                />
                <Stat
                  icon={<BarChart3 />}
                  title="Total estimado"
                  value={money(total)}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold">Progresso da lista</h2>
                    <p className="text-sm text-slate-400">
                      {bought} de {items.length} item(ns) comprados
                    </p>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">
                    {items.length ? Math.round((bought / items.length) * 100) : 0}%
                  </span>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${items.length ? (bought / items.length) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h2 className="font-bold">Lista de Compras</h2>
                    <p className="text-sm text-slate-400">
                      {shown.length} item(ns) exibido(s)
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setShoppingMode(v => !v)}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                        shoppingMode
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <ShoppingCart size={18} />
                      {shoppingMode ? "Modo Compras ativo" : "Modo Compras"}
                    </button>

                    {bought > 0 && (
                      <>
                        <button
                          onClick={finalizePurchase}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={18} />
                          Finalizar compra
                        </button>

                        <button
                          onClick={clearPurchased}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={18} />
                          Limpar comprados
                        </button>
                      </>
                    )}

                    <button
                      onClick={openAdd}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <Plus size={18} />
                      Adicionar produto
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <Plus size={17} />
                      Adição rápida
                    </div>
                    <input
                      onKeyDown={quickAdd}
                      placeholder="Digite o produto e pressione Enter..."
                      className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 outline-none focus:border-emerald-400"
                    />
                    <p className="mt-2 text-xs text-emerald-700">
                      A categoria e o preço podem ser ajustados depois. Produtos conhecidos são categorizados automaticamente.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Pesquisar produto..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 outline-none focus:border-emerald-400"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    >
                      <option>Todas</option>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>

                    <div className="flex rounded-xl bg-slate-100 p-1">
                      {(["Todos", "Pendentes", "Comprados"] as Filter[]).map(f => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold sm:px-4 ${
                            filter === f
                              ? "bg-white text-emerald-600 shadow-sm"
                              : "text-slate-500"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groupedShown.map(group => (
                      <button
                        key={group.category}
                        onClick={() => toggleCategory(group.category)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{group.category}</span>
                          <span className="text-xs font-bold text-emerald-600">
                            {group.items.length} item(ns)
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>{group.pending} pendente(s)</span>
                          <b>{money(group.total)}</b>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Produto</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3">Qtd.</th>
                          <th className="px-3 py-3">Preço</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3 text-right">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {groupedShown.map(group => (
                          <Fragment key={group.category}>
                            <tr className="border-y border-slate-100 bg-slate-50">
                              <td colSpan={7} className="px-3 py-3">
                                <button
                                  onClick={() => toggleCategory(group.category)}
                                  className="flex w-full items-center justify-between text-left"
                                >
                                  <span className="font-bold">{group.category}</span>
                                  <span className="text-xs text-slate-500">
                                    {group.items.length} item(ns) • {money(group.total)}
                                  </span>
                                </button>
                              </td>
                            </tr>

                            {!collapsedCategories[group.category] &&
                              group.items.map(x => (
                                                                <tr
                            key={x.id}
                            className={`border-b border-slate-50 ${
                              x.purchased ? "opacity-60" : ""
                            }`}
                          >
                            <td className="px-3 py-4">
                              <button onClick={() => toggle(x.id)}>
                                {x.purchased
                                  ? <CheckCircle2 className="text-emerald-500" />
                                  : <Circle className="text-slate-300" />}
                              </button>
                            </td>

                            <td className={`px-3 py-4 font-semibold ${
                              x.purchased ? "line-through" : ""
                            }`}>
                              {x.name}
                            </td>

                            <td className="px-3 py-4">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                                {x.category}
                              </span>
                            </td>

                            <td className="px-3 py-4">
                              <div className="inline-flex items-center rounded-lg border border-slate-200">
                                <button
                                  onClick={() => changeQuantity(x.id, -1)}
                                  className="p-2 hover:bg-slate-100"
                                >
                                  <Minus size={15} />
                                </button>
                                <span className="min-w-9 text-center font-semibold">
                                  {x.quantity}
                                </span>
                                <button
                                  onClick={() => changeQuantity(x.id, 1)}
                                  className="p-2 hover:bg-slate-100"
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            </td>

                            <td className="px-3 py-4">{money(x.unitPrice)}</td>

                            <td className="px-3 py-4 text-right font-semibold">
                              {money(x.quantity * x.unitPrice)}
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => openEdit(x)}
                                  className="rounded-lg p-2 hover:bg-slate-100"
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  onClick={() => del(x.id)}
                                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </td>
                                </tr>
                              ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>

                    {!shown.length && <Empty />}
                  </div>

                  <div className="mt-4 space-y-3 md:hidden">
                    {groupedShown.map(group => (
                      <Fragment key={group.category}>
                        <button
                          onClick={() => toggleCategory(group.category)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-left"
                        >
                          <span className="font-bold">{group.category}</span>
                          <span className="text-xs text-slate-500">
                            {group.items.length} • {money(group.total)}
                          </span>
                        </button>

                        {!collapsedCategories[group.category] &&
                          group.items.map(x => (
                                                        <div
                        key={x.id}
                        className={`rounded-xl border p-4 ${
                          x.purchased
                            ? "border-slate-100 bg-slate-50"
                            : "border-emerald-100 bg-white"
                        }`}
                      >
                              <div className="flex items-start gap-3">
                          <button onClick={() => toggle(x.id)}>
                            {x.purchased
                              ? <CheckCircle2 className="text-emerald-500" />
                              : <Circle className="text-slate-300" />}
                          </button>

                                <div className="flex-1">
                            <b className={x.purchased ? "line-through" : ""}>
                              {x.name}
                            </b>
                                  <div className="text-xs text-slate-400">
                              {x.category}
                                  </div>
                                </div>

                          <b>{money(x.quantity * x.unitPrice)}</b>
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t pt-3">
                                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                            <button
                              onClick={() => changeQuantity(x.id, -1)}
                              className="p-2"
                            >
                              <Minus size={15} />
                            </button>
                            <span className="min-w-9 text-center font-semibold">
                              {x.quantity}
                            </span>
                            <button
                              onClick={() => changeQuantity(x.id, 1)}
                              className="p-2"
                            >
                              <Plus size={15} />
                            </button>
                                </div>

                                <div className="flex gap-2">
                            <button
                              onClick={() => openEdit(x)}
                              className="inline-flex gap-1 px-3 py-2 text-xs"
                            >
                              <Pencil size={14} />
                              Editar
                            </button>
                            <button
                              onClick={() => del(x.id)}
                              className="inline-flex gap-1 px-3 py-2 text-xs text-red-600"
                            >
                              <Trash2 size={14} />
                              Excluir
                            </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </Fragment>
                    ))}

                    {!shown.length && <Empty />}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-5xl">
              {page === "Histórico" ? (
                <>
                  <div className="mb-7">
                    <p className="text-sm font-medium text-emerald-600">
                      Histórico de compras
                    </p>
                    <h1 className="text-3xl font-bold">Compras anteriores</h1>
                    <p className="mt-2 text-slate-500">
                      Pesquise, filtre e acompanhe seus gastos.
                    </p>
                  </div>

                  <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                      title="Compras no filtro"
                      value={String(filteredHistory.length)}
                      subtitle="Registros encontrados"
                    />
                    <SummaryCard
                      title="Total no período"
                      value={money(filteredHistoryTotal)}
                      subtitle="Soma das compras"
                    />
                    <SummaryCard
                      title="Média por compra"
                      value={money(filteredHistoryAverage)}
                      subtitle="Valor médio"
                    />
                    <SummaryCard
                      title="Itens registrados"
                      value={String(
                        filteredHistory.reduce((sum, p) => sum + p.itemCount, 0)
                      )}
                      subtitle="Itens no filtro"
                    />
                  </div>

                  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row">
                      <div className="relative flex-1">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          value={historySearch}
                          onChange={e => setHistorySearch(e.target.value)}
                          placeholder="Pesquisar produto no histórico..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none focus:border-emerald-400"
                        />
                      </div>

                      <select
                        value={historyMonth}
                        onChange={e => setHistoryMonth(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-400"
                      >
                        <option>Todos</option>
                        {historyMonths.map(month => (
                          <option key={month}>{month}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                      <ListChecks className="mx-auto mb-4 text-slate-300" size={48} />
                      <h2 className="font-bold">Nenhuma compra encontrada</h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Ajuste a pesquisa ou o período selecionado.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredHistory.map(purchase => (
                        <div
                          key={purchase.id}
                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h2 className="font-bold">
                                Compra de{" "}
                                {new Date(purchase.date).toLocaleDateString("pt-BR")}
                              </h2>
                              <p className="text-sm text-slate-400">
                                {purchase.itemCount} item(ns)
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <b className="mr-2 text-xl text-emerald-600">
                                {money(purchase.total)}
                              </b>

                              <button
                                onClick={() => setHistoryDetail(purchase)}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                              >
                                Ver detalhes
                              </button>

                              <button
                                onClick={() => deleteHistory(purchase.id)}
                                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {purchase.items.slice(0, 8).map(item => (
                              <span
                                key={item.id}
                                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600"
                              >
                                {item.name} × {item.quantity}
                              </span>
                            ))}
                            {purchase.items.length > 8 && (
                              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                                +{purchase.items.length - 8} item(ns)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setPage("Dashboard")}
                    className="mt-6 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white"
                  >
                    Voltar ao Dashboard
                  </button>
                </>
              ) : (
                <>
                  {page === "Orçamento" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">
                          Controle financeiro
                        </p>
                        <h1 className="text-3xl font-bold">Orçamento mensal</h1>
                        <p className="mt-2 text-slate-500">
                          Defina quanto pretende gastar com supermercado por mês.
                        </p>
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h2 className="font-bold">Limite mensal</h2>
                          <p className="mt-1 text-sm text-slate-400">
                            Esse valor fica salvo localmente neste navegador.
                          </p>

                          <label className="mt-5 block text-sm font-medium">
                            Orçamento
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={monthlyBudget}
                              onChange={e => setMonthlyBudget(Math.max(0, Number(e.target.value) || 0))}
                              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-400"
                            />
                          </label>

                          <div className="mt-5 rounded-xl bg-slate-50 p-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Gasto atual</span>
                              <b>{money(currentMonthSpent)}</b>
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                              <span className="text-slate-500">Disponível</span>
                              <b className="text-emerald-600">{money(budgetRemaining)}</b>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <h2 className="font-bold">Situação do mês</h2>
                          <div className="mt-5 text-center">
                            <div className="text-5xl font-bold text-emerald-600">
                              {Math.round(budgetPercent)}%
                            </div>
                            <p className="mt-2 text-sm text-slate-400">
                              do orçamento utilizado
                            </p>
                          </div>

                          <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${budgetPercent}%` }}
                            />
                          </div>

                          {budgetPercent >= 100 ? (
                            <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                              ⚠️ O orçamento mensal foi atingido.
                            </div>
                          ) : budgetPercent >= 80 ? (
                            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
                              ⚠️ Atenção: você está próximo do limite mensal.
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                              ✓ Dentro do orçamento mensal.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 grid gap-5 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="mb-5">
                            <h2 className="text-lg font-bold">Gastos por categoria</h2>
                            <p className="mt-1 text-sm text-slate-400">
                              Distribuição dos gastos em {currentMonthKey}
                            </p>
                          </div>

                          {categorySpending.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400">
                              Ainda não há compras registradas neste mês.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {categorySpending.map(row => {
                                const percent = currentMonthSpent
                                  ? (row.value / currentMonthSpent) * 100
                                  : 0;

                                return (
                                  <div key={row.category}>
                                    <div className="mb-1.5 flex items-center justify-between text-sm">
                                      <span className="font-medium">{row.category}</span>
                                      <span className="font-semibold">
                                        {money(row.value)}
                                      </span>
                                    </div>
                                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {Math.round(percent)}% do total mensal
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                          <div className="mb-5">
                            <h2 className="text-lg font-bold">Evolução mensal</h2>
                            <p className="mt-1 text-sm text-slate-400">
                              Gastos dos últimos meses registrados
                            </p>
                          </div>

                          {monthSpending.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400">
                              O histórico mensal aparecerá após finalizar compras.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {monthSpending.map(row => {
                                const max = Math.max(
                                  ...monthSpending.map(x => x.value),
                                  1
                                );
                                const percent = (row.value / max) * 100;

                                return (
                                  <div key={row.month}>
                                    <div className="mb-1.5 flex items-center justify-between text-sm">
                                      <span className="font-medium">{row.month}</span>
                                      <span className="font-semibold">
                                        {money(row.value)}
                                      </span>
                                    </div>
                                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${percent}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setPage("Dashboard")}
                        className="mt-6 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white"
                      >
                        Voltar ao Dashboard
                      </button>
                    </>
                  ) : (
                    <>
                  {page === "Categorias" ? (
                <>
                  <div className="mb-7">
                    <p className="text-sm font-medium text-emerald-600">
                      Organização inteligente
                    </p>
                    <h1 className="text-3xl font-bold">Categorias</h1>
                    <p className="mt-2 text-slate-500">
                      O sistema identifica a categoria pelo nome do produto automaticamente.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map(c => {
                      const count = items.filter(i => i.category === c).length;

                      return (
                        <div
                          key={c}
                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{c}</span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {count} item(ns)
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">
                            Reconhecimento automático ativo
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setPage("Dashboard")}
                    className="mt-6 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white"
                  >
                    Voltar ao Dashboard
                  </button>
                </>
              ) : (
                <div className="flex min-h-[60vh] items-center justify-center text-center">
                  <div>
                    <ListChecks
                      className="mx-auto mb-4 text-emerald-500"
                      size={48}
                    />
                    <h1 className="text-2xl font-bold">{page}</h1>
                    <p className="mt-2 text-slate-500">
                      Tela preparada para a próxima etapa.
                    </p>
                    <button
                      onClick={() => setPage("Dashboard")}
                      className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white"
                    >
                      Voltar ao Dashboard
                    </button>
                  </div>
                </div>
                    )}
                </>
              )}
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {historyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Detalhes da compra</h2>
                <p className="text-sm text-slate-400">
                  {new Date(historyDetail.date).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button onClick={() => setHistoryDetail(null)}>
                <X className="text-slate-400" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryCard
                title="Itens"
                value={String(historyDetail.itemCount)}
                subtitle="Quantidade total"
              />
              <SummaryCard
                title="Total"
                value={money(historyDetail.total)}
                subtitle="Valor da compra"
              />
              <SummaryCard
                title="Produtos"
                value={String(historyDetail.items.length)}
                subtitle="Produtos diferentes"
              />
            </div>

            <div className="mt-5 max-h-80 space-y-2 overflow-y-auto">
              {historyDetail.items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div>
                    <b>{item.name}</b>
                    <div className="text-xs text-slate-400">
                      {item.category} • {item.quantity} × {money(item.unitPrice)}
                    </div>
                  </div>
                  <b>{money(item.quantity * item.unitPrice)}</b>
                </div>
              ))}
            </div>

            <button
              onClick={() => setHistoryDetail(null)}
              className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={save}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {edit === null ? "Adicionar produto" : "Editar produto"}
                </h2>
                <p className="text-sm text-slate-400">
                  Preencha os dados do produto.
                </p>
              </div>

              <button type="button" onClick={() => setModal(false)}>
                <X className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Produto

                <input
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    const detected = detectCategory(name, "Outros");

                    setForm(v => ({
                      ...v,
                      name,
                      category: detected !== "Outros" ? detected : v.category
                    }));
                  }}
                  className="mt-1.5 w-full rounded-xl border px-4 py-3"
                  placeholder="Ex.: Arroz"
                />

                {form.name.trim() && (
                  <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                    categoryWasDetected
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    🧠 Categoria identificada automaticamente:{" "}
                    <b>{detectedCategory}</b>
                  </div>
                )}
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium sm:col-span-2">
                  Categoria
                  <select
                    value={form.category}
                    onChange={e =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3"
                  >
                    {categories.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={e =>
                      setForm({ ...form, quantity: Number(e.target.value) })
                    }
                    className="mt-1.5 w-full rounded-xl border px-4 py-3"
                  />
                </label>
              </div>

              <label className="block text-sm font-medium">
                Preço unitário
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={e =>
                    setForm({ ...form, unitPrice: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border px-4 py-3"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex-1 rounded-xl border px-4 py-3 font-semibold"
              >
                Cancelar
              </button>

              <button
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white"
              >
                {edit === null ? "Adicionar" : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  title,
  value
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="py-10 text-center text-sm text-slate-400">
      Nenhum produto encontrado com os filtros atuais.
    </div>
  );
}
