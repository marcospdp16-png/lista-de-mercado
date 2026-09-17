import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, CheckCircle2, Circle, ClipboardList, LayoutDashboard,
  ListChecks, Menu, Plus, Search, Settings, ShoppingCart, Tags, X
} from "lucide-react";

type Item = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  purchased: boolean;
};

const STORAGE_KEY = "lista-mercado-items-v1";

const initialItems: Item[] = [
  { id: 1, name: "Arroz", category: "Alimentos", quantity: 2, unitPrice: 25, purchased: false },
  { id: 2, name: "Leite", category: "Laticínios", quantity: 4, unitPrice: 5.5, purchased: true },
  { id: 3, name: "Sabonete", category: "Higiene", quantity: 3, unitPrice: 3.5, purchased: false },
  { id: 4, name: "Banana", category: "Hortifruti", quantity: 1, unitPrice: 8.9, purchased: false },
  { id: 5, name: "Café", category: "Alimentos", quantity: 2, unitPrice: 18.5, purchased: false },
];

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function App() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialItems;
    } catch {
      return initialItems;
    }
  });
  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Alimentos", quantity: 1, unitPrice: "" });

  const filtered = useMemo(
    () => items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const purchased = items.filter(i => i.purchased).length;
  const pending = items.length - purchased;
  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  function toggleItem(id: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, purchased: !i.purchased } : i));
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setItems(prev => [...prev, {
      id: Date.now(),
      name: form.name.trim(),
      category: form.category,
      quantity: Math.max(1, Number(form.quantity)),
      unitPrice: Number(form.unitPrice) || 0,
      purchased: false,
    }]);
    setForm({ name: "", category: "Alimentos", quantity: 1, unitPrice: "" });
    setShowModal(false);
  }

  const nav = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Lista de Compras", icon: ClipboardList },
    { label: "Categorias", icon: Tags },
    { label: "Configurações", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white transition-transform lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
            <div className="rounded-xl bg-emerald-500 p-2.5"><ShoppingCart size={23} /></div>
            <div>
              <div className="font-bold">Lista de Mercado</div>
              <div className="text-xs text-slate-400">versão 1.0.0</div>
            </div>
            <button className="ml-auto lg:hidden" onClick={() => setMobileMenu(false)}><X size={20}/></button>
          </div>
          <nav className="space-y-1 p-4">
            {nav.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => { setPage(label); setMobileMenu(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${page === label ? "bg-emerald-500 text-white" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}>
                <Icon size={19}/>{label}
              </button>
            ))}
          </nav>
          <div className="mt-auto border-t border-slate-800 p-5 text-xs text-slate-500">Projeto pessoal • 100% responsivo</div>
        </div>
      </aside>

      {mobileMenu && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileMenu(false)} />}

      <main className="lg:ml-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-8">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(true)}><Menu/></button>
          <div className="hidden lg:block text-sm font-medium text-slate-500">{page}</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block"><div className="text-sm font-semibold">Minha lista</div><div className="text-xs text-slate-400">Compras do mês</div></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">M</div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl p-4 sm:p-8">
          {page === "Dashboard" && (
            <>
              <div className="mb-7">
                <p className="mb-1 text-sm font-medium text-emerald-600">Boa tarde! 👋</p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sua lista de mercado</h1>
                <p className="mt-2 text-slate-500">Aqui está o resumo das suas compras.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat icon={<ShoppingCart size={21}/>} title="Itens" value={items.length.toString()} />
                <Stat icon={<Circle size={21}/>} title="Pendentes" value={pending.toString()} />
                <Stat icon={<CheckCircle2 size={21}/>} title="Comprados" value={purchased.toString()} />
                <Stat icon={<BarChart3 size={21}/>} title="Total estimado" value={money(total)} />
              </div>

              <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="font-bold">Lista de Compras</h2><p className="text-sm text-slate-400">Acompanhe os produtos da sua lista.</p></div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => {
                      if (items.length && window.confirm("Limpar toda a lista? Esta ação não pode ser desfeita.")) {
                        setItems([]);
                      }
                    }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                      Limpar lista
                    </button>
                    <button onClick={() => setShowModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"><Plus size={18}/> Adicionar produto</button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="relative mb-4 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"/>
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-3">Status</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Qtd.</th><th className="px-3 py-3">Preço</th><th className="px-3 py-3 text-right">Total</th>
                      </tr></thead>
                      <tbody>
                        {filtered.map(i => <tr key={i.id} className={`border-b border-slate-50 last:border-0 ${i.purchased ? "opacity-60" : ""}`}>
                          <td className="px-3 py-4"><button onClick={() => toggleItem(i.id)}>{i.purchased ? <CheckCircle2 className="text-emerald-500" size={22}/> : <Circle className="text-slate-300" size={22}/>}</button></td>
                          <td className={`px-3 py-4 font-semibold ${i.purchased ? "line-through" : ""}`}>{i.name}</td>
                          <td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{i.category}</span></td>
                          <td className="px-3 py-4">{i.quantity}</td><td className="px-3 py-4">{money(i.unitPrice)}</td><td className="px-3 py-4 text-right font-semibold">{money(i.quantity * i.unitPrice)}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filtered.map(i => <div key={i.id} className={`rounded-xl border border-slate-100 p-4 ${i.purchased ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3">
                        <button className="mt-0.5" onClick={() => toggleItem(i.id)}>{i.purchased ? <CheckCircle2 className="text-emerald-500" size={22}/> : <Circle className="text-slate-300" size={22}/>}</button>
                        <div className="min-w-0 flex-1"><div className={`font-semibold ${i.purchased ? "line-through" : ""}`}>{i.name}</div><div className="mt-1 text-xs text-slate-400">{i.category} • {i.quantity} un.</div></div>
                        <div className="text-right font-bold">{money(i.quantity * i.unitPrice)}<div className="text-xs font-normal text-slate-400">{money(i.unitPrice)}/un.</div></div>
                      </div>
                    </div>)}
                  </div>
                </div>
              </div>
            </>
          )}

          {page !== "Dashboard" && (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="max-w-md text-center">
                <ListChecks className="mx-auto mb-4 text-emerald-500" size={48}/>
                <h1 className="text-2xl font-bold">{page}</h1>
                <p className="mt-2 text-slate-500">Tela preparada para a próxima etapa do desenvolvimento da versão 1.0.</p>
                <button onClick={() => setPage("Dashboard")} className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white">Voltar ao Dashboard</button>
              </div>
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={addItem} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">Adicionar produto</h2><p className="text-sm text-slate-400">Inclua um item na sua lista.</p></div><button type="button" onClick={() => setShowModal(false)}><X className="text-slate-400"/></button></div>
            <div className="space-y-4">
              <label className="block text-sm font-medium">Produto<input autoFocus required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-400" placeholder="Ex.: Arroz"/></label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium sm:col-span-2">Categoria<select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3">{["Alimentos","Laticínios","Hortifruti","Higiene","Limpeza","Bebidas","Carnes","Padaria","Pet","Outros"].map(c => <option key={c}>{c}</option>)}</select></label>
                <label className="block text-sm font-medium">Quantidade<input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: Number(e.target.value)})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
              </div>
              <label className="block text-sm font-medium">Preço unitário<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="0,00"/></label>
            </div>
            <div className="mt-6 flex gap-3"><button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold">Cancelar</button><button className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600">Adicionar</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{icon}</div><div className="text-sm text-slate-400">{title}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>;
}