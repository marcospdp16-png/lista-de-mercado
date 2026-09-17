// Lista de Mercado v1.0.4.2
// Substitua o conteúdo de src/App.tsx por este arquivo para aplicar a atualização.
// Recursos: editar, excluir, filtros Todos/Pendentes/Comprados, pesquisa e persistência local.

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Circle, ClipboardList, LayoutDashboard, ListChecks, Menu, Pencil, Plus, Search, Settings, ShoppingCart, Tags, Trash2, X } from "lucide-react";

type Item = { id:number; name:string; category:string; quantity:number; unitPrice:number; purchased:boolean };
type Filter = "Todos" | "Pendentes" | "Comprados";
const KEY = "lista-mercado-items-v1";
const categories = ["Alimentos","Laticínios","Hortifruti","Higiene","Limpeza","Bebidas","Carnes","Padaria","Pet","Molhos","Outros"];
const categoryRules: Record<string, string[]> = {
  "Laticínios": ["leite","queijo","iogurte","requeijão","requeijao","manteiga","creme de leite","coalhada","danone"],
  "Hortifruti": ["banana","maçã","maca","laranja","uva","mamão","mamao","melancia","abacaxi","tomate","batata","cebola","alho","cenoura","alface","brócolis","brocolis","fruta","verdura","legume"],
  "Higiene": ["sabonete","shampoo","condicionador","desodorante","pasta de dente","escova de dente","fio dental","absorvente","colgate","oral-b","oralb","dove"],
  "Limpeza": ["detergente","sabão","sabao","sabão em pó","sabao em po","sabão em barra","sabao em barra","amaciante","desinfetante","água sanitária","agua sanitaria","esponja","limpador","multiuso","papel toalha","omo","ype","veja","vanish","comfort"],
  "Bebidas": ["refrigerante","suco","água","agua","café","cafe","chá","cha","energético","energetico","isotônico","isotonico","cerveja","vinho"],
  "Carnes": ["frango","carne","bife","linguiça","linguica","salsicha","hambúrguer","hamburguer","peixe","filé","file","bacon"],
  "Padaria": ["pão","pao","bolo","torrada","croissant","bisnaguinha"],
  "Pet": ["ração","racao","petisco","areia para gato","shampoo pet","brinquedo para cachorro","brinquedo para gato"],
  "Molhos": ["maionese","maionose","mostarda","ketchup","katchup","molho de tomate","molho tomate","molho de pimenta","molho barbecue","molho"],
  "Alimentos": ["arroz","feijão","feijao","macarrão","macarrao","farinha","açúcar","acucar","sal","óleo","oleo","azeite","milho","ervilha","biscoito","bolacha","bala","chocolate","cereal","aveia","farofa","enlatado","sardinha","atum","azeitona","tempero","pipoca","nescau","toddy","nutella","hellmann","hellmans"],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .trim();
}

