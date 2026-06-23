
import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const MEAL_TYPES = ["Midi","Soir"];
const CATEGORIES = ["Fruits & Légumes","Viande & Poisson","Épicerie","Produits laitiers","Boissons","Autre"];

const COLORS = {
  repas:   { bg: "#FFF3E0", border: "#FFB74D", accent: "#E65100", light: "#FFF8F0" },
  courses: { bg: "#E8F5E9", border: "#66BB6A", accent: "#2E7D32", light: "#F1F8F1" },
  sorties: { bg: "#FCE4EC", border: "#F48FB1", accent: "#880E4F", light: "#FFF0F5" },
  notes:   { bg: "#EDE7F6", border: "#B39DDB", accent: "#4527A0", light: "#F5F0FF" },
};

const TAB_CONFIG = [
  { id: "repas",   label: "Repas",   icon: "🍽️" },
  { id: "courses", label: "Courses", icon: "🛒" },
  { id: "sorties", label: "Sorties", icon: "🍷" },
  { id: "notes",   label: "Notes",   icon: "📝" },
];

const initMeals = () => {
  const m = {};
  DAYS.forEach(d => { m[d] = { Midi: "", Soir: "" }; });
  return m;
};

export default function App() {
  const [tab, setTab] = useState("repas");
  const [meals, setMeals] = useState(initMeals());
  const [items, setItems] = useState([]);
  const [sorties, setSorties] = useState([]);
  const [notes, setNotes] = useState("");

  const [editCell, setEditCell] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newCat, setNewCat] = useState(CATEGORIES[0]);
  const [sortie, setSortie] = useState({ nom: "", date: "", heure: "", note: "", statut: "Prévu" });
  const [saveStatus, setSaveStatus] = useState("idle");
  const [confirmReset, setConfirmReset] = useState(false);
  const saveTimer = useRef(null);

  // Chargement initial depuis Supabase
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("appdata").select("*");
      if (!data) return;
      data.forEach(row => {
        if (row.key === "meals") setMeals(row.value);
        if (row.key === "items") setItems(row.value);
        if (row.key === "sorties") setSorties(row.value);
        if (row.key === "notes") setNotes(row.value);
      });
    };
    load();

    // Écoute les changements en temps réel
    const channel = supabase
      .channel("appdata-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "appdata" }, payload => {
        const { key, value } = payload.new;
        if (key === "meals") setMeals(value);
        if (key === "items") setItems(value);
        if (key === "sorties") setSorties(value);
        if (key === "notes") setNotes(value);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const save = (key, value) => {
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("appdata").upsert({ key, value }, { onConflict: "key" });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  };

  const updateMeals  = v => { setMeals(v);   save("meals", v); };
  const updateItems  = v => { setItems(v);   save("items", v); };
  const updateSorties = v => { setSorties(v); save("sorties", v); };
  const updateNotes  = v => { setNotes(v);   save("notes", v); };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setConfirmReset(false);
    if (tab === "repas")   updateMeals(initMeals());
    if (tab === "courses") updateItems([]);
    if (tab === "sorties") updateSorties([]);
    if (tab === "notes")   updateNotes("");
  };

  const c = COLORS[tab];

  const startEdit = (day, type) => { setEditCell(`${day}-${type}`); setEditVal(meals[day][type]); };
  const saveEdit  = (day, type) => { updateMeals({ ...meals, [day]: { ...meals[day], [type]: editVal } }); setEditCell(null); };

  const addItem   = () => { if (!newItem.trim()) return; updateItems([...items, { id: Date.now(), name: newItem.trim(), cat: newCat, done: false }]); setNewItem(""); };
  const toggleItem = id => updateItems(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const removeItem = id => updateItems(items.filter(i => i.id !== id));

  const addSortie    = () => { if (!sortie.nom.trim()) return; updateSorties([...sorties, { ...sortie, id: Date.now() }]); setSortie({ nom: "", date: "", heure: "", note: "", statut: "Prévu" }); };
  const removeSortie = id => updateSorties(sorties.filter(s => s.id !== id));
  const cycleSortie  = id => { const cycle = ["Prévu","Confirmé","Passé"]; updateSorties(sorties.map(s => s.id === id ? { ...s, statut: cycle[(cycle.indexOf(s.statut)+1)%3] } : s)); };

  const statutColor = s => s === "Confirmé" ? "#2E7D32" : s === "Passé" ? "#888" : "#E65100";
  const pending = items.filter(i => !i.done).length;
  const itemsByCategory = CATEGORIES.map(cat => ({ cat, items: items.filter(i => i.cat === cat) })).filter(g => g.items.length > 0);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 420, margin: "0 auto", paddingBottom: 24 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ background: c.bg, borderBottom: `2px solid ${c.border}`, padding: "16px 16px 0", borderRadius: "12px 12px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: c.accent }}>
            {TAB_CONFIG.find(t => t.id === tab)?.icon} {TAB_CONFIG.find(t => t.id === tab)?.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: saveStatus === "saved" ? "#2E7D32" : "#aaa", display: "flex", alignItems: "center", gap: 4 }}>
              {saveStatus === "saving" && <><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFB74D", display: "inline-block", animation: "pulse 1s infinite" }}></span>Sauvegarde…</>}
              {saveStatus === "saved"  && <>✓ Sauvegardé</>}
              {saveStatus === "idle"   && <span style={{ color: "#ccc" }}>✓ Synchronisé</span>}
            </div>
            <button onClick={handleReset} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: confirmReset ? "#FFEBEE" : "transparent", border: `1px solid ${confirmReset ? "#E57373" : "#ddd"}`, color: confirmReset ? "#C62828" : "#aaa", fontWeight: confirmReset ? 600 : 400 }}>
              {confirmReset ? "⚠️ Confirmer ?" : "↺ Réinitialiser"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TAB_CONFIG.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setConfirmReset(false); }} style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: "8px 8px 0 0", background: tab === t.id ? "white" : "transparent", color: tab === t.id ? COLORS[t.id].accent : "#666", fontWeight: tab === t.id ? 600 : 400, fontSize: 13, cursor: "pointer" }}>
              <div>{t.icon}</div><div>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "white", border: `1px solid ${c.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 16 }}>

        {tab === "repas" && DAYS.map(day => (
          <div key={day} style={{ marginBottom: 10, background: c.light, borderRadius: 10, padding: 10, border: `1px solid ${c.border}` }}>
            <div style={{ fontWeight: 600, color: c.accent, fontSize: 14, marginBottom: 6 }}>{day}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {MEAL_TYPES.map(type => (
                <div key={type}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{type}</div>
                  {editCell === `${day}-${type}` ? (
                    <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => saveEdit(day, type)} onKeyDown={e => e.key === "Enter" && saveEdit(day, type)}
                      style={{ width: "100%", padding: "4px 6px", border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
                  ) : (
                    <div onClick={() => startEdit(day, type)} style={{ minHeight: 30, padding: "4px 8px", borderRadius: 6, cursor: "pointer", background: meals[day]?.[type] ? "white" : "#f5f5f5", border: `1px dashed ${meals[day]?.[type] ? c.border : "#ddd"}`, fontSize: 13, color: meals[day]?.[type] ? "#333" : "#bbb" }}>
                      {meals[day]?.[type] || "Ajouter…"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {tab === "courses" && (
          <div>
            <div style={{ marginBottom: 14, background: c.light, borderRadius: 10, padding: 10, border: `1px solid ${c.border}` }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} placeholder="Ajouter un article…"
                  style={{ flex: 1, padding: "6px 10px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13 }} />
                <button onClick={addItem} style={{ background: c.accent, color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 600, cursor: "pointer", fontSize: 16 }}>+</button>
              </div>
              <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ width: "100%", padding: "6px 8px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13 }}>
                {CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
              </select>
            </div>
            {pending > 0 && <div style={{ fontSize: 13, color: c.accent, fontWeight: 600, marginBottom: 8 }}>{pending} article{pending > 1 ? "s" : ""} restant{pending > 1 ? "s" : ""}</div>}
            {items.length === 0 && <div style={{ textAlign: "center", color: "#bbb", fontSize: 14, padding: 24 }}>Liste vide — ajoutez des articles !</div>}
            {itemsByCategory.map(({ cat, items: ci }) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>{cat}</div>
                {ci.map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: item.done ? "#f9f9f9" : "white", borderRadius: 8, marginBottom: 4, border: `1px solid ${item.done ? "#e0e0e0" : c.border}` }}>
                    <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)} style={{ accentColor: c.accent, width: 16, height: 16 }} />
                    <span style={{ flex: 1, fontSize: 14, textDecoration: item.done ? "line-through" : "none", color: item.done ? "#aaa" : "#333" }}>{item.name}</span>
                    <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            ))}
            {items.some(i => i.done) && <button onClick={() => updateItems(items.filter(i => !i.done))} style={{ width: "100%", padding: "8px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, color: "#888", fontSize: 13, cursor: "pointer", marginTop: 8 }}>Supprimer les articles cochés</button>}
          </div>
        )}

        {tab === "sorties" && (
          <div>
            <div style={{ background: c.light, borderRadius: 10, padding: 10, border: `1px solid ${c.border}`, marginBottom: 14 }}>
              <input value={sortie.nom} onChange={e => setSortie(p => ({ ...p, nom: e.target.value }))} placeholder="Nom du restaurant / sortie…"
                style={{ width: "100%", padding: "6px 10px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13, marginBottom: 6, boxSizing: "border-box" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                <input type="date" value={sortie.date} onChange={e => setSortie(p => ({ ...p, date: e.target.value }))} style={{ padding: "6px 8px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13 }} />
                <input type="time" value={sortie.heure} onChange={e => setSortie(p => ({ ...p, heure: e.target.value }))} style={{ padding: "6px 8px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13 }} />
              </div>
              <input value={sortie.note} onChange={e => setSortie(p => ({ ...p, note: e.target.value }))} placeholder="Notes (réservation, adresse…)"
                style={{ width: "100%", padding: "6px 10px", border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
              <button onClick={addSortie} style={{ width: "100%", padding: "8px", background: c.accent, color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Ajouter la sortie</button>
            </div>
            {sorties.length === 0 && <div style={{ textAlign: "center", color: "#bbb", fontSize: 14, padding: 24 }}>Aucune sortie prévue</div>}
            {sorties.map(s => (
              <div key={s.id} style={{ background: "white", border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8, opacity: s.statut === "Passé" ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#333" }}>{s.nom}</div>
                  <button onClick={() => removeSortie(s.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
                {(s.date || s.heure) && <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{s.date && new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}{s.heure && ` à ${s.heure}`}</div>}
                {s.note && <div style={{ fontSize: 13, color: "#888", marginTop: 4, fontStyle: "italic" }}>{s.note}</div>}
                <button onClick={() => cycleSortie(s.id)} style={{ marginTop: 8, padding: "4px 10px", borderRadius: 20, border: `1px solid ${statutColor(s.statut)}`, background: "transparent", color: statutColor(s.statut), fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {s.statut === "Prévu" ? "⏳" : s.statut === "Confirmé" ? "✅" : "✓"} {s.statut}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "notes" && (
          <div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Notes libres — idées de recettes, plats à tester, envies…</div>
            <textarea value={notes} onChange={e => updateNotes(e.target.value)} placeholder="Écrivez ici vos idées, recettes, notes de courses, envies de restaurant…"
              style={{ width: "100%", minHeight: 320, padding: "10px 12px", border: `1px solid ${c.border}`, borderRadius: 10, fontSize: 14, lineHeight: 1.6, resize: "vertical", background: c.light, boxSizing: "border-box", fontFamily: "inherit" }} />
            {notes && <div style={{ fontSize: 12, color: "#aaa", textAlign: "right", marginTop: 4 }}>{notes.length} caractères</div>}
          </div>
        )}
      </div>
    </div>
  );
}
