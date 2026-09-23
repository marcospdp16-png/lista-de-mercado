// Lista de Mercado v1.4.1.1
// Sincronização da Lista de Compras com Supabase, mantendo localStorage como cache/offline.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  BarChart3, Bell, CheckCircle2, Circle, ClipboardList, LayoutDashboard, Cloud, CloudOff, Loader2, RefreshCw,
  TrendingUp,
  ListChecks, Menu, Minus, Pencil, Plus, Search, Settings,
  ShoppingCart, Tags, Trash2, X, Star, Sparkles, PiggyBank
} from "lucide-react";

type Item = {
  id: number;
  cloudId?: string;
  updatedAt?: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  purchased: boolean;
  favorite?: boolean;
};

type Filter = "Todos" | "Pendentes" | "Comprados" | "Favoritos";

type PurchaseHistory = {
  id: number;
  cloudId?: string;
  date: string;
  total: number;
  itemCount: number;
  items: Item[];
};

const KEY = "lista-mercado-items-v1";
const HISTORY_KEY = "lista-mercado-history-v1";
const BUDGET_KEY = "lista-mercado-budget-v1";
const SYNC_LIST_ID_KEY = "lista-mercado-sync-list-id-v1";
const SYNC_CODE_KEY = "lista-mercado-sync-code-v1";
const SYNC_LAST_SYNC_KEY = "lista-mercado-sync-last-v1";
const DELETED_ITEMS_KEY = "lista-mercado-deleted-items-v1";