function detectCategory(productName: string, fallback = "Outros") {
  const name = normalizeText(productName);
  if (!name) return fallback;
  for (const [category, terms] of Object.entries(categoryRules)) {
    if (terms.some(term => name.includes(normalizeText(term)))) return category;
  }
  return fallback;
}
const initial:Item[] = [
 {id:1,name:"Arroz",category:"Alimentos",quantity:2,unitPrice:25,purchased:false},
 {id:2,name:"Leite",category:"Laticínios",quantity:4,unitPrice:5.5,purchased:true},
 {id:3,name:"Sabonete",category:"Higiene",quantity:3,unitPrice:3.5,purchased:false},
 {id:4,name:"Banana",category:"Hortifruti",quantity:1,unitPrice:8.9,purchased:false},
 {id:5,name:"Café",category:"Alimentos",quantity:2,unitPrice:18.5,purchased:false}
];
const money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export default function App(){
 const [items,setItems]=useState<Item[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||"null")||initial}catch{return initial}});
 const [page,setPage]=useState("Dashboard"),[search,setSearch]=useState(""),[filter,setFilter]=useState<Filter>("Todos");
 const [modal,setModal]=useState(false),[edit,setEdit]=useState<number|null>(null),[mobile,setMobile]=useState(false);
 const [form,setForm]=useState({name:"",category:"Alimentos",quantity:1,unitPrice:""});
 const detectedCategory = detectCategory(form.name, form.category);
 const categoryWasDetected = Boolean(form.name.trim()) && detectedCategory !== "Outros";
 useEffect(()=>localStorage.setItem(KEY,JSON.stringify(items)),[items]);
 const bought=items.filter(x=>x.purchased).length,pending=items.length-bought,total=items.reduce((s,x)=>s+x.quantity*x.unitPrice,0);
 const shown=useMemo(()=>items.filter(x=>x.name.toLowerCase().includes(search.toLowerCase())&&(filter==="Todos"||(filter==="Comprados"&&x.purchased)||(filter==="Pendentes"&&!x.purchased))),[items,search,filter]);
 const nav=[["Dashboard",LayoutDashboard],["Lista de Compras",ClipboardList],["Categorias",Tags],["Configurações",Settings]] as const;
 function toggle(id:number){setItems(v=>v.map(x=>x.id===id?{...x,purchased:!x.purchased}:x))}
 function openAdd(){setEdit(null);setForm({name:"",category:"Alimentos",quantity:1,unitPrice:""});setModal(true)}
 function openEdit(x:Item){setEdit(x.id);setForm({name:x.name,category:x.category,quantity:x.quantity,unitPrice:String(x.unitPrice)});setModal(true)}
 function save(e:React.FormEvent){e.preventDefault();if(!form.name.trim())return;const d={name:form.name.trim(),category:detectedCategory,quantity:Math.max(1,Number(form.quantity)),unitPrice:Number(form.unitPrice)||0};setItems(v=>edit===null?[...v,{id:Date.now(),...d,purchased:false}]:v.map(x=>x.id===edit?{...x,...d}:x));setModal(false)}
 function del(id:number){const x=items.find(i=>i.id===id);if(x&&confirm(`Excluir "${x.name}" da lista?`))setItems(v=>v.filter(i=>i.id!==id))}
 return <div className="min-h-screen bg-slate-50">
  <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white transition-transform lg:translate-x-0 ${mobile?"translate-x-0":"-translate-x-full"}`}>
   <div className="flex h-full flex-col"><div className="flex items-center gap-3 border-b border-slate-800 px-6 py-6"><div className="rounded-xl bg-emerald-500 p-2.5"><ShoppingCart size={23}/></div><div><b>Lista de Mercado</b><div className="text-xs text-slate-400">versão 1.0.4.2</div></div><button className="ml-auto lg:hidden" onClick={()=>setMobile(false)}><X/></button></div>
   <nav className="space-y-1 p-4">{nav.map(([label,Icon])=><button key={label} onClick={()=>{setPage(label);setMobile(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${page===label?"bg-emerald-500":"text-slate-300 hover:bg-slate-900"}`}><Icon size={19}/>{label}</button>)}</nav>
   <div className="mt-auto border-t border-slate-800 p-5 text-xs text-slate-500">Projeto pessoal • 100% responsivo</div></div>
  </aside>
  {mobile&&<div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={()=>setMobile(false)}/>}
  <main className="lg:ml-64"><header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 sm:px-8"><button className="lg:hidden" onClick={()=>setMobile(true)}><Menu/></button><span className="hidden lg:block text-sm font-medium text-slate-500">{page}</span><div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><b className="text-sm">Minha lista</b><div className="text-xs text-slate-400">Compras do mês</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">M</div></div></header>
  <section className="mx-auto max-w-7xl p-4 sm:p-8">{page==="Dashboard"?<>
   <div className="mb-7"><p className="mb-1 text-sm font-medium text-emerald-600">Boa tarde! 👋</p><h1 className="text-3xl font-bold sm:text-4xl">Sua lista de mercado</h1><p className="mt-2 text-slate-500">Aqui está o resumo das suas compras.</p></div>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={<ShoppingCart/>} title="Itens" value={String(items.length)}/><Stat icon={<Circle/>} title="Pendentes" value={String(pending)}/><Stat icon={<CheckCircle2/>} title="Comprados" value={String(bought)}/><Stat icon={<BarChart3/>} title="Total estimado" value={money(total)}/></div>
   <div className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-bold">Lista de Compras</h2><p className="text-sm text-slate-400">{shown.length} item(ns) exibido(s)</p></div><button onClick={openAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={18}/>Adicionar produto</button></div>
   <div className="p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar produto..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 outline-none focus:border-emerald-400"/></div><div className="flex rounded-xl bg-slate-100 p-1">{(["Todos","Pendentes","Comprados"] as Filter[]).map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-lg px-3 py-2 text-xs font-semibold sm:px-4 ${filter===f?"bg-white text-emerald-600 shadow-sm":"text-slate-500"}`}>{f}</button>)}</div></div>
   <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">Status</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Qtd.</th><th className="px-3 py-3">Preço</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Ações</th></tr></thead><tbody>{shown.map(x=><tr key={x.id} className={`border-b border-slate-50 ${x.purchased?"opacity-60":""}`}><td className="px-3 py-4"><button onClick={()=>toggle(x.id)}>{x.purchased?<CheckCircle2 className="text-emerald-500"/>:<Circle className="text-slate-300"/>}</button></td><td className={`px-3 py-4 font-semibold ${x.purchased?"line-through":""}`}>{x.name}</td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{x.category}</span></td><td className="px-3 py-4">{x.quantity}</td><td className="px-3 py-4">{money(x.unitPrice)}</td><td className="px-3 py-4 text-right font-semibold">{money(x.quantity*x.unitPrice)}</td><td className="px-3 py-4"><div className="flex justify-end gap-1"><button onClick={()=>openEdit(x)} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={17}/></button><button onClick={()=>del(x.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={17}/></button></div></td></tr>)}</tbody></table>{!shown.length&&<Empty/>}</div>
   <div className="mt-4 space-y-3 md:hidden">{shown.map(x=><div key={x.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start gap-3"><button onClick={()=>toggle(x.id)}>{x.purchased?<CheckCircle2 className="text-emerald-500"/>:<Circle className="text-slate-300"/>}</button><div className="flex-1"><b className={x.purchased?"line-through":""}>{x.name}</b><div className="text-xs text-slate-400">{x.category} • {x.quantity} un.</div></div><b>{money(x.quantity*x.unitPrice)}</b></div><div className="mt-3 flex justify-end gap-2 border-t pt-3"><button onClick={()=>openEdit(x)} className="inline-flex gap-1 px-3 py-2 text-xs"><Pencil size={14}/>Editar</button><button onClick={()=>del(x.id)} className="inline-flex gap-1 px-3 py-2 text-xs text-red-600"><Trash2 size={14}/>Excluir</button></div></div>)}{!shown.length&&<Empty/>}</div>
   </div></div>
  </>:<div className="mx-auto max-w-5xl">
 {page==="Categorias" ? <><div className="mb-7"><p className="text-sm font-medium text-emerald-600">Organização inteligente</p><h1 className="text-3xl font-bold">Categorias</h1><p className="mt-2 text-slate-500">O sistema identifica a categoria pelo nome do produto automaticamente.</p></div>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(c=>{const count=items.filter(i=>i.category===c).length;return <div key={c} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="font-semibold">{c}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{count} item(ns)</span></div><p className="mt-2 text-xs text-slate-400">Reconhecimento automático ativo</p></div>})}</div>
 <button onClick={()=>setPage("Dashboard")} className="mt-6 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white">Voltar ao Dashboard</button></> :
 <div className="flex min-h-[60vh] items-center justify-center text-center"><div><ListChecks className="mx-auto mb-4 text-emerald-500" size={48}/><h1 className="text-2xl font-bold">{page}</h1><p className="mt-2 text-slate-500">Tela preparada para a próxima etapa.</p><button onClick={()=>setPage("Dashboard")} className="mt-5 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white">Voltar ao Dashboard</button></div></div>}
 </div>}</section></main>
  {modal&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form onSubmit={save} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">{edit===null?"Adicionar produto":"Editar produto"}</h2><p className="text-sm text-slate-400">Preencha os dados do produto.</p></div><button type="button" onClick={()=>setModal(false)}><X className="text-slate-400"/></button></div><div className="space-y-4"><label className="block text-sm font-medium">Produto
<input required autoFocus value={form.name} onChange={e=>{
 const name=e.target.value;
 const detected=detectCategory(name,"Outros");
 setForm(v=>({...v,name,category:detected!=="Outros"?detected:v.category}));
}} className="mt-1.5 w-full rounded-xl border px-4 py-3" placeholder="Ex.: Arroz"/>
{form.name.trim() && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
  🧠 Categoria identificada automaticamente: <b>{detectedCategory}</b>
</div>}
</label><div className="grid gap-4 sm:grid-cols-3"><label className="sm:col-span-2 text-sm font-medium">Categoria<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1.5 w-full rounded-xl border bg-white px-4 py-3">{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="text-sm font-medium">Quantidade<input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} className="mt-1.5 w-full rounded-xl border px-4 py-3"/></label></div><label className="block text-sm font-medium">Preço unitário<input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e=>setForm({...form,unitPrice:e.target.value})} className="mt-1.5 w-full rounded-xl border px-4 py-3"/></label></div><div className="mt-6 flex gap-3"><button type="button" onClick={()=>setModal(false)} className="flex-1 rounded-xl border px-4 py-3 font-semibold">Cancelar</button><button className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white">{edit===null?"Adicionar":"Salvar alterações"}</button></div></form></div>}
 </div>
}
function Stat({icon,title,value}:{icon:React.ReactNode;title:string;value:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">{icon}</div><div className="text-sm text-slate-400">{title}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>}
function Empty(){return <div className="py-10 text-center text-sm text-slate-400">Nenhum produto encontrado com os filtros atuais.</div>}
