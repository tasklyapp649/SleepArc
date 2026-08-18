import React, { useState, useEffect, useMemo } from "react";
import {
  Moon, Sunrise, Activity, Footprints, ClipboardPaste, Settings, X,
  Check, Copy, ChevronRight, Flame, Info, Bed
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const C = {
  void: "#0A0E1A",
  space: "#111A30",
  spaceLight: "#1B2648",
  moon: "#A8C5FF",
  moonDim: "#5E7AC0",
  amber: "#FFB86B",
  vapor: "#7C89A8",
  text: "#F2F5FA",
  danger: "#FF8B8B",
};

const RANGE_START = 17 * 60; // track starts at 17:00
const RANGE_SPAN = 18 * 60;  // spans to 11:00 next day

function toRangePct(minOfDay) {
  let t = minOfDay;
  if (t < RANGE_START) t += 1440;
  return Math.min(100, Math.max(0, ((t - RANGE_START) / RANGE_SPAN) * 100));
}

function getBaseline(age) {
  if (age < 6) return { minH: 10, maxH: 13, targetH: 11.5 };
  if (age < 13) return { minH: 9, maxH: 11, targetH: 10 };
  if (age < 18) return { minH: 8, maxH: 10, targetH: 9 };
  if (age < 65) return { minH: 7, maxH: 9, targetH: 8 };
  return { minH: 7, maxH: 8, targetH: 7.5 };
}

function getBonus(exerciseMin) {
  const e = Number(exerciseMin) || 0;
  if (e >= 75) return 60;
  if (e >= 45) return 40;
  if (e >= 20) return 20;
  return 0;
}

function computeRecommendation(age, exerciseMin) {
  const { minH, maxH, targetH } = getBaseline(age);
  const baseMin = Math.round(targetH * 60);
  const bonus = getBonus(exerciseMin);
  const minMin = Math.round(minH * 60);
  const maxMin = Math.round(maxH * 60) + 45;
  const totalMin = Math.min(Math.max(baseMin + bonus, minMin), maxMin);
  return { baseMin, bonus, totalMin, minMin, maxMin };
}

function formatHM(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

function shortDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}/${m}`;
}

const TEMPLATE = `{"steps": <Pas>, "exerciseMin": <Minutes>, "activeEnergy": <Active>, "restingEnergy": <Repos>}`;

export default function SleepArc() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState({});
  const [tab, setTab] = useState("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ageDraft, setAgeDraft] = useState("");
  const [onboardAge, setOnboardAge] = useState("");

  const [wakeTime, setWakeTime] = useState("06:30");
  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState(null);
  const [steps, setSteps] = useState("");
  const [exerciseMin, setExerciseMin] = useState("");
  const [activeEnergy, setActiveEnergy] = useState("");
  const [restingEnergy, setRestingEnergy] = useState("");
  const [savedFlag, setSavedFlag] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [actualDrafts, setActualDrafts] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("profile");
        if (p && p.value) {
          const parsed = JSON.parse(p.value);
          setProfile(parsed);
          if (parsed.wakeTime) setWakeTime(parsed.wakeTime);
        }
      } catch (e) {
        /* no profile yet */
      }
      try {
        const e = await window.storage.get("entries");
        if (e && e.value) setEntries(JSON.parse(e.value));
      } catch (e) {
        /* no entries yet */
      }
      setLoading(false);
    })();
  }, []);

  const age = profile?.age;
  const rec = useMemo(
    () => (age ? computeRecommendation(age, exerciseMin) : null),
    [age, exerciseMin]
  );

  const { bedPct, wakePct, bedLabel, wakeLabel } = useMemo(() => {
    if (!rec) return {};
    const [wh, wm] = wakeTime.split(":").map(Number);
    const wakeMin = wh * 60 + wm;
    let bedMin = ((wakeMin - rec.totalMin) % 1440 + 1440) % 1440;
    const bh = Math.floor(bedMin / 60), bm = bedMin % 60;
    return {
      bedPct: toRangePct(bedMin),
      wakePct: toRangePct(wakeMin),
      bedLabel: `${bh.toString().padStart(2, "0")}:${bm.toString().padStart(2, "0")}`,
      wakeLabel: wakeTime,
    };
  }, [rec, wakeTime]);

  async function saveProfile(next) {
    setProfile(next);
    try {
      await window.storage.set("profile", JSON.stringify(next));
    } catch (e) {
      console.error("Erreur de sauvegarde du profil", e);
    }
  }

  async function saveEntries(next) {
    setEntries(next);
    try {
      await window.storage.set("entries", JSON.stringify(next));
    } catch (e) {
      console.error("Erreur de sauvegarde des données", e);
    }
  }

  function handleOnboard() {
    const a = parseInt(onboardAge, 10);
    if (!a || a < 3 || a > 110) return;
    saveProfile({ age: a, wakeTime });
  }

  function handleSaveAge() {
    const a = parseInt(ageDraft, 10);
    if (!a || a < 3 || a > 110) return;
    saveProfile({ ...profile, age: a });
    setSettingsOpen(false);
  }

  function buildEntry(stepsVal, exerciseVal, activeVal, restingVal, wake) {
    const r = computeRecommendation(age, exerciseVal);
    const [wh, wm] = wake.split(":").map(Number);
    const wakeMin = wh * 60 + wm;
    const bedMin = ((wakeMin - r.totalMin) % 1440 + 1440) % 1440;
    const bh = Math.floor(bedMin / 60), bm = bedMin % 60;
    return {
      steps: Number(stepsVal) || 0,
      exerciseMin: Number(exerciseVal) || 0,
      activeEnergy: Number(activeVal) || 0,
      restingEnergy: Number(restingVal) || 0,
      wakeTime: wake,
      baseMin: r.baseMin,
      bonus: r.bonus,
      totalMin: r.totalMin,
      bedtime: `${bh.toString().padStart(2, "0")}:${bm.toString().padStart(2, "0")}`,
      ts: Date.now(),
    };
  }

  async function persistEntry(partial) {
    const key = todayKey();
    const next = { ...entries, [key]: { ...partial, actualSleepMin: entries[key]?.actualSleepMin } };
    await saveEntries(next);
  }

  function handleParse(text) {
    try {
      const obj = JSON.parse(text);
      const s = obj.steps !== undefined ? String(obj.steps) : steps;
      const ex = obj.exerciseMin !== undefined ? String(obj.exerciseMin) : exerciseMin;
      const ac = obj.activeEnergy !== undefined ? String(obj.activeEnergy) : activeEnergy;
      const re = obj.restingEnergy !== undefined ? String(obj.restingEnergy) : restingEnergy;
      setSteps(s);
      setExerciseMin(ex);
      setActiveEnergy(ac);
      setRestingEnergy(re);
      setParseError(null);
      persistEntry(buildEntry(s, ex, ac, re, wakeTime)).then(() => {
        setSavedFlag(true);
        setTimeout(() => setSavedFlag(false), 2500);
      });
    } catch (e) {
      setParseError("Format non reconnu — vérifie le Raccourci ou entre les valeurs à la main ci-dessous.");
    }
  }

  function handlePasteChange(v) {
    setPasteText(v);
    const t = v.trim();
    if (t.startsWith("{") && t.endsWith("}")) handleParse(t);
  }

  async function handleSaveToday() {
    if (!age) return;
    await persistEntry(buildEntry(steps, exerciseMin, activeEnergy, restingEnergy, wakeTime));
    await saveProfile({ ...profile, wakeTime });
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  }

  async function handleSaveActual(key) {
    const val = parseFloat(actualDrafts[key]);
    if (!val || val <= 0) return;
    const next = {
      ...entries,
      [key]: { ...entries[key], actualSleepMin: Math.round(val * 60) },
    };
    await saveEntries(next);
  }

  function copyTemplate() {
    try {
      navigator.clipboard.writeText(TEMPLATE);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 1800);
    } catch (e) {
      /* clipboard unavailable — user can select manually */
    }
  }

  const sortedKeys = Object.keys(entries).sort().reverse();
  const chartData = Object.keys(entries)
    .sort()
    .slice(-14)
    .map((k) => ({
      date: shortDate(k),
      recommande: +(entries[k].totalMin / 60).toFixed(2),
      reel: entries[k].actualSleepMin ? +(entries[k].actualSleepMin / 60).toFixed(2) : null,
    }));

  if (loading) {
    return (
      <div style={{ background: C.void, minHeight: "100vh" }} className="flex items-center justify-center">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: C.moon }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.void, color: C.text, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        *:focus-visible { outline: 2px solid ${C.moon}; outline-offset: 2px; }
        .fade-up { animation: fadeUp .5s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px);} to {opacity:1; transform:translateY(0);} }
        .glow-pulse { animation: glowPulse 3s ease-in-out infinite; }
        @keyframes glowPulse { 0%,100%{opacity:.9} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .fade-up, .glow-pulse { animation: none !important; }
        }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>

      {!profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: C.void }}>
          <div className="w-full max-w-sm fade-up">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <Moon size={22} color={C.moon} />
              <span className="font-display text-xl font-semibold tracking-tight">SleepArc</span>
            </div>
            <div className="rounded-2xl p-6" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
              <h1 className="font-display text-lg font-semibold mb-2">Quel âge as-tu ?</h1>
              <p className="text-sm mb-4" style={{ color: C.vapor }}>
                Utilisé uniquement pour calculer ta fourchette de sommeil recommandée — indépendant de l'app Santé.
              </p>
              <input
                type="number"
                inputMode="numeric"
                value={onboardAge}
                onChange={(e) => setOnboardAge(e.target.value)}
                placeholder="Âge"
                className="w-full rounded-xl px-4 py-3 text-lg font-mono mb-4"
                style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
              />
              <button
                onClick={handleOnboard}
                className="w-full rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                style={{ background: C.moon, color: C.void }}
              >
                Commencer <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <div className="max-w-md mx-auto px-4 pt-6 pb-28">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Moon size={20} color={C.moon} />
              <span className="font-display text-lg font-semibold tracking-tight">SleepArc</span>
            </div>
            <button
              onClick={() => { setAgeDraft(String(profile.age)); setSettingsOpen(true); }}
              className="p-2 rounded-full"
              style={{ background: C.space }}
              aria-label="Réglages"
            >
              <Settings size={16} color={C.vapor} />
            </button>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <div className="text-xs font-mono tracking-widest mb-4" style={{ color: C.vapor }}>
                  FENÊTRE DE RÉCUPÉRATION
                </div>
                <div className="relative h-3 rounded-full mb-3" style={{ background: C.spaceLight }}>
                  <div
                    className="absolute inset-y-0 rounded-full glow-pulse"
                    style={{
                      left: `${bedPct}%`,
                      width: `${Math.max(2, wakePct - bedPct)}%`,
                      background: `linear-gradient(90deg, ${C.moonDim}, ${C.moon})`,
                      boxShadow: `0 0 14px 2px ${C.moon}55`,
                    }}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1" style={{ left: `${bedPct}%`, transform: "translate(-50%,-50%)" }}>
                    <Moon size={12} color={C.moon} style={{ marginTop: -22 }} />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${wakePct}%`, transform: "translate(-50%,-50%)" }}>
                    <Sunrise size={12} color={C.amber} style={{ marginTop: -22 }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs font-mono mb-6" style={{ color: C.vapor }}>
                  <span>17h</span>
                  <span>00h</span>
                  <span>11h</span>
                </div>

                <div className="text-center mb-2">
                  <div className="font-display text-4xl font-semibold" style={{ color: C.moon }}>
                    {rec ? formatHM(rec.totalMin) : "—"}
                  </div>
                  <div className="text-xs font-mono tracking-widest mt-1" style={{ color: C.vapor }}>
                    OBJECTIF CE SOIR · COUCHER {bedLabel}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl p-5 space-y-2 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <div className="flex justify-between text-sm font-mono">
                  <span style={{ color: C.vapor }}>BASE ({profile.age} ANS)</span>
                  <span>{rec ? formatHM(rec.baseMin) : "—"}</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span style={{ color: C.vapor }}>BONUS ACTIVITÉ ({exerciseMin || 0} MIN)</span>
                  <span style={{ color: C.amber }}>+{rec ? rec.bonus : 0} min</span>
                </div>
                <div className="h-px my-2" style={{ background: C.spaceLight }} />
                <div className="flex justify-between text-sm font-mono font-semibold">
                  <span>CIBLE</span>
                  <span style={{ color: C.moon }}>{rec ? formatHM(rec.totalMin) : "—"}</span>
                </div>
              </div>

              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <label className="text-xs font-mono tracking-widest block mb-2" style={{ color: C.vapor }}>
                  HEURE DE RÉVEIL
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 font-mono"
                  style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                />
              </div>

              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardPaste size={16} color={C.vapor} />
                  <span className="text-sm font-medium">Données Santé du jour</span>
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder="Colle ici (appui long → Coller) — l'enregistrement se fait tout seul"
                  rows={2}
                  className="w-full rounded-xl px-3 py-2 text-sm font-mono mb-2"
                  style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                />
                {pasteText && !parseError && (
                  <p className="text-xs mb-3 flex items-center gap-1" style={{ color: C.amber }}>
                    <Check size={12} /> Reconnu et enregistré automatiquement
                  </p>
                )}
                {parseError && (
                  <div className="mb-3">
                    <p className="text-xs mb-2" style={{ color: C.danger }}>{parseError}</p>
                    <button
                      onClick={() => handleParse(pasteText)}
                      className="w-full rounded-xl py-2 text-xs font-medium"
                      style={{ background: C.spaceLight, color: C.moon }}
                    >
                      Réessayer l'analyse
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <div className="text-xs font-mono mb-1 flex items-center gap-1" style={{ color: C.vapor }}>
                      <Footprints size={11} /> PAS
                    </div>
                    <input
                      type="number" inputMode="numeric" value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                      style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-mono mb-1 flex items-center gap-1" style={{ color: C.vapor }}>
                      <Activity size={11} /> EXO (MIN)
                    </div>
                    <input
                      type="number" inputMode="numeric" value={exerciseMin}
                      onChange={(e) => setExerciseMin(e.target.value)}
                      className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                      style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-mono mb-1 flex items-center gap-1" style={{ color: C.vapor }}>
                      <Flame size={11} /> ACTIVES (KCAL)
                    </div>
                    <input
                      type="number" inputMode="numeric" value={activeEnergy}
                      onChange={(e) => setActiveEnergy(e.target.value)}
                      className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                      style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-mono mb-1 flex items-center gap-1" style={{ color: C.vapor }}>
                      <Bed size={11} /> REPOS (KCAL)
                    </div>
                    <input
                      type="number" inputMode="numeric" value={restingEnergy}
                      onChange={(e) => setRestingEnergy(e.target.value)}
                      className="w-full rounded-lg px-2 py-2 text-sm font-mono"
                      style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveToday}
                  className="w-full rounded-xl py-3 font-medium flex items-center justify-center gap-2"
                  style={{ background: savedFlag ? C.amber : C.moon, color: C.void }}
                >
                  {savedFlag ? <>Enregistré <Check size={16} /></> : "Enregistrer (saisie manuelle)"}
                </button>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-4">
              {sortedKeys.length === 0 && (
                <div className="rounded-2xl p-6 text-center fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                  <p className="text-sm" style={{ color: C.vapor }}>
                    Aucune donnée pour l'instant. Enregistre ta première soirée depuis l'onglet Ce soir.
                  </p>
                </div>
              )}

              {chartData.length >= 2 && (
                <div className="rounded-2xl p-4 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                  <div className="text-xs font-mono tracking-widest mb-3" style={{ color: C.vapor }}>
                    TENDANCE (14 DERNIERS JOURS)
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke={C.spaceLight} vertical={false} />
                      <XAxis dataKey="date" stroke={C.vapor} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke={C.vapor} fontSize={10} tickLine={false} axisLine={false} width={28} />
                      <Tooltip contentStyle={{ background: C.spaceLight, border: "none", borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: C.vapor }} />
                      <Line type="monotone" dataKey="recommande" name="Recommandé" stroke={C.moon} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reel" name="Réel" stroke={C.amber} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {sortedKeys.map((key) => {
                const e = entries[key];
                return (
                  <div key={key} className="rounded-2xl p-4 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-display font-medium">{shortDate(key)}</span>
                      <span className="font-mono text-sm" style={{ color: C.moon }}>{formatHM(e.totalMin)}</span>
                    </div>
                    <div className="text-xs font-mono flex gap-3 mb-3 flex-wrap" style={{ color: C.vapor }}>
                      <span>{e.steps} pas</span>
                      <span>{e.exerciseMin} min exo</span>
                      {!!e.activeEnergy && <span>{e.activeEnergy} kcal actives</span>}
                      {!!e.restingEnergy && <span>{e.restingEnergy} kcal repos</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" step="0.25" inputMode="decimal"
                        placeholder={e.actualSleepMin ? formatHM(e.actualSleepMin) : "Sommeil réel (h)"}
                        value={actualDrafts[key] ?? ""}
                        onChange={(ev) => setActualDrafts({ ...actualDrafts, [key]: ev.target.value })}
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
                        style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
                      />
                      <button
                        onClick={() => handleSaveActual(key)}
                        className="p-2 rounded-lg"
                        style={{ background: C.spaceLight, color: C.amber }}
                        aria-label="Enregistrer le sommeil réel"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "guide" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Info size={16} color={C.moon} />
                  <span className="font-display font-medium">Pourquoi un Raccourci ?</span>
                </div>
                <p className="text-sm" style={{ color: C.vapor }}>
                  Une app web ne peut pas lire l'app Santé directement — c'est réservé aux apps natives.
                  Le Raccourci fait le pont : il lit tes données et les copie. Colle une fois, et l'app
                  analyse et enregistre toute seule, sans bouton à presser.
                </p>
              </div>

              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <span className="font-display font-medium block mb-2">Le rendre silencieux</span>
                <p className="text-sm" style={{ color: C.vapor }}>
                  Dans Raccourcis → onglet Automatisation → Créer une automatisation personnelle → Heure du jour
                  (ex. 7h). Choisis ton Raccourci « Export Santé », puis désactive « Demander avant d'exécuter ».
                  Il tournera seul chaque matin, sans notification — il ne te restera qu'à ouvrir SleepArc et coller.
                </p>
              </div>

              <div className="rounded-2xl p-5 space-y-3 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <span className="font-display font-medium block mb-1">Créer le Raccourci</span>
                {[
                  "Ouvre Raccourcis → Nouveau raccourci.",
                  "Ajoute 4× l'action « Obtenir un échantillon de santé » : Pas, Minutes d'exercice, Énergie active, Énergie au repos — plage Aujourd'hui, agrégation Somme.",
                  "Ajoute l'action « Texte », colle le modèle ci-dessous, puis remplace chaque <...> par la variable bleue correspondante (glisse-la depuis l'action au-dessus).",
                  "Ajoute « Copier le presse-papiers » en dernier, avec le Texte en entrée.",
                  "Renomme-le « Export Santé » et ajoute-le à l'écran d'accueil.",
                  "Chaque jour : lance le Raccourci, reviens ici, colle dans le champ « Ce soir » — c'est analysé et enregistré tout seul.",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="font-mono text-xs mt-0.5 shrink-0" style={{ color: C.moonDim }}>
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="text-sm" style={{ color: C.text }}>{step}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl p-5 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
                <span className="font-display font-medium block mb-3">Modèle à coller dans l'action Texte</span>
                <div className="rounded-xl p-3 text-xs font-mono mb-3 break-all" style={{ background: C.spaceLight, color: C.moon }}>
                  {TEMPLATE}
                </div>
                <button
                  onClick={copyTemplate}
                  className="w-full rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                  style={{ background: C.spaceLight, color: copiedTemplate ? C.amber : C.moon }}
                >
                  {copiedTemplate ? <>Copié <Check size={14} /></> : <>Copier <Copy size={14} /></>}
                </button>
                <p className="text-xs mt-3" style={{ color: C.vapor }}>
                  Les clés (steps, exerciseMin, activeEnergy) doivent rester identiques, sinon Analyser ne pourra pas les reconnaître.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "#000000AA" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 fade-up" style={{ background: C.space, border: `1px solid ${C.spaceLight}` }}>
            <div className="flex justify-between items-center mb-4">
              <span className="font-display font-medium">Modifier mon âge</span>
              <button onClick={() => setSettingsOpen(false)} aria-label="Fermer">
                <X size={18} color={C.vapor} />
              </button>
            </div>
            <input
              type="number" inputMode="numeric" value={ageDraft}
              onChange={(e) => setAgeDraft(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-lg font-mono mb-4"
              style={{ background: C.spaceLight, color: C.text, border: `1px solid ${C.spaceLight}` }}
            />
            <button
              onClick={handleSaveAge}
              className="w-full rounded-xl py-3 font-medium"
              style={{ background: C.moon, color: C.void }}
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {profile && (
        <div
          className="fixed bottom-0 left-0 right-0 flex justify-around py-3"
          style={{ background: `${C.void}EE`, borderTop: `1px solid ${C.spaceLight}`, backdropFilter: "blur(8px)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          {[
            { id: "home", label: "Ce soir", icon: Moon },
            { id: "history", label: "Historique", icon: Activity },
            { id: "guide", label: "Guide", icon: Info },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex flex-col items-center gap-1 px-4"
              style={{ color: tab === id ? C.moon : C.vapor }}
            >
              <Icon size={18} />
              <span className="text-xs font-mono">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