type SyncStatus = "inicializando" | "sincronizado" | "offline" | "erro";


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
  const [priceSearch, setPriceSearch] = useState("");
  const [selectedPriceProduct, setSelectedPriceProduct] = useState("");
  const [formError, setFormError] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BUDGET_KEY)) || 1000;
    } catch {
      return 1000;
    }
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("inicializando");
  const [syncError, setSyncError] = useState("");
  const [listId, setListId] = useState<string>(() =>
    localStorage.getItem(SYNC_LIST_ID_KEY) || ""
  );
  const [linkCode, setLinkCode] = useState<string>(() =>
    localStorage.getItem(SYNC_CODE_KEY) || ""
  );
  const [linkCodeInput, setLinkCodeInput] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncingNow, setSyncingNow] = useState(false);
  const [syncingItems, setSyncingItems] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [quickAddingName, setQuickAddingName] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string>(() =>
    localStorage.getItem(SYNC_LAST_SYNC_KEY) || ""
  );
  const syncInFlightRef = useRef(false);

  const [form, setForm] = useState({
    name: "",
    category: "Alimentos",
    quantity: 1,
    unitPrice: ""
  });

  const detectedCategory = detectCategory(form.name, form.category);
  const categoryWasDetected =
    Boolean(form.name.trim()) && detectedCategory !== "Outros";


  function nextLocalId(existing: Item[]) {
    const maxId = existing.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
    return maxId + 1;
  }

  function withUpdatedAt(item: Item): Item {
    return { ...item, updatedAt: new Date().toISOString() };
  }

  async function pushItemsToCloud(currentItems: Item[], targetListId = listId) {
    if (!targetListId) return currentItems;

    const inserted: { id: string; updated_at: string }[] = [];
    const itemsWithDates = currentItems.map(item =>
      item.updatedAt ? item : withUpdatedAt(item)
    );

    const toInsert = itemsWithDates.filter(item => !item.cloudId);
    if (toInsert.length) {
      const payload = toInsert.map(item => ({
        lista_id: targetListId,
        nome: item.name,
        categoria: item.category,
        quantidade: item.quantity,
        preco_unitario: item.unitPrice,
        comprado: item.purchased,
        favorito: Boolean(item.favorite),
        updated_at: item.updatedAt
      }));

      const { data, error } = await supabase
        .from("itens")
        .insert(payload)
        .select("id, updated_at");

      if (error) throw error;
      inserted.push(...(data || []));
    }

    for (const item of itemsWithDates.filter(x => Boolean(x.cloudId))) {
      const { error } = await supabase
        .from("itens")
        .update({
          nome: item.name,
          categoria: item.category,
          quantidade: item.quantity,
          preco_unitario: item.unitPrice,
          comprado: item.purchased,
          favorito: Boolean(item.favorite),
          updated_at: item.updatedAt
        })
        .eq("id", item.cloudId)
        .eq("lista_id", targetListId)
        .lt("updated_at", item.updatedAt!);

      if (error) throw error;
    }

    if (inserted.length) {
      let insertedIndex = 0;
      return itemsWithDates.map(item => {
        if (item.cloudId) return item;
        const remote = inserted[insertedIndex++];
        return remote
          ? { ...item, cloudId: remote.id, updatedAt: remote.updated_at || item.updatedAt }
          : item;
      });
    }

    return itemsWithDates;
  }

  async function pullItemsFromCloud() {
    if (!listId) return [];

    const { data, error } = await supabase
      .from("itens")
      .select("id, lista_id, nome, categoria, quantidade, preco_unitario, comprado, favorito, updated_at, deleted_at")
      .eq("lista_id", listId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || [])
      .filter((row: any) => !row.deleted_at)
      .map((row: any, index: number) => ({
        id: nextLocalId([]) + index,
        cloudId: row.id,
        updatedAt: row.updated_at,
        name: row.nome,
        category: row.categoria,
        quantity: Number(row.quantidade),
        unitPrice: Number(row.preco_unitario),
        purchased: Boolean(row.comprado),
        favorite: Boolean(row.favorito)
      })) as Item[];
  }

  async function syncDeletedItems(targetListId = listId) {
    if (!targetListId) return;

    const raw = localStorage.getItem(DELETED_ITEMS_KEY);
    const tombstones: { cloudId: string; deletedAt: string }[] = raw ? JSON.parse(raw) : [];
    if (!tombstones.length) return;

    const remaining: typeof tombstones = [];

    for (const tombstone of tombstones) {
      const { error } = await supabase
        .from("itens")
        .update({
          deleted_at: tombstone.deletedAt,
          updated_at: tombstone.deletedAt
        })
        .eq("id", tombstone.cloudId)
        .eq("lista_id", targetListId)
        .lt("updated_at", tombstone.deletedAt);

      if (error) throw error;
    }

    localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify(remaining));
  }

  function historySignature(purchase: PurchaseHistory) {
    return [
      purchase.date,
      Number(purchase.total).toFixed(2),
      purchase.itemCount,
      purchase.items.map(item => `${item.name}|${item.quantity}|${Number(item.unitPrice).toFixed(2)}`).join("||")
    ].join("::");
  }

  async function pullHistoryFromCloud(targetListId = listId) {
    if (!targetListId) return [];

    const { data, error } = await supabase
      .from("historico_compras")
      .select("id, lista_id, data_compra, total, quantidade_itens, itens, created_at")
      .eq("lista_id", targetListId)
      .order("data_compra", { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any, index: number) => {
      const rawItems = Array.isArray(row.itens) ? row.itens : [];
      const purchaseItems = rawItems.map((item: any, itemIndex: number) => ({
        id: Number(item.id) || (Date.now() + index + itemIndex),
        cloudId: item.cloudId,
        updatedAt: item.updatedAt,
        name: String(item.name || item.nome || ""),
        category: String(item.category || item.categoria || "Outros"),
        quantity: Number(item.quantity ?? item.quantidade ?? 1),
        unitPrice: Number(item.unitPrice ?? item.preco_unitario ?? 0),
        purchased: true
      })) as Item[];

      return {
        id: Date.now() + index,
        cloudId: String(row.id),
        date: String(row.data_compra),
        total: Number(row.total),
        itemCount: Number(row.quantidade_itens),
        items: purchaseItems
      };
    }) as PurchaseHistory[];
  }

  async function pushHistoryToCloud(currentHistory: PurchaseHistory[], targetListId = listId) {
    if (!targetListId) return currentHistory;

    const inserted: { id: string; data_compra: string; total: number; quantidade_itens: number; itens: any[] }[] = [];

    for (const purchase of currentHistory) {
      const payload = {
        lista_id: targetListId,
        data_compra: purchase.date,
        total: purchase.total,
        quantidade_itens: purchase.itemCount,
        itens: purchase.items
      };

      if (purchase.cloudId) {
        const { error } = await supabase
          .from("historico_compras")
          .update(payload)
          .eq("id", purchase.cloudId)
          .eq("lista_id", targetListId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("historico_compras")
          .insert(payload)
          .select("id, data_compra, total, quantidade_itens, itens")
          .single();

        if (error) throw error;
        if (data) inserted.push(data);
      }
    }

    if (!inserted.length) return currentHistory;

    let insertIndex = 0;
    return currentHistory.map(purchase => {
      if (purchase.cloudId) return purchase;
      const remote = inserted[insertIndex++];
      return remote
        ? { ...purchase, cloudId: String(remote.id) }
        : purchase;
    });
  }

  async function deleteCloudHistory(cloudId?: string) {
    if (!cloudId || !listId) return;

    const { error } = await supabase
      .from("historico_compras")
      .delete()
      .eq("id", cloudId)
      .eq("lista_id", listId);

    if (error) throw error;
  }

  function getCurrentBudgetPeriod() {
    const now = new Date();
    return { mes: now.getMonth() + 1, ano: now.getFullYear() };
  }

  async function pullBudgetFromCloud(targetListId = listId) {
    if (!targetListId) return null;

    const { mes, ano } = getCurrentBudgetPeriod();
    const { data, error } = await supabase
      .from("orcamentos")
      .select("id, valor, mes, ano, updated_at")
      .eq("lista_id", targetListId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (error) throw error;
    return data ? Number(data.valor) : null;
  }

  async function pushBudgetToCloud(value: number, targetListId = listId) {
    if (!targetListId) return;

    const { mes, ano } = getCurrentBudgetPeriod();
    const { error } = await supabase
      .from("orcamentos")
      .upsert(
        {
          lista_id: targetListId,
          mes,
          ano,
          valor: Number(value) || 0,
          updated_at: new Date().toISOString()
        },
        { onConflict: "lista_id,mes,ano" }
      );

    if (error) throw error;
  }

  async function synchronizeBudget(preferLocal = false, targetListId = listId) {
    if (!targetListId) return;

    const localBudget = Number(localStorage.getItem(BUDGET_KEY) || monthlyBudget) || 0;
    const cloudBudget = await pullBudgetFromCloud(targetListId);

    if (cloudBudget !== null) {
      setMonthlyBudget(cloudBudget);
      localStorage.setItem(BUDGET_KEY, String(cloudBudget));
      return;
    }

    if (preferLocal || localStorage.getItem(BUDGET_KEY) !== null) {
      await pushBudgetToCloud(localBudget, targetListId);
    }
  }

  async function synchronizeHistory(preferLocal = false, targetListId = listId) {
    if (!targetListId) return;

    setSyncingHistory(true);

    try {
      const localHistory = history;
      const cloudHistory = await pullHistoryFromCloud(targetListId);

      if (cloudHistory.length === 0 && preferLocal && localHistory.length > 0) {
        const uploaded = await pushHistoryToCloud(localHistory, targetListId);
        setHistory(uploaded);
      } else {
        const cloudSignatures = new Set(cloudHistory.map(historySignature));
        const localWithoutCloud = localHistory.filter(
          purchase => !purchase.cloudId && !cloudSignatures.has(historySignature(purchase))
        );

        let uploadedLocal: PurchaseHistory[] = [];
        if (localWithoutCloud.length > 0) {
          uploadedLocal = await pushHistoryToCloud(localWithoutCloud, targetListId);
        }

        const localUploadedBySignature = new Map(
          uploadedLocal.map(purchase => [historySignature(purchase), purchase])
        );

        const mergedLocal = localHistory
          .filter(purchase => !purchase.cloudId)
          .map(purchase => localUploadedBySignature.get(historySignature(purchase)) || purchase);

        const merged = [
          ...cloudHistory,
          ...mergedLocal.filter(
            purchase => !cloudSignatures.has(historySignature(purchase))
          )
        ].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setHistory(merged);
      }
    } finally {
      setSyncingHistory(false);
    }
  }

  function withUpdatedAtIfMissing(item: Item): Item {
    return item.updatedAt ? item : withUpdatedAt(item);
  }

  async function synchronizeItems(preferLocal = false) {
    if (!listId) return;

    setSyncingItems(true);
    setSyncMessage("");
    setConflictMessage("");

    try {
      const localItems = items.map(item => item.updatedAt ? item : withUpdatedAt(item));
      const cloudItems = await pullItemsFromCloud();

      await syncDeletedItems(listId);

      if (cloudItems.length === 0 && preferLocal && localItems.length > 0) {
        const uploaded = await pushItemsToCloud(localItems);
        setItems(uploaded);
      } else {
        const localByCloudId = new Map(localItems.filter(x => x.cloudId).map(x => [x.cloudId!, x]));
        const localOnly = localItems.filter(x => !x.cloudId);
        const localWins: Item[] = [];
        const remoteWins: Item[] = [];
        const merged: Item[] = [];

        for (const remote of cloudItems) {
          const local = localByCloudId.get(remote.cloudId);
          if (local && local.updatedAt && remote.updatedAt && local.updatedAt > remote.updatedAt) {
            localWins.push(local);
            merged.push(local);
          } else {
            if (local && local.updatedAt !== remote.updatedAt) remoteWins.push(remote);
            merged.push(remote);
          }
        }

        if (localOnly.length) {
          merged.push(...localOnly);
        }

        const mergedWithDates = merged.map(withUpdatedAtIfMissing);
        const uploaded = await pushItemsToCloud(mergedWithDates);
        setItems(uploaded);

        if (localWins.length) {
          setConflictMessage(`${localWins.length} alteração(ões) local(is) mais recente(s) foram preservadas.`);
        } else if (remoteWins.length) {
          setConflictMessage(`${remoteWins.length} alteração(ões) da nuvem foram aplicadas neste dispositivo.`);
        }
      }

      localStorage.setItem(SYNC_LAST_SYNC_KEY, new Date().toISOString());
      setSyncStatus("sincronizado");
      setSyncMessage("Lista sincronizada com proteção contra conflitos.");
    } catch (error) {
      console.error("Erro ao sincronizar itens:", error);
      setSyncStatus(navigator.onLine ? "erro" : "offline");
      setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar a lista.");
    } finally {
      setSyncingItems(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function initializeSupabase() {
      setSyncStatus("inicializando");
      setSyncError("");

      try {
        let { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
          const { error: signInError } =
            await supabase.auth.signInAnonymously();

          if (signInError) throw signInError;

          const refreshed = await supabase.auth.getSession();
          if (refreshed.error) throw refreshed.error;
          sessionData = refreshed.data;
        }

        if (!sessionData.session) {
          throw new Error("Não foi possível iniciar a sessão anônima.");
        }

        // Se este navegador já possui um código salvo, tenta recuperar
        // automaticamente a mesma lista antes de criar uma nova identidade/lista.
        // Isso evita pedir o código novamente quando a sessão anônima precisar ser renovada.
        const savedCode = localStorage.getItem(SYNC_CODE_KEY) || "";
        let data: any;
        let error: any;

        if (savedCode) {
          const result = await supabase.rpc("vincular_dispositivo_por_codigo", {
            p_codigo: savedCode
          });
          data = result.data;
          error = result.error;
        } else {
          const result = await supabase.rpc("obter_ou_criar_lista");
          data = result.data;
          error = result.error;
        }

        if (error) throw error;

        const lista = Array.isArray(data) ? data[0] : data;

        if (!lista?.lista_id) {
          throw new Error("O Supabase não retornou o identificador da lista.");
        }

        if (!active) return;

        const nextListId = String(lista.lista_id);
        const nextCode = String(lista.codigo_vinculacao || "");

        setListId(nextListId);
        setLinkCode(nextCode);
        localStorage.setItem(SYNC_LIST_ID_KEY, nextListId);

        if (nextCode) {
          localStorage.setItem(SYNC_CODE_KEY, nextCode);
        }

        // Primeira sincronização: se a lista na nuvem já tiver itens, eles entram neste dispositivo.
        // Se a nuvem estiver vazia e este navegador já possuir dados, os dados locais são enviados.
        const hadLocalItems = localStorage.getItem(KEY) !== null;
        try {
          const { data: cloudRows, error: cloudError } = await supabase
            .from("itens")
            .select("id")
            .eq("lista_id", nextListId);
          if (cloudError) throw cloudError;

          if (cloudRows && cloudRows.length > 0) {
            const { data: fullRows, error: fullError } = await supabase
              .from("itens")
              .select("id, lista_id, nome, categoria, quantidade, preco_unitario, comprado, favorito, updated_at, deleted_at")
              .eq("lista_id", nextListId)
              .order("created_at", { ascending: true });
            if (fullError) throw fullError;

            const remoteItems = (fullRows || []).filter((row: any) => !row.deleted_at).map((row: any, index: number) => ({
              id: Date.now() + index,
              cloudId: row.id,
              updatedAt: row.updated_at,
              name: row.nome,
              category: row.categoria,
              quantity: Number(row.quantidade),
              unitPrice: Number(row.preco_unitario),
              purchased: Boolean(row.comprado),
              favorite: Boolean(row.favorito)
            })) as Item[];
            setItems(remoteItems);
          } else if (hadLocalItems) {
            const localRaw = localStorage.getItem(KEY);
            const localItems = localRaw ? JSON.parse(localRaw) as Item[] : [];
            const normalized = localItems.map(withUpdatedAt);
            const uploaded = await pushItemsToCloud(normalized, nextListId);
            setItems(uploaded);
          }

          await synchronizeHistory(true, nextListId);
          await synchronizeBudget(true, nextListId);

          const syncedAt = new Date().toISOString();
          localStorage.setItem(SYNC_LAST_SYNC_KEY, syncedAt);
          setLastSyncAt(syncedAt);
          setSyncStatus("sincronizado");
        } catch (syncError) {
          console.error("Erro na sincronização inicial dos itens:", syncError);
          setSyncError(syncError instanceof Error ? syncError.message : "Não foi possível sincronizar os itens.");
          setSyncStatus("erro");
        }
      } catch (error) {
        console.error("Erro ao inicializar o Supabase:", error);

        if (!active) return;

        setSyncStatus(navigator.onLine ? "erro" : "offline");
        setSyncError(
          error instanceof Error
            ? error.message
            : "Não foi possível conectar ao Supabase."
        );
      }
    }

    initializeSupabase();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (syncStatus !== "sincronizado" || !listId || !items.length) return;

    const timer = window.setTimeout(async () => {
      try {
        await syncDeletedItems(listId);
        const normalized = items.map(item => item.updatedAt ? item : withUpdatedAt(item));
        const uploaded = await pushItemsToCloud(normalized);
        if (JSON.stringify(uploaded) !== JSON.stringify(items)) {
          setItems(uploaded);
        }
        localStorage.setItem(SYNC_LAST_SYNC_KEY, new Date().toISOString());
        setSyncMessage("Lista sincronizada com a nuvem.");
      } catch (error) {
        console.error("Erro ao enviar alterações para a nuvem:", error);
        setSyncStatus(navigator.onLine ? "erro" : "offline");
        setSyncError(error instanceof Error ? error.message : "Não foi possível enviar as alterações.");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [items, listId, syncStatus]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (syncStatus !== "sincronizado" || !listId) return;

    const timer = window.setTimeout(async () => {
      try {
        const uploaded = await pushHistoryToCloud(history);
        if (JSON.stringify(uploaded) !== JSON.stringify(history)) {
          setHistory(uploaded);
        }
      } catch (error) {
        console.error("Erro ao enviar histórico para a nuvem:", error);
        setSyncStatus(navigator.onLine ? "erro" : "offline");
        setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar o histórico.");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [history, listId, syncStatus]);

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, String(monthlyBudget));

    if (syncStatus !== "sincronizado" || !listId || !navigator.onLine) return;

    const timer = window.setTimeout(async () => {
      try {
        await pushBudgetToCloud(monthlyBudget);
        localStorage.setItem(SYNC_LAST_SYNC_KEY, new Date().toISOString());
      } catch (error) {
        console.error("Erro ao sincronizar orçamento:", error);
        setSyncStatus(navigator.onLine ? "erro" : "offline");
        setSyncError(error instanceof Error ? error.message : "Não foi possível sincronizar o orçamento.");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [monthlyBudget, listId, syncStatus]);

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
        (filter === "Pendentes" && !x.purchased) ||
        (filter === "Favoritos" && Boolean(x.favorite))
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

  const priceProducts = useMemo(() => {
    const map = new Map<string, { name: string; records: { date: string; price: number; quantity: number }[] }>();

    history.forEach(purchase => {
      purchase.items.forEach(item => {
        const key = normalizeText(item.name);
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: item.name, records: [] });
        map.get(key)!.records.push({
          date: purchase.date,
          price: Number(item.unitPrice) || 0,
          quantity: Number(item.quantity) || 0
        });
      });
    });

    return Array.from(map.entries())
      .map(([key, value]) => {
        const records = [...value.records].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const prices = records.map(r => r.price);
        return {
          key,
          name: value.name,
          records,
          last: records[records.length - 1]?.price || 0,
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
          average: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [history]);

  const filteredPriceProducts = useMemo(() => {
    const query = normalizeText(priceSearch);
    return priceProducts.filter(product => !query || normalizeText(product.name).includes(query));
  }, [priceProducts, priceSearch]);

  const priceEconomy = useMemo(() => {
    return items
      .filter(item => !item.purchased && Number(item.unitPrice) > 0)
      .map(item => {
        const key = normalizeText(item.name);
        const product = priceProducts.find(p => p.key === key);
        if (!product || product.records.length === 0 || product.average <= 0) return null;

        const current = Number(item.unitPrice) || 0;
        const difference = product.average - current;
        const percent = product.average > 0 ? (difference / product.average) * 100 : 0;
        const estimated = Math.max(0, difference) * item.quantity;

        return {
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          current,
          average: product.average,
          min: product.min,
          difference,
          percent,
          estimated,
          status: current < product.average ? "abaixo" : current > product.average ? "acima" : "media" as const
        };
      })
      .filter(Boolean) as Array<{
        itemId: number; name: string; quantity: number; current: number; average: number;
        min: number; difference: number; percent: number; estimated: number;
        status: "abaixo" | "acima" | "media"
      }>;
  }, [items, priceProducts]);

  const totalEstimatedSavings = priceEconomy.reduce((sum, item) => sum + item.estimated, 0);
  const itemsBelowAverage = priceEconomy.filter(item => item.status === "abaixo").length;

  const selectedPrice = priceProducts.find(p => p.key === selectedPriceProduct) || filteredPriceProducts[0] || null;


  async function deleteHistory(id: number) {
    if (!confirm("Excluir este registro do histórico?")) return;

    const purchase = history.find(p => p.id === id);

    try {
      if (purchase?.cloudId) {
        await deleteCloudHistory(purchase.cloudId);
      }

      setHistory(v => v.filter(p => p.id !== id));
      if (historyDetail?.id === id) setHistoryDetail(null);
    } catch (error) {
      console.error("Erro ao excluir histórico na nuvem:", error);
      setSyncError(error instanceof Error ? error.message : "Não foi possível excluir o histórico na nuvem.");
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


  const [reportMonth, setReportMonth] = useState("Todos");

  const reportData = useMemo(() => {
    const records = reportMonth === "Todos"
      ? history
      : history.filter(record => record.date.slice(0, 7) === reportMonth);

    let totalSpent = 0;
    let totalQuantity = 0;
    const categoryMap = new Map<string, { total: number; quantity: number }>();
    const productMap = new Map<string, { name: string; total: number; quantity: number; purchases: number }>();
    const monthMap = new Map<string, number>();

    records.forEach(record => {
      totalSpent += Number(record.total) || 0;
      totalQuantity += Number(record.itemCount) || 0;

      const monthKey = record.date.slice(0, 7);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (Number(record.total) || 0));

      record.items.forEach(item => {
        const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        const category = categoryMap.get(item.category) || { total: 0, quantity: 0 };
        category.total += itemTotal;
        category.quantity += Number(item.quantity) || 0;
        categoryMap.set(item.category, category);

        const key = normalizeText(item.name);
        const product = productMap.get(key) || {
          name: item.name,
          total: 0,
          quantity: 0,
          purchases: 0,
        };
        product.total += itemTotal;
        product.quantity += Number(item.quantity) || 0;
        product.purchases += 1;
        productMap.set(key, product);
      });
    });

    const categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.total - a.total);

    const products = Array.from(productMap.values())
      .sort((a, b) => b.purchases - a.purchases || b.total - a.total)
      .slice(0, 8);

    const monthly = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({
        month,
        label: new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        total,
      }));

    const months = Array.from(new Set(history.map(record => record.date.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a));

    return {
      records,
      totalSpent,
      totalQuantity,
      averagePurchase: records.length ? totalSpent / records.length : 0,
      categories,
      products,
      monthly,
      months,
    };
  }, [history, reportMonth]);

  const nav = [
    ["Dashboard", LayoutDashboard],
    ["Lista de Compras", ClipboardList],
    ["Categorias", Tags],
    ["Histórico", ListChecks],
    ["Orçamento", BarChart3],
    ["Histórico de Preços", TrendingUp],
    ["Economia", PiggyBank],
    ["Relatórios", BarChart3],
    ["Lista Inteligente", Sparkles],
    ["Reposição Inteligente", RefreshCw],
    ["Alertas", Bell],
    ["Configurações", Settings]
  ] as const;

  function toggle(id: number) {
    setItems(v =>
      v.map(x => x.id === id ? withUpdatedAt({ ...x, purchased: !x.purchased }) : x)
    );
  }

  function changeQuantity(id: number, delta: number) {
    setItems(v =>
      v.map(x =>
        x.id === id
          ? withUpdatedAt({ ...x, quantity: Math.max(1, x.quantity + delta) })
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
          ? withUpdatedAt({ ...x, name: cleanName, category: detectedCategory, quantity, unitPrice })
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
          favorite: false,
          updatedAt: new Date().toISOString(),
        },
      ]);
    }

    setFormError("");
    setModal(false);
    setEdit(null);
    setForm({ name: "", category: "Outros", quantity: 1, unitPrice: 0 });
  }

  async function deleteCloudItem(cloudId?: string) {
    if (!cloudId || !listId) return;
    const deletedAt = new Date().toISOString();
    const raw = localStorage.getItem(DELETED_ITEMS_KEY);
    const tombstones: { cloudId: string; deletedAt: string }[] = raw ? JSON.parse(raw) : [];
    if (!tombstones.some(x => x.cloudId === cloudId)) {
      tombstones.push({ cloudId, deletedAt });
      localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify(tombstones));
    }

    if (!navigator.onLine) return;

    try {
      const { error } = await supabase
        .from("itens")
        .update({ deleted_at: deletedAt, updated_at: deletedAt })
        .eq("id", cloudId)
        .eq("lista_id", listId)
        .lt("updated_at", deletedAt);
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao excluir item na nuvem:", error);
    }
  }

  async function toggleFavorite(item: Item) {
    const nextFavorite = !Boolean(item.favorite);
    const updatedAt = new Date().toISOString();

    setItems(current =>
      current.map(existing =>
        existing.id === item.id
          ? { ...existing, favorite: nextFavorite, updatedAt }
          : existing
      )
    );

    if (item.cloudId && listId && navigator.onLine) {
      try {
        const { error } = await supabase
          .from("itens")
          .update({
            favorito: nextFavorite,
            updated_at: updatedAt,
          })
          .eq("id", item.cloudId)
          .eq("lista_id", listId);

        if (error) throw error;
      } catch (error) {
        console.error("Erro ao sincronizar favorito:", error);
        setSyncError(
          error instanceof Error
            ? error.message
            : "Não foi possível sincronizar o favorito."
        );
      }
    }
  }

  function del(id: number) {
    const x = items.find(i => i.id === id);

    if (x && confirm(`Excluir "${x.name}" da lista?`)) {
      void deleteCloudItem(x.cloudId);
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

    purchasedItems.forEach(x => void deleteCloudItem(x.cloudId));
    setHistory(v => [purchase, ...v]);
    setItems(v => v.filter(x => !x.purchased));

    if (listId && syncStatus === "sincronizado") {
      window.setTimeout(() => {
        void synchronizeHistory(false);
      }, 600);
    }
  }

  function clearPurchased() {
    if (!bought) return;
    if (confirm(`Remover ${bought} item(ns) já comprado(s) da lista?`)) {
      items.filter(x => x.purchased).forEach(x => void deleteCloudItem(x.cloudId));
      setItems(v => v.filter(x => !x.purchased));
    }
  }

  async function linkAnotherDevice() {
    const code = linkCodeInput.trim().toUpperCase();
    if (!code) {
      setSyncMessage("Informe o código de vinculação.");
      return;
    }

    try {
      setSyncStatus("inicializando");
      setSyncError("");
      const { data, error } = await supabase.rpc("vincular_dispositivo_por_codigo", {
        p_codigo: code
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.lista_id) throw new Error("Código de vinculação inválido.");

      const nextListId = String(result.lista_id);
      setListId(nextListId);
      setLinkCode(String(result.codigo_vinculacao || code));
      localStorage.setItem(SYNC_LIST_ID_KEY, nextListId);
      localStorage.setItem(SYNC_CODE_KEY, String(result.codigo_vinculacao || code));

      const { data: rows, error: rowsError } = await supabase
        .from("itens")
        .select("id, lista_id, nome, categoria, quantidade, preco_unitario, comprado, favorito, updated_at, deleted_at")
        .eq("lista_id", nextListId)
        .order("created_at", { ascending: true });
      if (rowsError) throw rowsError;

      const remoteItems = (rows || []).map((row: any, index: number) => ({
        id: Date.now() + index,
        cloudId: row.id,
        updatedAt: row.updated_at,
        name: row.nome,
        category: row.categoria,
        quantity: Number(row.quantidade),
        unitPrice: Number(row.preco_unitario),
        purchased: Boolean(row.comprado),
        favorite: Boolean(row.favorito)
      })) as Item[];

      setItems(remoteItems);

      const remoteHistory = await pullHistoryFromCloud(nextListId);
      setHistory(remoteHistory);
      await synchronizeBudget(false, nextListId);

      setSyncStatus("sincronizado");
      setSyncMessage("Dispositivo vinculado. Lista e histórico carregados da nuvem.");
      setLinkCodeInput("");
    } catch (error) {
      console.error("Erro ao vincular dispositivo:", error);
      setSyncStatus(navigator.onLine ? "erro" : "offline");
      setSyncError(error instanceof Error ? error.message : "Não foi possível vincular o dispositivo.");
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
        purchased: false,
        favorite: false,
        updatedAt: new Date().toISOString()
      }
    ]);

    e.currentTarget.value = "";
  }

  async function syncNow(options: { silent?: boolean } = {}) {
    if (!listId || !navigator.onLine || syncInFlightRef.current) return;

    syncInFlightRef.current = true;

    try {
      if (!options.silent) {
        setSyncError("");
        setSyncStatus("inicializando");
        setSyncMessage("");
      }

      await synchronizeItems(false);
      await synchronizeHistory(false);
      await synchronizeBudget(false);

      const syncedAt = new Date().toISOString();
      localStorage.setItem(SYNC_LAST_SYNC_KEY, syncedAt);
      setLastSyncAt(syncedAt);
      setSyncStatus("sincronizado");

      if (!options.silent) {
        setSyncMessage("Lista e histórico sincronizados automaticamente.");
      }
    } catch (error) {
      console.error("Erro ao sincronizar lista e histórico:", error);
      setSyncStatus(navigator.onLine ? "erro" : "offline");
      setSyncError(
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar a lista e o histórico."
      );
    } finally {
      syncInFlightRef.current = false;
      setSyncingNow(false);
    }
  }

  useEffect(() => {
    if (!listId) return;

    const syncWhenOnline = () => {
      if (navigator.onLine) void syncNow({ silent: true });
      else setSyncStatus("offline");
    };

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        syncWhenOnline();
      }
    };

    const handleOffline = () => {
      setSyncStatus("offline");
      setSyncMessage("Sem conexão. As alterações ficam salvas localmente.");
    };

    const handleOnline = () => {
      setSyncStatus("inicializando");
      setSyncMessage("Conexão restabelecida. Sincronizando...");
      void syncNow({ silent: true });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", syncWhenVisible);

    // Atualiza silenciosamente enquanto a página estiver aberta.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void syncNow({ silent: true });
      }
    }, 60000);

    if (!navigator.onLine) {
      setSyncStatus("offline");
    } else {
      void syncNow({ silent: true });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(interval);
    };
  }, [listId]);

  const frequentProducts = useMemo(() => {
    const pendingNames = new Set(
      items
        .filter(item => !item.purchased)
        .map(item => normalizeText(item.name))
    );

    const stats = new Map<string, {
      name: string;
      category: string;
      unitPrice: number;
      purchases: number;
      lastDate: string;
      favorite: boolean;
    }>();

    history.forEach(purchase => {
      purchase.items.forEach(item => {
        const key = normalizeText(item.name);
        if (!key) return;

        const existing = stats.get(key);
        if (!existing) {
          stats.set(key, {
            name: item.name,
            category: item.category || detectCategory(item.name),
            unitPrice: Number(item.unitPrice) || 0,
            purchases: 1,
            lastDate: purchase.date,
            favorite: Boolean(item.favorite),
          });
        } else {
          existing.purchases += 1;
          if (new Date(purchase.date).getTime() > new Date(existing.lastDate).getTime()) {
            existing.lastDate = purchase.date;
            existing.unitPrice = Number(item.unitPrice) || existing.unitPrice;
            existing.category = item.category || existing.category;
          }
          existing.favorite = existing.favorite || Boolean(item.favorite);
        }
      });
    });

    return Array.from(stats.values())
      .filter(product => product.purchases >= 1 && !pendingNames.has(normalizeText(product.name)))
      .sort((a, b) => {
        if (b.purchases !== a.purchases) return b.purchases - a.purchases;
        return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
      })
      .slice(0, 8);
  }, [history, items]);

  const intelligentProducts = useMemo(() => {
    const pendingNames = new Set(items.filter(item => !item.purchased).map(item => normalizeText(item.name)));
    const stats = new Map<string, { name:string; category:string; unitPrice:number; purchases:number; lastDate:string; favorite:boolean }>();
    history.forEach(purchase => purchase.items.forEach(item => {
      const key=normalizeText(item.name); if(!key) return; const e=stats.get(key);
      if(!e) stats.set(key,{name:item.name,category:item.category||detectCategory(item.name),unitPrice:Number(item.unitPrice)||0,purchases:1,lastDate:purchase.date,favorite:Boolean(item.favorite)});
      else { e.purchases++; e.favorite=e.favorite||Boolean(item.favorite); if(new Date(purchase.date).getTime()>new Date(e.lastDate).getTime()){e.lastDate=purchase.date;e.unitPrice=Number(item.unitPrice)||e.unitPrice;e.category=item.category||e.category;} }
    }));
    const now=Date.now();
    return Array.from(stats.values()).filter(p=>!pendingNames.has(normalizeText(p.name))).map(product=>{
      const daysSince=Math.max(0,Math.floor((now-new Date(product.lastDate).getTime())/86400000));
      const recencyScore=daysSince<=7?35:daysSince<=14?28:daysSince<=30?20:daysSince<=60?10:3;
      const frequencyScore=Math.min(40,product.purchases*8), favoriteScore=product.favorite?25:0;
      const score=Math.min(100,frequencyScore+recencyScore+favoriteScore);
      const reason=product.favorite?"Favorito + comprado com frequência":product.purchases>=3?"Comprado com frequência":daysSince<=14?"Comprado recentemente":"Já comprado anteriormente";
      return {...product,daysSince,score,reason};
    }).sort((a,b)=>b.score-a.score||b.purchases-a.purchases||a.name.localeCompare(b.name,"pt-BR")).slice(0,12);
  }, [history, items]);

  const replenishmentProducts = useMemo(() => {
    const pendingNames=new Set(items.filter(item=>!item.purchased).map(item=>normalizeText(item.name)));
    const stats=new Map<string,{name:string;category:string;unitPrice:number;favorite:boolean;dates:string[]}>();
    history.forEach(purchase=>purchase.items.forEach(item=>{
      const key=normalizeText(item.name); if(!key) return; const e=stats.get(key);
      if(!e) stats.set(key,{name:item.name,category:item.category||detectCategory(item.name),unitPrice:Number(item.unitPrice)||0,favorite:Boolean(item.favorite),dates:[purchase.date]});
      else { e.dates.push(purchase.date); e.favorite=e.favorite||Boolean(item.favorite); if(new Date(purchase.date).getTime()>new Date(e.dates[e.dates.length-2]).getTime()){e.unitPrice=Number(item.unitPrice)||e.unitPrice;e.category=item.category||e.category;} }
    }));
    const now=Date.now();
    return Array.from(stats.values()).filter(p=>p.dates.length>=2&&!pendingNames.has(normalizeText(p.name))).map(product=>{
      const dates=[...product.dates].sort((a,b)=>new Date(a).getTime()-new Date(b).getTime());
      const intervals=dates.slice(1).map((d,i)=>Math.max(1,Math.round((new Date(d).getTime()-new Date(dates[i]).getTime())/86400000)));
      const averageInterval=intervals.reduce((sum,v)=>sum+v,0)/intervals.length;
      const daysSince=Math.max(0,Math.floor((now-new Date(dates.at(-1)!).getTime())/86400000));
      const due=daysSince>=Math.max(3,Math.round(averageInterval*0.85));
      const dueRatio=daysSince/Math.max(averageInterval,1);
      const confidence=Math.min(100,Math.round(dueRatio*55+Math.min(35,dates.length*7)+(product.favorite?10:0)));
      return {...product,purchases:dates.length,lastDate:dates.at(-1)!,averageInterval:Math.round(averageInterval),daysSince,overdueDays:Math.round(daysSince-averageInterval),due,confidence,status:dueRatio>=1.25?"Provavelmente está na hora de comprar":"Próximo do período habitual de compra"};
    }).filter(p=>p.due).sort((a,b)=>b.confidence-a.confidence||b.overdueDays-a.overdueDays).slice(0,12);
  }, [history, items]);

  const smartAlerts = useMemo(() => {
    type SmartAlert = {
      id: string;
      title: string;
      description: string;
      tone: "amber" | "red" | "emerald" | "blue";
    };

    const alerts: SmartAlert[] = [];
    const now = new Date();

    if (monthlyBudget > 0 && budgetPercent >= 80) {
      alerts.push({
        id: "budget",
        title: budgetPercent >= 100 ? "Orçamento mensal atingido" : "Orçamento próximo do limite",
        description: budgetPercent >= 100
          ? `Você já utilizou ${Math.round(budgetPercent)}% do orçamento deste mês.`
          : `Você já utilizou ${Math.round(budgetPercent)}% do orçamento deste mês.`,
        tone: budgetPercent >= 100 ? "red" : "amber",
      });
    }

    if (pending >= 8) {
      alerts.push({
        id: "pending",
        title: "Muitos itens pendentes",
        description: `Sua lista possui ${pending} produtos aguardando compra.`,
        tone: "amber",
      });
    }

    const priceAlerts = new Map<string, {
      name: string;
      previous: number;
      latest: number;
      change: number;
    }>();

    const priceStats = new Map<string, { name: string; prices: { date: string; price: number }[] }>();

    history.forEach(purchase => {
      purchase.items.forEach(item => {
        const key = normalizeText(item.name);
        if (!key) return;

        const price = Number(item.unitPrice) || 0;
        if (price <= 0) return;

        const entry = priceStats.get(key) || { name: item.name, prices: [] };
        entry.prices.push({ date: purchase.date, price });
        priceStats.set(key, entry);
      });
    });

    priceStats.forEach(entry => {
      const ordered = [...entry.prices].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      if (ordered.length < 2) return;

      const previous = ordered[ordered.length - 2].price;
      const latest = ordered[ordered.length - 1].price;
      if (previous <= 0) return;

      const change = ((latest - previous) / previous) * 100;

      if (change >= 15) {
        priceAlerts.set(entry.name, {
          name: entry.name,
          previous,
          latest,
          change,
        });
      }
    });

    Array.from(priceAlerts.values())
      .sort((a, b) => b.change - a.change)
      .slice(0, 2)
      .forEach(alert => {
        alerts.push({
          id: `price-up-${normalizeText(alert.name)}`,
          title: `Aumento de preço: ${alert.name}`,
          description: `De ${money(alert.previous)} para ${money(alert.latest)} (+${Math.round(alert.change)}%).`,
          tone: "red",
        });
      });

    const favoriteLastPurchases = new Map<string, { name: string; date: string }>();

    history.forEach(purchase => {
      purchase.items.forEach(item => {
        if (!item.favorite) return;

        const key = normalizeText(item.name);
        const current = favoriteLastPurchases.get(key);

        if (!current || new Date(purchase.date).getTime() > new Date(current.date).getTime()) {
          favoriteLastPurchases.set(key, {
            name: item.name,
            date: purchase.date,
          });
        }
      });
    });

    Array.from(favoriteLastPurchases.values())
      .map(item => ({
        ...item,
        days: Math.floor(
          (now.getTime() - new Date(item.date).getTime()) / 86400000
        ),
      }))
      .filter(item => item.days >= 30)
      .sort((a, b) => b.days - a.days)
      .slice(0, 2)
      .forEach(item => {
        alerts.push({
          id: `favorite-${normalizeText(item.name)}`,
          title: `Favorito sem comprar: ${item.name}`,
          description: `A última compra registrada foi há ${item.days} dias.`,
          tone: "blue",
        });
      });

    if (alerts.length === 0) {
      alerts.push({
        id: "healthy",
        title: "Tudo em ordem",
        description: "Nenhum alerta importante foi identificado no momento.",
        tone: "emerald",
      });
    }

    return alerts.slice(0, 6);
  }, [history, monthlyBudget, budgetPercent, pending]);

  async function addFrequentProduct(product: {
    name: string;
    category: string;
    unitPrice: number;
    favorite: boolean;
  }) {
    setQuickAddingName(product.name);

    const newItem: Item = {
      id: Date.now(),
      name: product.name,
      category: product.category || detectCategory(product.name),
      quantity: 1,
      unitPrice: Number(product.unitPrice) || 0,
      purchased: false,
      favorite: Boolean(product.favorite),
      updatedAt: new Date().toISOString(),
    };

    setItems(current => [newItem, ...current]);

    if (listId && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from("itens")
          .insert({
            lista_id: listId,
            nome: newItem.name,
            categoria: newItem.category,
            quantidade: newItem.quantity,
            preco_unitario: newItem.unitPrice,
            comprado: false,
            favorito: newItem.favorite,
            updated_at: newItem.updatedAt,
          })
          .select("id")
          .single();

        if (error) throw error;

        if (data?.id) {
          setItems(current =>
            current.map(item =>
              item.id === newItem.id
                ? { ...item, cloudId: String(data.id) }
                : item
            )
          );
        }
      } catch (error) {
        console.error("Erro ao adicionar produto frequente:", error);
        setSyncError(
          error instanceof Error
            ? error.message
            : "Não foi possível sincronizar o produto frequente."
        );
      }
    }

    setQuickAddingName(null);
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
              <div className="text-xs text-slate-400">versão 1.3.4</div>
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

      <button
        type="button"
        onClick={() => setMobile(true)}
        aria-label="Abrir menu"
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
      >
        <Menu size={20} />
      </button>

      <main className="lg:ml-64">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-16 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              {syncingNow ? (
                <Loader2 className="shrink-0 animate-spin text-blue-500" size={20} />
              ) : syncStatus === "sincronizado" ? (
                <Cloud className="shrink-0 text-emerald-500" size={20} />
              ) : (
                <CloudOff className="shrink-0 text-slate-400" size={20} />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-bold ${
                  syncingNow
                    ? "text-blue-700"
                    : syncStatus === "sincronizado"
                      ? "text-emerald-700"
                      : syncStatus === "offline"
                        ? "text-slate-600"
                        : "text-red-700"
                }`}>
                  {syncingNow
                    ? "Sincronizando..."
                    : syncStatus === "sincronizado"
                      ? "Sincronizado agora"
                      : syncStatus === "offline"
                        ? "Modo offline"
                        : "Sincronização pendente"}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {lastSyncAt
                    ? `Última sincronização: ${new Date(lastSyncAt).toLocaleTimeString("pt-BR")}`
                    : "Nenhuma sincronização concluída ainda"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => syncNow()}
              disabled={syncingNow || syncStatus === "offline"}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncingNow ? "Sincronizando..." : "Sincronizar agora"}
            </button>
          </div>



        <section className="mx-auto max-w-7xl p-4 sm:p-8">
          {page === "Dashboard" ? (
            shoppingMode ? (
              <section className="space-y-5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Modo de Compras</p>
                      <h1 className="mt-1 text-2xl font-bold text-slate-900">🛒 Lista de Compras</h1>
                      <p className="mt-1 text-sm text-slate-600">Mostrando somente os itens que ainda precisam ser comprados.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-emerald-700 shadow-sm">
                      {pending} pendente{pending === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Itens da lista</h2>
                      <p className="text-xs text-slate-400">Toque no item para marcar como comprado.</p>
                    </div>
                    <button type="button" onClick={() => setShoppingMode(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Sair do modo</button>
                  </div>
                  {shown.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-8 text-center">
                      <CheckCircle2 className="mx-auto text-emerald-500" size={34} />
                      <p className="mt-3 font-semibold text-slate-800">Lista concluída!</p>
                      <p className="mt-1 text-sm text-slate-400">Não há itens pendentes para comprar.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shown.map(item => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                          <button type="button" onClick={() => toggle(item.id)} className="shrink-0 text-emerald-600" aria-label={`Marcar ${item.name} como comprado`}><Circle size={23} /></button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.category} · {money(item.unitPrice)} cada</p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1">
                            <button type="button" onClick={() => changeQuantity(item.id, -1)} className="rounded-md p-1.5 text-slate-600"><Minus size={15} /></button>
                            <span className="min-w-7 text-center text-sm font-bold">{item.quantity}</span>
                            <button type="button" onClick={() => changeQuantity(item.id, 1)} className="rounded-md p-1.5 text-slate-600"><Plus size={15} /></button>
                          </div>
                          <span className="hidden shrink-0 font-bold text-slate-800 sm:block">{money(item.quantity * item.unitPrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : (
            <>
              <div className="mb-7">
                <p className="mb-1 text-sm font-medium text-emerald-600">
                  Boa tarde! 👋
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-bold sm:text-4xl">Sua lista de mercado</h1>
                    <p className="mt-2 text-slate-500">
                      Uma visão rápida do que está acontecendo com suas compras.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShoppingMode(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
                  >
                    <ShoppingCart size={18} />
                    Iniciar compras
                  </button>
                </div>
              </div>



              <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Pendentes</p>
                      <p className="mt-1 font-bold text-slate-800">{pending}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Comprados</p>
                      <p className="mt-1 font-bold text-emerald-700">{bought}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Itens</p>
                      <p className="mt-1 font-bold text-slate-800">{items.length}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="mt-1 font-bold text-slate-800">{money(total)}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Resumo da lista</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {bought} de {items.length} item(ns) comprados
                      </p>
                    </div>
                    <span className="text-lg font-bold text-emerald-600">
                      {items.length ? Math.round((bought / items.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${items.length ? (bought / items.length) * 100 : 0}%` }}
                    />
                  </div>

                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Visão do orçamento</h2>
                      <p className="mt-1 text-sm text-slate-400">Gastos registrados neste mês.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage("Orçamento")}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Ver orçamento →
                    </button>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-slate-400">Gasto no mês</p>
                      <p className="text-2xl font-bold">{money(currentMonthSpent)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Orçamento</p>
                      <p className="font-bold text-emerald-700">{money(monthlyBudget)}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${budgetPercent >= 100 ? "bg-red-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, budgetPercent)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {Math.round(budgetPercent)}% utilizado · {money(budgetRemaining)} restante
                  </p>
                </section>
              </div>

              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="text-amber-500" size={19} />
                      <h2 className="font-bold">Alertas</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">O que merece sua atenção agora.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPage("Alertas")}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Ver todos →
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {smartAlerts.slice(0, 3).map(alert => {
                    const toneClass = {
                      amber: "border-amber-200 bg-amber-50 text-amber-800",
                      red: "border-red-200 bg-red-50 text-red-800",
                      emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      blue: "border-blue-200 bg-blue-50 text-blue-800",
                    }[alert.tone];
                    return (
                      <div key={alert.id} className={`rounded-xl border p-3 ${toneClass}`}>
                        <p className="font-semibold">{alert.title}</p>
                        <p className="mt-1 text-xs opacity-80">{alert.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold">Ações inteligentes</h2>
                    <p className="mt-1 text-sm text-slate-400">Atalhos para decidir o que comprar.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <button type="button" onClick={() => setPage("Lista Inteligente")} className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50">
                    <Sparkles className="text-emerald-600" size={20} />
                    <p className="mt-3 font-semibold">Lista Inteligente</p>
                    <p className="mt-1 text-xs text-slate-400">Sugestões baseadas no histórico.</p>
                  </button>
                  <button type="button" onClick={() => setPage("Reposição Inteligente")} className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50">
                    <RefreshCw className="text-emerald-600" size={20} />
                    <p className="mt-3 font-semibold">Reposição</p>
                    <p className="mt-1 text-xs text-slate-400">Produtos que podem estar na hora de comprar.</p>
                  </button>
                  <button type="button" onClick={() => setPage("Economia")} className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50">
                    <PiggyBank className="text-emerald-600" size={20} />
                    <p className="mt-3 font-semibold">Economia</p>
                    <p className="mt-1 text-xs text-slate-400">{money(totalEstimatedSavings)} de economia estimada.</p>
                  </button>
                  <button type="button" onClick={() => setPage("Histórico")} className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-200 hover:bg-emerald-50">
                    <ListChecks className="text-emerald-600" size={20} />
                    <p className="mt-3 font-semibold">Histórico</p>
                    <p className="mt-1 text-xs text-slate-400">{history.length} compra(s) registrada(s).</p>
                  </button>
                </div>
              </section>

              <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold">Lista de Compras</h2>
                    <p className="mt-1 text-sm text-slate-400">{shown.length} item(ns) pendente(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShoppingMode(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                  >
                    <ShoppingCart size={16} />
                    Abrir modo compras
                  </button>
                </div>

                {shown.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                    <p className="mt-2 font-semibold">Sua lista está em dia!</p>
                    <p className="mt-1 text-sm text-slate-400">Não há produtos pendentes no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {shown.slice(0, 8).map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                        <button type="button" onClick={() => toggle(item.id)} className="shrink-0 text-slate-300 hover:text-emerald-500">
                          <Circle size={20} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.category} · Qtd. {item.quantity}</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold">{money(item.quantity * item.unitPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
            )
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
                  {page === "Histórico de Preços" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">
                          Acompanhamento de preços
                        </p>
                        <h1 className="text-3xl font-bold">Histórico de Preços</h1>
                        <p className="mt-2 text-slate-500">
                          Consulte os preços registrados nas compras finalizadas.
                        </p>
                      </div>

                      {!priceProducts.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <TrendingUp className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Ainda não há histórico de preços</h2>
                          <p className="mt-2 text-sm text-slate-500">
                            Finalize uma compra para começar a registrar a evolução dos preços.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                              <input
                                value={priceSearch}
                                onChange={e => setPriceSearch(e.target.value)}
                                placeholder="Buscar produto..."
                                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                              <h2 className="px-3 pb-3 font-bold">Produtos</h2>
                              <div className="max-h-[520px] space-y-1 overflow-auto">
                                {filteredPriceProducts.map(product => (
                                  <button
                                    key={product.key}
                                    onClick={() => setSelectedPriceProduct(product.key)}
                                    className={`w-full rounded-xl px-3 py-3 text-left transition ${
                                      (selectedPrice?.key === product.key)
                                        ? "bg-emerald-50 text-emerald-800"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <div className="font-semibold">{product.name}</div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {product.records.length} registro(s)
                                    </div>
                                  </button>
                                ))}
                                {!filteredPriceProducts.length && (
                                  <p className="px-3 py-5 text-sm text-slate-400">Nenhum produto encontrado.</p>
                                )}
                              </div>
                            </div>

                            {selectedPrice && (
                              <div className="space-y-5">
                                <div>
                                  <h2 className="text-2xl font-bold">{selectedPrice.name}</h2>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {selectedPrice.records.length} compra(s) registrada(s)
                                  </p>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                  <SummaryCard title="Último preço" value={money(selectedPrice.last)} subtitle="Registro mais recente" />
                                  <SummaryCard title="Menor preço" value={money(selectedPrice.min)} subtitle="Menor valor registrado" />
                                  <SummaryCard title="Maior preço" value={money(selectedPrice.max)} subtitle="Maior valor registrado" />
                                  <SummaryCard title="Preço médio" value={money(selectedPrice.average)} subtitle="Média dos registros" />
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                  <h3 className="font-bold">Evolução do preço</h3>
                                  <div className="mt-5 space-y-4">
                                    {selectedPrice.records.map((record, index) => {
                                      const max = Math.max(selectedPrice.max, 1);
                                      const width = Math.max(4, (record.price / max) * 100);
                                      const previous = index > 0 ? selectedPrice.records[index - 1].price : null;
                                      const difference = previous === null ? null : record.price - previous;
                                      return (
                                        <div key={`${record.date}-${index}`}>
                                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                            <span className="text-slate-500">
                                              {new Date(record.date).toLocaleDateString("pt-BR")}
                                            </span>
                                            <span className="font-bold">{money(record.price)}</span>
                                          </div>
                                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${width}%` }} />
                                          </div>
                                          <div className="mt-1 flex justify-between text-xs text-slate-400">
                                            <span>Qtd. {record.quantity}</span>
                                            {difference !== null && (
                                              <span className={difference > 0 ? "text-red-500" : difference < 0 ? "text-emerald-600" : "text-slate-400"}>
                                                {difference > 0 ? "+" : ""}{money(difference)} vs. compra anterior
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : page === "Relatórios" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">Análise das suas compras</p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h1 className="text-3xl font-bold">Relatórios</h1>
                            <p className="mt-2 text-slate-500">
                              Gastos, categorias, produtos e evolução das compras.
                            </p>
                          </div>
                          <select
                            value={reportMonth}
                            onChange={e => setReportMonth(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="Todos">Todos os períodos</option>
                            {reportData.months.map(month => (
                              <option key={month} value={month}>
                                {new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard title="Total gasto" value={money(reportData.totalSpent)} subtitle={reportMonth === "Todos" ? "Todo o histórico" : "Período selecionado"} />
                        <SummaryCard title="Compras" value={String(reportData.records.length)} subtitle="Registros no período" />
                        <SummaryCard title="Média por compra" value={money(reportData.averagePurchase)} subtitle="Valor médio" />
                        <SummaryCard title="Itens comprados" value={String(reportData.totalQuantity)} subtitle="Quantidade registrada" />
                      </div>

                      {!reportData.records.length ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <BarChart3 className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Ainda não há dados para este período</h2>
                          <p className="mt-2 text-sm text-slate-500">Finalize uma compra para começar a gerar os relatórios.</p>
                        </div>
                      ) : (
                        <>
                          <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="mb-5">
                                <h2 className="font-bold">Gastos por categoria</h2>
                                <p className="mt-1 text-sm text-slate-400">Distribuição dos valores registrados.</p>
                              </div>
                              <div className="space-y-4">
                                {reportData.categories.map(category => {
                                  const percent = reportData.totalSpent ? (category.total / reportData.totalSpent) * 100 : 0;
                                  return (
                                    <div key={category.name}>
                                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium">{category.name}</span>
                                        <span className="font-semibold">{money(category.total)}</span>
                                      </div>
                                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, percent)}%` }} />
                                      </div>
                                      <p className="mt-1 text-xs text-slate-400">{Math.round(percent)}% · {category.quantity} unidade(s)</p>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="mb-5">
                                <h2 className="font-bold">Evolução mensal</h2>
                                <p className="mt-1 text-sm text-slate-400">Últimos meses com registros.</p>
                              </div>
                              <div className="flex h-56 items-end gap-3">
                                {reportData.monthly.map(point => {
                                  const max = Math.max(...reportData.monthly.map(x => x.total), 1);
                                  const height = Math.max(8, (point.total / max) * 100);
                                  return (
                                    <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                                      <span className="text-[10px] font-semibold text-slate-500">{money(point.total)}</span>
                                      <div className="w-full max-w-10 rounded-t-lg bg-emerald-500" style={{ height: `${height}%` }} />
                                      <span className="truncate text-[10px] text-slate-400">{point.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          </div>

                          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-5">
                              <h2 className="font-bold">Produtos mais comprados</h2>
                              <p className="mt-1 text-sm text-slate-400">Ordenados pela frequência registrada.</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {reportData.products.map((product, index) => (
                                <div key={normalizeText(product.name)} className="flex items-center gap-3 py-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{index + 1}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold">{product.name}</p>
                                    <p className="text-xs text-slate-400">{product.purchases} compra(s) · {product.quantity} unidade(s)</p>
                                  </div>
                                  <span className="shrink-0 text-sm font-bold">{money(product.total)}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        </>
                      )}
                    </>
                  ) : page === "Economia" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">Análise financeira</p>
                        <h1 className="text-3xl font-bold">Comparação de Preços e Economia</h1>
                        <p className="mt-2 text-slate-500">Compare os preços atuais da lista com o histórico registrado.
                        </p>
                      </div>

                      {!priceEconomy.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <PiggyBank className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Ainda não há dados para comparar</h2>
                          <p className="mt-2 text-sm text-slate-500">
                            Adicione preços aos itens da lista e tenha histórico de compras para gerar a análise.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <SummaryCard title="Itens analisados" value={String(priceEconomy.length)} subtitle="Com histórico de preços" />
                            <SummaryCard title="Abaixo da média" value={String(itemsBelowAverage)} subtitle="Oportunidades de economia" />
                            <SummaryCard title="Economia estimada" value={money(totalEstimatedSavings)} subtitle="Se os preços atuais forem mantidos" />
                            <SummaryCard title="Itens na média/acima" value={String(priceEconomy.length - itemsBelowAverage)} subtitle="Sem economia estimada" />
                          </div>

                          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="space-y-3">
                              {priceEconomy.map(item => (
                                <div key={item.itemId} className="rounded-xl border border-slate-100 p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="font-bold">{item.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">Qtd. {item.quantity} · Menor histórico {money(item.min)}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-right text-sm sm:grid-cols-3">
                                      <div><p className="text-xs text-slate-400">Atual</p><p className="font-bold">{money(item.current)}</p></div>
                                      <div><p className="text-xs text-slate-400">Média</p><p className="font-bold">{money(item.average)}</p></div>
                                      <div><p className="text-xs text-slate-400">Diferença</p><p className={`font-bold ${item.status === "abaixo" ? "text-emerald-600" : item.status === "acima" ? "text-red-600" : "text-slate-500"}`}>{item.difference > 0 ? "-" : item.difference < 0 ? "+" : ""}{money(Math.abs(item.difference))}</p></div>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className={`font-semibold ${item.status === "abaixo" ? "text-emerald-700" : item.status === "acima" ? "text-red-600" : "text-slate-500"}`}>
                                      {item.status === "abaixo" ? `📉 ${Math.abs(item.percent).toFixed(1).replace(".", ",")}% abaixo da média` : item.status === "acima" ? `📈 ${Math.abs(item.percent).toFixed(1).replace(".", ",")}% acima da média` : "Preço na média histórica"}
                                    </span>
                                    {item.status === "abaixo" && <span className="font-semibold text-emerald-700">Economia potencial: {money(item.estimated)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <button onClick={() => setPage("Dashboard")} className="mt-6 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white">Voltar ao Dashboard</button>
                    </>
                  ) : page === "Lista Inteligente" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">
                          Sugestões inteligentes
                        </p>
                        <h1 className="text-3xl font-bold">Lista Inteligente</h1>
                        <p className="mt-2 text-slate-500">
                          Sugestões calculadas automaticamente a partir dos seus favoritos, frequência e recência de compras.
                        </p>
                      </div>

                      {!intelligentProducts.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <Sparkles className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Ainda não há sugestões</h2>
                          <p className="mt-2 text-sm text-slate-500">
                            Finalize algumas compras para que o sistema aprenda seus produtos mais recorrentes.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {intelligentProducts.map(product => (
                            <div key={normalizeText(product.name)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {product.favorite && <Star size={17} className="fill-amber-400 text-amber-400" />}
                                    <h2 className="truncate font-bold text-slate-900">{product.name}</h2>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">{product.category}</p>
                                </div>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {product.score}/100
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <span className="text-slate-400">Compras</span>
                                  <div className="mt-1 font-bold text-slate-800">{product.purchases}</div>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <span className="text-slate-400">Último preço</span>
                                  <div className="mt-1 font-bold text-slate-800">{money(product.unitPrice)}</div>
                                </div>
                              </div>

                              <p className="mt-3 text-xs text-slate-500">
                                💡 {product.reason} • última compra há {product.daysSince} dia(s)
                              </p>

                              <button
                                type="button"
                                onClick={() => void addFrequentProduct(product)}
                                disabled={quickAddingName === product.name}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                              >
                                <Plus size={17} />
                                {quickAddingName === product.name ? "Adicionando..." : "Adicionar à lista"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : page === "Reposição Inteligente" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">
                          Previsão baseada no seu histórico
                        </p>
                        <h1 className="text-3xl font-bold">Reposição Inteligente</h1>
                        <p className="mt-2 text-slate-500">
                          Produtos recorrentes que chegaram ou estão próximos do intervalo habitual de compra.
                        </p>
                      </div>

                      {!replenishmentProducts.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <RefreshCw className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Nenhuma reposição identificada</h2>
                          <p className="mt-2 text-sm text-slate-500">
                            O sistema precisa de pelo menos duas compras do mesmo produto para calcular um intervalo.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {replenishmentProducts.map(product => (
                            <div key={normalizeText(product.name)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {product.favorite && <Star size={17} className="fill-amber-400 text-amber-400" />}
                                    <h2 className="truncate font-bold text-slate-900">{product.name}</h2>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">{product.category}</p>
                                </div>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                  {product.confidence}%
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <span className="text-slate-400">Intervalo médio</span>
                                  <div className="mt-1 font-bold text-slate-800">{product.averageInterval} dias</div>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3">
                                  <span className="text-slate-400">Último preço</span>
                                  <div className="mt-1 font-bold text-slate-800">{money(product.unitPrice)}</div>
                                </div>
                              </div>

                              <p className="mt-3 text-xs text-slate-500">
                                🧠 {product.status} • última compra há {product.daysSince} dia(s)
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {product.purchases} compras registradas • sem adição automática
                              </p>

                              <button
                                type="button"
                                onClick={() => void addFrequentProduct(product)}
                                disabled={quickAddingName === product.name}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                              >
                                <Plus size={17} />
                                {quickAddingName === product.name ? "Adicionando..." : "Adicionar à lista"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : page === "Reposição Inteligente" ? (
                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-emerald-600">Previsão baseada no seu histórico</p>
                        <h1 className="text-3xl font-bold">Reposição Inteligente</h1>
                        <p className="mt-2 text-slate-500">Produtos recorrentes que chegaram ou estão próximos do intervalo habitual de compra.</p>
                      </div>
                      {!replenishmentProducts.length ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                          <RefreshCw className="mx-auto text-slate-300" size={42} />
                          <h2 className="mt-4 text-lg font-bold">Nenhuma reposição identificada</h2>
                          <p className="mt-2 text-sm text-slate-500">O sistema precisa de pelo menos duas compras do mesmo produto para calcular um intervalo.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {replenishmentProducts.map(product => (
                            <div key={normalizeText(product.name)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2">{product.favorite && <Star size={17} className="fill-amber-400 text-amber-400" />}<h2 className="truncate font-bold text-slate-900">{product.name}</h2></div><p className="mt-1 text-xs text-slate-500">{product.category}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{product.confidence}%</span></div>
                              <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Intervalo médio</span><div className="mt-1 font-bold text-slate-800">{product.averageInterval} dias</div></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Último preço</span><div className="mt-1 font-bold text-slate-800">{money(product.unitPrice)}</div></div></div>
                              <p className="mt-3 text-xs text-slate-500">🧠 {product.status} • última compra há {product.daysSince} dia(s)</p><p className="mt-1 text-xs text-slate-400">{product.purchases} compras registradas • sem adição automática</p>
                              <button type="button" onClick={() => void addFrequentProduct(product)} disabled={quickAddingName === product.name} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"><Plus size={17} />{quickAddingName === product.name ? "Adicionando..." : "Adicionar à lista"}</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : page === "Alertas" ? (

                    <>
                      <div className="mb-7">
                        <p className="text-sm font-medium text-amber-600">
                          Monitoramento automático
                        </p>
                        <h1 className="text-3xl font-bold">Alertas Inteligentes</h1>
                        <p className="mt-2 text-slate-500">
                          Acompanhe avisos importantes gerados a partir da sua lista, orçamento e histórico.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {smartAlerts.map(alert => {
                          const toneClass = {
                            amber: "border-amber-200 bg-amber-50 text-amber-800",
                            red: "border-red-200 bg-red-50 text-red-800",
                            emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
                            blue: "border-blue-200 bg-blue-50 text-blue-800",
                          }[alert.tone];

                          return (
                            <div
                              key={alert.id}
                              className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}
                            >
                              <div className="flex items-start gap-3">
                                <Bell size={20} className="mt-0.5 shrink-0" />
                                <div>
                                  <h2 className="font-bold">{alert.title}</h2>
                                  <p className="mt-2 text-sm opacity-80">
                                    {alert.description}
                                  </p>
                                </div>
                              </div>
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
                  ) : page === "Orçamento" ? (
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
                  ) : page === "Configurações" ? (
                    <>
                    <div className="mb-7">
                      <p className="text-sm font-medium text-emerald-600">
                        Sincronização
                      </p>
                      <h1 className="text-3xl font-bold">Configurações</h1>
                      <p className="mt-2 text-slate-500">
                        Sincronização automática dos itens e histórico entre seus dispositivos.
                      </p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="font-bold">Conexão com a nuvem</h2>
                            <p className="mt-1 text-sm text-slate-400">
                              Supabase conectado para sincronização automática.
                            </p>
                          </div>

                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            syncStatus === "sincronizado"
                              ? "bg-emerald-50 text-emerald-700"
                              : syncStatus === "offline"
                                ? "bg-amber-50 text-amber-700"
                                : syncStatus === "erro"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                          }`}>
                            {syncStatus === "sincronizado"
                              ? "Pronto"
                              : syncStatus === "offline"
                                ? "Offline"
                                : syncStatus === "erro"
                                  ? "Erro"
                                  : "Conectando"}
                          </span>
                        </div>

                        <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Lista vinculada</span>
                            <b>{listId ? "Sim" : "Não"}</b>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Identificador</span>
                            <b className="max-w-[240px] truncate text-right font-mono text-xs">
                              {listId || "Aguardando..."}
                            </b>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Código de vinculação</span>
                            <b className="font-mono text-xs">
                              {linkCode || "Aguardando..."}
                            </b>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Última sincronização</span>
                            <b className="text-right text-xs">
                              {lastSyncAt
                                ? new Date(lastSyncAt).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })
                                : "Ainda não sincronizado"}
                            </b>
                          </div>
                        </div>

                        {syncError && (
                          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                            {syncError}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-bold">Sincronização da lista</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Os itens ficam disponíveis nos dispositivos vinculados à mesma lista.
                        </p>

                        <button
                          onClick={() => void syncNow()}
                          disabled={syncingItems || !listId}
                          className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {syncingItems || syncingHistory ? "Sincronizando..." : "Sincronizar agora"}
                        </button>

                        {syncMessage && (
                          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                            {syncMessage}
                          </div>
                        )}

                        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                          <p>✓ Adicionar, editar e marcar itens como comprados sincroniza.</p>
                          <p>✓ Histórico de compras também sincroniza entre dispositivos.</p>
                          <p>✓ Favoritos sincronizam entre PC e celular.</p>
                          <p>✓ Compra rápida usa automaticamente produtos do seu histórico.</p>
                          <p className="mt-2">✓ Excluir itens também remove o registro da nuvem.</p>
                          <p className="mt-2">✓ localStorage continua disponível para uso offline.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="font-bold">Vincular outro dispositivo</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Em outro dispositivo, use o código desta lista para entrar na mesma lista de compras.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          value={linkCodeInput}
                          onChange={e => setLinkCodeInput(e.target.value.toUpperCase())}
                          placeholder="Ex.: LM-ABC123DEF456"
                          className="rounded-xl border border-slate-200 px-4 py-3 font-mono uppercase outline-none focus:border-emerald-400"
                        />
                        <button
                          onClick={() => void linkAnotherDevice()}
                          disabled={!linkCodeInput.trim()}
                          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Vincular
                        </button>
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
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="mx-auto mb-1 flex h-5 w-full items-center justify-center rounded-md bg-emerald-50 text-emerald-600 sm:mx-0 sm:mb-4 sm:h-10 sm:w-10 sm:rounded-xl">
        {icon}
      </div>
      <div className="w-full truncate text-center text-[7px] leading-tight text-slate-400 sm:text-left sm:text-sm">{title}</div>
      <div className="mt-0.5 truncate text-center text-[9px] font-bold sm:mt-1 sm:text-left sm:text-2xl">{value}</div>
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
