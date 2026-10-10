(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (cls, text, onClick) => { const b = el("button", cls, text); b.type = "button"; if (onClick) b.addEventListener("click", onClick); return b; };
  const T = window.Terminos;
  const { iso, parse, addDays, daysBetween, holidays, nonWorking, computeTerm } = T;

  /* ---------- Constants ---------- */
  const AREAS = ["Civil", "Comercial", "Laboral", "Familia", "Penal", "Administrativo", "Constitucional", "Tributario", "Otro"];
  const CATS = ["Demanda", "Contestación", "Poder", "Memorial", "Auto", "Sentencia", "Prueba", "Contrato", "Notificación", "Recurso", "Otro"];
  const ESTADOS = { activo: "Activo", suspendido: "Suspendido", terminado: "Terminado", archivado: "Archivado" };
  const ROLES = { demandante: "Demandante", demandado: "Demandado", tercero: "Tercero", asesoria: "Asesoría" };
  const ROLES_USUARIO = { admin: "Administrador", abogado: "Abogado", asistente: "Asistente" };
  const TIPOS = { audiencia: "Audiencia", vencimiento: "Vencimiento", diligencia: "Diligencia", cita: "Cita", otro: "Otro" };
  const EXTS = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "webp", "gif", "txt", "csv", "md", "msg", "eml"];
  const MAX = 50 * 1024 * 1024;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const PRESETS = [
    ["Recurso de reposición", "CGP art. 318", 3, "habiles"],
    ["Apelación de autos", "CGP art. 322", 3, "habiles"],
    ["Impugnación de fallo de tutela", "Decreto 2591 de 1991, art. 31", 3, "habiles"],
    ["Contestar demanda, proceso verbal sumario", "CGP art. 391", 10, "habiles"],
    ["Contestar demanda, proceso verbal", "CGP art. 369", 20, "habiles"],
    ["Excepciones en proceso ejecutivo", "CGP art. 442", 10, "habiles"],
    ["Responder derecho de petición", "Ley 1755 de 2015, art. 14", 15, "habiles"],
    ["Apelación de sentencia notificada por estado", "CGP art. 322", 3, "habiles"]
  ];

  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const fmtLong = (d) => DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
  const fmtShort = (s) => { if (!s) return ""; const d = parse(s.slice(0, 10)); return d.getDate() + " " + MESES[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); };
  const fmtStamp = (s) => { if (!s) return ""; const d = new Date(s); return fmtShort(iso(d)) + " " + T.pad(d.getHours()) + ":" + T.pad(d.getMinutes()); };
  const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());

  /* ---------- API ---------- */
  async function api(method, url, body) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); } catch (e) { throw new Error("Sin conexión con el servidor. Revisa tu red e intenta de nuevo."); }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && url !== "/api/login") { showLogin("Tu sesión terminó por inactividad o expiró. Vuelve a entrar."); throw new Error("Sesión terminada."); }
    if (!res.ok) throw new Error((data && data.error) || "No se pudo completar la acción.");
    return data;
  }

  /* ---------- State ---------- */
  let me = null;
  const S = { casos: [], documentos: [], eventos: [], actuaciones: [], usuarios: [] };
  let view = "panel", currentCase = null, caseTab = "docs", admTab = "usuarios";
  let calMonth = new Date(today().getFullYear(), today().getMonth(), 1), calSel = iso(today());
  let ready = false, pendingDel = null, editingCase = null, editingEvent = null, editingUser = null;
  const isAdmin = () => me && me.rol === "admin";
  const isLawyer = () => me && (me.rol === "admin" || me.rol === "abogado");

  const same = (a, b) => a != null && b != null && String(a) === String(b);
  const caseById = (id) => S.casos.find((c) => same(c.id, id));
  const caseLabel = (c) => c ? (c.cliente || "Sin cliente") + (c.radicado ? " · " + c.radicado : "") : "";
  const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB";
  const ext = (name) => (name.split(".").pop() || "").toLowerCase();
  const byFecha = (a, b) => (a.fecha + (a.hora || "99")).localeCompare(b.fecha + (b.hora || "99"));

  function fillSelect(sel, items, first) {
    sel.replaceChildren();
    if (first) { const o = el("option", null, first[1]); o.value = first[0]; sel.append(o); }
    items.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; sel.append(o); });
  }
  fillSelect($("c-area"), AREAS.map((a) => [a, a]), ["", "Todas las áreas"]);
  fillSelect($("k-area"), AREAS.map((a) => [a, a]));
  fillSelect($("d-cat"), CATS.map((a) => [a, a]), ["", "Todos los tipos"]);

  function emptyBox(title, text) { if (!ready) { title = "Cargando…"; text = "Consultando el archivo."; } const e = el("div", "empty"); e.append(el("b", null, title), el("p", null, text)); return e; }
  function msg(id, t, k) { const m = $(id); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }

  function relWhen(fecha) {
    const n = daysBetween(today(), parse(fecha));
    if (n === 0) return ["Hoy", "hot"];
    if (n === 1) return ["Mañana", "hot"];
    if (n < 0) return ["Hace " + -n + " d", "muted"];
    return ["En " + n + " días", n <= 3 ? "hot" : n <= 7 ? "soon" : "muted"];
  }

  /* ---------- Session ---------- */
  function showLogin(text) {
    me = null;
    $("app").hidden = true; $("login").hidden = false;
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    msg("l-msg", text || "");
    $("l-email").focus();
  }
  async function enter(user) {
    me = user;
    $("login").hidden = true; $("app").hidden = false;
    $("me-nombre").textContent = me.nombre;
    $("me-rol").textContent = ROLES_USUARIO[me.rol] || me.rol;
    $("l-pass").value = "";
    view = "panel"; currentCase = null;
    await reload();
    go("panel");
  }
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("l-email").value.trim(), password = $("l-pass").value;
    if (!email || !password) { msg("l-msg", "Escribe tu correo y tu contraseña.", "err"); return; }
    msg("l-msg", "Entrando…");
    try { const r = await api("POST", "/api/login", { email, password }); await enter(r.user); }
    catch (err) { msg("l-msg", err.message, "err"); }
  });
  $("me-salir").addEventListener("click", async () => { try { await api("POST", "/api/logout"); } catch (e) {} showLogin("Sesión cerrada."); });
  $("me-clave").addEventListener("click", () => { $("pw-actual").value = ""; $("pw-nueva").value = ""; msg("pass-msg", ""); $("dlg-pass").showModal(); $("pw-actual").focus(); });
  $("pass-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await api("PUT", "/api/me/password", { actual: $("pw-actual").value, nueva: $("pw-nueva").value }); msg("pass-msg", "Contraseña cambiada. Se cerraron tus otras sesiones.", "ok"); }
    catch (err) { msg("pass-msg", err.message, "err"); }
  });

  async function reload() {
    const d = await api("GET", "/api/datos");
    Object.assign(S, d);
    ready = true;
    render();
  }
  // Every write goes through the server, then the view refreshes from it.
  async function act(fn, onError) {
    try { await fn(); await reload(); return true; }
    catch (err) { if (onError) onError(err.message); else window.alert(err.message); return false; }
  }

  /* ---------- Navigation ---------- */
  function go(v, caseId) {
    if (v === "admin" && !isAdmin()) v = "panel";
    view = v;
    if (caseId !== undefined) currentCase = caseId;
    pendingDel = null;
    document.querySelectorAll(".view").forEach((s) => { s.hidden = s.id !== "v-" + v; });
    document.querySelectorAll(".nav button").forEach((b) => {
      const active = b.dataset.view === v || (v === "caso" && b.dataset.view === "casos");
      if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]"); if (g) { go(g.dataset.go); return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "new-case") openCase(null);
    if (a.dataset.act === "new-event") openEvent(null, { fecha: view === "calendario" ? calSel : iso(today()), casoId: view === "caso" ? currentCase : "" });
  });
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  function render() {
    if (!me) return;
    document.querySelectorAll(".lawyer-only").forEach((n) => { n.hidden = !isLawyer(); });
    document.querySelectorAll(".admin-only").forEach((n) => { n.hidden = !isAdmin(); });
    if (view === "panel") renderPanel();
    if (view === "casos") renderCasos();
    if (view === "caso") renderCaso();
    if (view === "calendario") renderCal();
    if (view === "documentos") renderDocs();
    if (view === "terminos") renderTerm();
    if (view === "admin" && isAdmin()) renderAdmin();
  }

  /* ---------- Agenda list (shared) ---------- */
  function agendaList(items, opts) {
    opts = opts || {};
    if (!items.length) return emptyBox(opts.emptyTitle || "Nada agendado", opts.emptyText || "Agenda audiencias, vencimientos y citas para verlos aquí.");
    const ul = el("ul", "agenda");
    items.forEach((ev) => {
      const li = el("li", ev.hecho ? "done" : "");
      const d = parse(ev.fecha);
      const date = el("div", "date"); date.append(el("b", null, d.getDate()), el("span", null, MESES[d.getMonth()].slice(0, 3)));
      const t = el("div", "t");
      const top = el("div", "row"); top.style.gap = "6px";
      top.append(el("span", "pill " + ev.tipo, TIPOS[ev.tipo] || "Otro"));
      if (ev.hora) top.append(el("span", "small muted num", ev.hora));
      t.append(top, el("b", null, ev.titulo));
      const c = caseById(ev.casoId);
      if (c && !opts.hideCase) { t.append(el("br"), btn("link small", caseLabel(c), () => go("caso", c.id))); }
      if (ev.lugar) t.append(el("div", "small muted", ev.lugar));
      if (ev.nota) t.append(el("div", "small", ev.nota));
      const right = el("div"); right.style.display = "grid"; right.style.gap = "6px"; right.style.justifyItems = "end";
      const [w, cls] = relWhen(ev.fecha);
      right.append(el("span", "when " + (ev.hecho ? "muted" : cls), ev.hecho ? "Cumplido" : w));
      const r = el("div", "row"); r.style.gap = "4px";
      r.append(btn("ghost sm", ev.hecho ? "Reabrir" : "Cumplido", () => act(() => api("PUT", "/api/eventos/" + ev.id, { hecho: !ev.hecho }))),
        btn("ghost sm", "Editar", () => openEvent(ev)));
      right.append(r);
      li.append(date, t, right);
      ul.append(li);
    });
    return ul;
  }

  /* ---------- Panel ---------- */
  function renderPanel() {
    const t = today();
    $("today-label").textContent = fmtLong(t);
    const in7 = iso(addDays(t, 7)), tIso = iso(t);
    const pend = S.eventos.filter((e) => !e.hecho);
    $("s-activos").textContent = S.casos.filter((c) => c.estado === "activo").length;
    $("s-aud").textContent = pend.filter((e) => e.tipo === "audiencia" && e.fecha >= tIso && e.fecha <= in7).length;
    const venc = pend.filter((e) => e.tipo === "vencimiento" && e.fecha >= tIso && e.fecha <= in7).length;
    $("s-venc").textContent = venc;
    $("s-venc-box").classList.toggle("alert", venc > 0);
    $("s-docs").textContent = S.documentos.length;

    const overdue = pend.filter((e) => e.fecha < tIso && e.tipo === "vencimiento").sort(byFecha);
    const upcoming = pend.filter((e) => e.fecha >= tIso && e.fecha <= iso(addDays(t, 30))).sort(byFecha);
    const box = $("p-agenda"); box.replaceChildren();
    box.append(agendaList(overdue.concat(upcoming), { emptyTitle: "Sin pendientes en los próximos 30 días", emptyText: "Usa “Agendar” para registrar audiencias y vencimientos, o calcula un término en la sección Términos." }));

    const pc = $("p-casos"); pc.replaceChildren();
    const recent = S.casos.slice().sort((a, b) => b.actualizado.localeCompare(a.actualizado)).slice(0, 6);
    if (!recent.length) { pc.append(emptyBox("Aún no hay expedientes", isLawyer() ? "Crea el primero con “Nuevo expediente”. Luego podrás subir documentos, registrar actuaciones y agendar audiencias." : "Cuando un administrador te asigne expedientes aparecerán aquí.")); return; }
    const ul = el("ul", "agenda");
    recent.forEach((c) => {
      const li = el("li"); li.style.gridTemplateColumns = "minmax(0,1fr) auto"; li.style.cursor = "pointer";
      const t1 = el("div", "t"); t1.append(el("b", null, c.cliente), el("div", "rad muted", c.radicado));
      if (c.despacho) t1.append(el("div", "small muted", c.despacho));
      li.append(t1, el("span", "pill " + c.estado, ESTADOS[c.estado]));
      li.addEventListener("click", () => go("caso", c.id));
      ul.append(li);
    });
    pc.append(ul);
  }

  /* ---------- Casos ---------- */
  ["c-q", "c-estado", "c-area"].forEach((id) => $(id).addEventListener("input", renderCasos));
  function renderCasos() {
    const q = norm($("c-q").value.trim()), est = $("c-estado").value, area = $("c-area").value;
    const list = S.casos.filter((c) => (!est || c.estado === est) && (!area || c.area === area) &&
      (!q || norm([c.radicado, c.cliente, c.contraparte, c.despacho, c.clase, c.responsable].join(" ")).includes(q)))
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado));
    const box = $("c-list"); box.replaceChildren();
    if (!S.casos.length) { box.append(emptyBox("Aún no hay expedientes", isLawyer() ? "Pulsa “Nuevo expediente” para registrar radicado, cliente, despacho y área." : "Cuando un administrador te asigne expedientes aparecerán aquí.")); return; }
    if (!list.length) { box.append(emptyBox("Sin resultados", "Ningún expediente coincide con la búsqueda o los filtros.")); return; }
    const tbl = el("table"), th = el("thead"), hr = el("tr");
    ["Cliente", "Radicado", "Despacho", "Área", "Próxima fecha", "Estado"].forEach((h) => hr.append(el("th", null, h)));
    th.append(hr); tbl.append(th);
    const tb = el("tbody"); const tIso = iso(today());
    list.forEach((c) => {
      const tr = el("tr", "click"); tr.tabIndex = 0;
      const cl = el("td"); cl.append(el("div", "strong", c.cliente)); if (c.contraparte) cl.append(el("div", "small muted", "vs. " + c.contraparte));
      const next = S.eventos.filter((e) => same(e.casoId, c.id) && !e.hecho && e.fecha >= tIso).sort(byFecha)[0];
      const nx = el("td", "small"); if (next) { nx.append(el("div", null, fmtShort(next.fecha)), el("div", "muted", TIPOS[next.tipo])); } else nx.append(el("span", "muted", "—"));
      const st = el("td"); st.append(el("span", "pill " + c.estado, ESTADOS[c.estado]));
      tr.append(cl, el("td", "rad", c.radicado), el("td", "small", c.despacho || "—"), el("td", "small", c.area || "—"), nx, st);
      tr.addEventListener("click", () => go("caso", c.id));
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter") go("caso", c.id); });
      tb.append(tr);
    });
    tbl.append(tb); box.append(tbl);
  }

  /* ---------- Caso detalle ---------- */
  document.querySelectorAll("#k-tabs button").forEach((b) => b.addEventListener("click", () => { caseTab = b.dataset.tab; renderCaso(); }));
  $("k-add-event").addEventListener("click", () => openEvent(null, { casoId: currentCase, fecha: iso(today()) }));

  function renderCaso() {
    const c = caseById(currentCase);
    const head = $("k-head"); head.replaceChildren();
    if (!c) { head.append(emptyBox("Expediente no encontrado", "Puede que se haya eliminado o que ya no lo tengas asignado.")); return; }
    const top = el("div", "case-title");
    const left = el("div"); left.style.minWidth = "0";
    left.append(el("p", "eyebrow", (c.area || "Expediente") + (c.clase ? " · " + c.clase : "")), el("h1", null, c.cliente), el("div", "rad muted", c.radicado));
    const right = el("div", "row");
    right.append(el("span", "pill " + c.estado, ESTADOS[c.estado]));
    if (isLawyer()) right.append(btn("ghost", "Editar", () => openCase(c)));
    top.append(left, right);
    const dl = el("dl", "meta");
    [["Contraparte", c.contraparte], ["Despacho", c.despacho], ["Representamos a", ROLES[c.rol]], ["Responsable", c.responsable], ["Inicio", fmtShort(c.inicio)],
      ["Con acceso", (c.asignados || []).map((u) => u.nombre).join(", ") || "Solo administradores"]]
      .forEach(([k, v]) => { const d = el("div"); d.append(el("dt", null, k), el("dd", null, v || "—")); dl.append(d); });
    head.append(top, dl);
    if (c.notas) { const n = el("p", null, c.notas); n.style.margin = "0"; n.style.whiteSpace = "pre-wrap"; head.append(n); }

    document.querySelectorAll("#k-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === caseTab)));
    $("k-docs").hidden = caseTab !== "docs"; $("k-agenda").hidden = caseTab !== "agenda"; $("k-act").hidden = caseTab !== "act";

    const docs = S.documentos.filter((d) => same(d.casoId, c.id)).sort((a, b) => b.subido.localeCompare(a.subido));
    const dl2 = $("k-docs-list"); dl2.replaceChildren();
    dl2.append(docs.length ? fileList(docs, true) : emptyBox("Sin documentos", "Sube demandas, poderes, autos o pruebas desde el panel de la derecha."));
    mountUploader($("k-uploader"), () => currentCase, false);

    const evs = S.eventos.filter((e) => same(e.casoId, c.id)).sort(byFecha);
    const ag = $("k-agenda-list"); ag.replaceChildren();
    ag.append(agendaList(evs, { hideCase: true, emptyTitle: "Sin fechas para este expediente", emptyText: "Agenda la próxima audiencia o el vencimiento de un término." }));

    const acts = S.actuaciones.filter((a) => same(a.casoId, c.id)).sort((a, b) => (b.fecha + b.creado).localeCompare(a.fecha + a.creado));
    const al = $("k-act-list"); al.replaceChildren();
    if (!acts.length) al.append(emptyBox("Sin actuaciones registradas", "Lleva aquí la bitácora del proceso: autos, memoriales radicados, notificaciones."));
    else {
      const ul = el("ul", "timeline");
      acts.forEach((a) => {
        const li = el("li"); li.append(el("div", "d", fmtShort(a.fecha) + (a.creadoPor ? " · " + a.creadoPor : "")), el("p", null, a.texto));
        if (isLawyer()) {
          const r = el("div", "row"); r.style.marginTop = "4px";
          if (pendingDel === "act:" + a.id) {
            r.append(btn("ghost sm danger", "Sí, eliminar", () => { pendingDel = null; act(() => api("DELETE", "/api/actuaciones/" + a.id)); }),
              btn("ghost sm", "Cancelar", () => { pendingDel = null; renderCaso(); }));
          } else r.append(btn("ghost sm", "Eliminar", () => { pendingDel = "act:" + a.id; renderCaso(); }));
          li.append(r);
        }
        ul.append(li);
      });
      al.append(ul);
    }
    if (!$("a-fecha").value) $("a-fecha").value = iso(today());
  }

  $("act-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fecha = $("a-fecha").value, texto = $("a-texto").value.trim();
    if (!fecha || !texto) { msg("a-msg", "Escribe la fecha y la actuación.", "err"); return; }
    const ok = await act(() => api("POST", "/api/casos/" + currentCase + "/actuaciones", { fecha, texto }), (m) => msg("a-msg", m, "err"));
    if (ok) { $("a-texto").value = ""; msg("a-msg", "Actuación guardada.", "ok"); }
  });

  /* ---------- Files ---------- */
  const fileUrl = (id) => "/api/documentos/" + id + "/archivo";
  function fileList(docs, hideCase) {
    const ul = el("ul", "files");
    docs.forEach((v) => {
      const li = el("li", "file");
      li.append(el("span", "chip", v.tipo || "doc"));
      const name = el("div", "fname");
      const a = el("a", null, v.nombre); a.href = fileUrl(v.id); a.target = "_blank"; a.rel = "noopener";
      name.append(a);
      if (v.version > 1) name.append(" ", el("span", "ver", "v" + v.version));
      name.append(el("span", "fsub", [v.categoria, fmtShort(v.subido), fmtSize(v.tamano), v.subidoPor].filter(Boolean).join(" · ")));
      const c = caseById(v.casoId);
      if (c && !hideCase) name.append(btn("link small", caseLabel(c), () => go("caso", c.id)));
      if (v.nota) name.append(el("span", "fsub", v.nota));
      li.append(name);
      const actions = el("div", "actions");
      const open = el("a", "btn ghost sm", "Abrir"); open.href = a.href; open.target = "_blank"; open.rel = "noopener";
      const dl = el("a", "btn ghost sm", "Descargar"); dl.href = fileUrl(v.id) + "?descargar";
      actions.append(open, dl);
      if (v.version > 1) actions.append(btn("ghost sm", "Versiones", () => openVersions(v)));
      if (isLawyer()) {
        if (pendingDel === "doc:" + v.id) {
          actions.append(btn("ghost sm danger", "Sí, a la papelera", () => { pendingDel = null; act(() => api("DELETE", "/api/documentos/" + v.id)); }),
            btn("ghost sm", "Cancelar", () => { pendingDel = null; render(); }));
        } else actions.append(btn("ghost sm danger", "Eliminar", () => { pendingDel = "doc:" + v.id; render(); }));
      }
      li.append(actions);
      ul.append(li);
    });
    return ul;
  }

  async function openVersions(doc) {
    $("ver-title").textContent = "Versiones de " + doc.nombre;
    const box = $("ver-list"); box.replaceChildren(el("p", "small muted", "Cargando…"));
    $("dlg-versions").showModal();
    try {
      const vs = await api("GET", "/api/documentos/" + doc.id + "/versiones");
      const ul = el("ul", "files"); ul.style.margin = "0 -22px";
      vs.forEach((v) => {
        const li = el("li", "file");
        li.append(el("span", "chip", "v" + v.version));
        const n = el("div", "fname");
        const a = el("a", null, fmtStamp(v.subido) + (v.subidoPor ? " · " + v.subidoPor : "")); a.href = fileUrl(v.id); a.target = "_blank"; a.rel = "noopener";
        n.append(a, el("span", "fsub", fmtSize(v.tamano) + (v.nota ? " · " + v.nota : "")), el("span", "hash", "SHA-256 " + v.sha256));
        li.append(n, el("span"));
        ul.append(li);
      });
      box.replaceChildren(ul);
    } catch (err) { box.replaceChildren(el("p", "msg err", err.message)); }
  }

  const uploaders = new Map();
  function mountUploader(host, getCaso, withCaseSelect) {
    if (uploaders.has(host)) { const u = uploaders.get(host); if (u.refreshCases) u.refreshCases(); return; }
    const st = { picked: [] };
    const form = el("form"); form.noValidate = true; form.style.display = "grid"; form.style.gap = "12px";
    const uid = host.id;
    let caseSel = null;
    if (withCaseSelect) {
      const lab = el("label", "f", "Expediente"); lab.htmlFor = uid + "-caso";
      caseSel = el("select"); caseSel.id = uid + "-caso"; lab.append(caseSel); form.append(lab);
    }
    const lc = el("label", "f", "Tipo de documento"); lc.htmlFor = uid + "-cat";
    const cat = el("select"); cat.id = uid + "-cat"; fillSelect(cat, CATS.map((c) => [c, c])); lc.append(cat);
    const ln = el("label", "f"); ln.htmlFor = uid + "-nota"; ln.append("Nota ", el("span", "hint", "(opcional)"));
    const nota = el("input"); nota.type = "text"; nota.id = uid + "-nota"; nota.placeholder = "Ej.: Radicado el 3 de octubre"; ln.append(nota);
    const drop = el("label", "drop"); drop.htmlFor = uid + "-files";
    const inp = el("input"); inp.type = "file"; inp.multiple = true; inp.id = uid + "-files";
    inp.accept = EXTS.map((x) => "." + x).join(",");
    drop.append(inp, el("strong", null, "Arrastra archivos o haz clic"), el("span", "hint", "PDF, Word, Excel, imágenes, correos o texto, hasta 50 MB. Un archivo con el mismo nombre se guarda como versión nueva."));
    const ul = el("ul", "picked");
    const send = el("button", "primary", "Subir"); send.type = "submit"; send.disabled = true;
    const m = el("p", "msg"); m.setAttribute("role", "status");
    form.append(lc, ln, drop, ul, send, m);
    host.append(form);
    const say = (t, k) => { m.textContent = t; m.className = "msg" + (k ? " " + k : ""); };
    const refresh = () => {
      ul.replaceChildren();
      st.picked.forEach((f) => { const li = el("li"); li.append(el("span", null, f.name), el("span", null, fmtSize(f.size))); ul.append(li); });
      send.disabled = !st.picked.length;
      send.textContent = st.picked.length > 1 ? "Subir " + st.picked.length + " archivos" : "Subir";
    };
    const pick = (files) => {
      const badList = []; st.picked = [];
      Array.from(files).forEach((f) => {
        if (!EXTS.includes(ext(f.name))) badList.push(f.name + " (formato no admitido)");
        else if (f.size > MAX) badList.push(f.name + " (supera 50 MB)");
        else if (!f.size) badList.push(f.name + " (vacío)");
        else st.picked.push(f);
      });
      refresh(); say(badList.length ? "No se agregaron: " + badList.join(", ") : "", badList.length ? "err" : "");
    };
    inp.addEventListener("change", () => pick(inp.files));
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) pick(e.dataTransfer.files); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const casoId = caseSel ? caseSel.value : getCaso();
      if (!casoId) { say("Elige el expediente al que pertenecen los archivos.", "err"); return; }
      send.disabled = true;
      const fd = new FormData();
      fd.append("categoria", cat.value); fd.append("nota", nota.value.trim());
      st.picked.forEach((f) => fd.append("archivos", f, f.name));
      const n = st.picked.length;
      say("Subiendo " + (n === 1 ? st.picked[0].name : n + " archivos") + "…");
      const ok = await act(() => api("POST", "/api/casos/" + casoId + "/documentos", fd), (t) => say(t, "err"));
      if (ok) { st.picked = []; inp.value = ""; nota.value = ""; refresh(); say(n === 1 ? "Documento guardado." : n + " documentos guardados.", "ok"); }
      else send.disabled = false;
    });
    const u = {};
    if (caseSel) {
      u.refreshCases = () => {
        const prev = caseSel.value;
        fillSelect(caseSel, S.casos.slice().sort((a, b) => a.cliente.localeCompare(b.cliente)).map((c) => [c.id, caseLabel(c)]), ["", S.casos.length ? "Elige un expediente" : "No tienes expedientes"]);
        caseSel.value = prev;
      };
      u.refreshCases();
    }
    uploaders.set(host, u);
  }

  /* ---------- Documentos ---------- */
  ["d-q", "d-cat"].forEach((id) => $(id).addEventListener("input", renderDocs));
  function renderDocs() {
    const q = norm($("d-q").value.trim()), cat = $("d-cat").value;
    const list = S.documentos.filter((d) => {
      const c = caseById(d.casoId) || {};
      return (!cat || d.categoria === cat) && (!q || norm([d.nombre, d.nota, d.categoria, c.cliente, c.radicado].join(" ")).includes(q));
    }).sort((a, b) => b.subido.localeCompare(a.subido));
    const box = $("d-list"); box.replaceChildren();
    if (!S.documentos.length) box.append(emptyBox("Aún no hay documentos", "Elige un expediente a la derecha y sube los archivos. También puedes hacerlo desde la ficha de cada expediente."));
    else if (!list.length) box.append(emptyBox("Sin resultados", "Ningún documento coincide con la búsqueda."));
    else box.append(fileList(list, false));
    mountUploader($("d-uploader"), () => "", true);
  }

  /* ---------- Calendar ---------- */
  $("cal-prev").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); });
  $("cal-next").addEventListener("click", () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); });
  $("cal-today").addEventListener("click", () => { calMonth = new Date(today().getFullYear(), today().getMonth(), 1); calSel = iso(today()); renderCal(); });
  $("cal-day-add").addEventListener("click", () => openEvent(null, { fecha: calSel }));

  function renderCal() {
    $("cal-title").textContent = cap(MESES[calMonth.getMonth()]) + " " + calMonth.getFullYear();
    const grid = $("cal"); grid.replaceChildren();
    ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].forEach((d) => grid.append(el("div", "dow", d)));
    const startOffset = (calMonth.getDay() + 6) % 7;
    const start = addDays(calMonth, -startOffset);
    const tIso = iso(today());
    const byDay = {};
    S.eventos.forEach((e) => { (byDay[e.fecha] = byDay[e.fecha] || []).push(e); });
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), k = iso(d);
      if (i >= 35 && d.getMonth() !== calMonth.getMonth()) break;
      const hol = holidays(d.getFullYear()).get(k);
      const cls = ["day"];
      if (d.getMonth() !== calMonth.getMonth()) cls.push("out");
      if (hol || d.getDay() === 0) cls.push("nw");
      if (k === tIso) cls.push("today");
      if (k === calSel) cls.push("sel");
      const b = btn(cls.join(" "));
      const evs = (byDay[k] || []).sort(byFecha);
      b.setAttribute("aria-label", fmtLong(d) + (hol ? ", festivo " + hol : "") + (evs.length ? ", " + evs.length + " evento(s)" : ""));
      b.append(el("span", "n", d.getDate()));
      if (hol) b.append(el("span", "hol", hol));
      evs.slice(0, 3).forEach((e) => b.append(el("span", "ev " + e.tipo + (e.hecho ? " done" : ""), (e.hora ? e.hora + " " : "") + e.titulo)));
      if (evs.length > 3) b.append(el("span", "more", "+" + (evs.length - 3) + " más"));
      const dots = el("span", "dots"); evs.slice(0, 4).forEach((e) => dots.append(el("i", "dot " + e.tipo))); b.append(dots);
      b.addEventListener("click", () => { calSel = k; renderCal(); });
      grid.append(b);
    }
    const sd = parse(calSel);
    const hol = holidays(sd.getFullYear()).get(calSel);
    $("cal-day-title").textContent = cap(fmtLong(sd));
    const list = $("cal-day-list"); list.replaceChildren();
    if (hol) { const h = el("p", "small", "Festivo: " + hol); h.style.cssText = "margin:0;padding:10px 18px;color:var(--danger);border-bottom:1px solid var(--line)"; list.append(h); }
    list.append(agendaList((byDay[calSel] || []).sort(byFecha), { emptyTitle: "Día libre", emptyText: "No hay nada agendado. Usa “Agendar este día” para añadir una audiencia o vencimiento." }));
  }

  /* ---------- Terms ---------- */
  let lastTerm = null, lastPreset = null;
  ["t-inicio", "t-n", "t-unidad", "t-judicial"].forEach((id) => $(id).addEventListener("input", renderTerm));
  ["t-n", "t-unidad"].forEach((id) => $(id).addEventListener("input", () => { lastPreset = null; }));
  $("t-form").addEventListener("submit", (e) => e.preventDefault());
  PRESETS.forEach(([name, norma, n, unit]) => {
    const b = btn();
    const l = el("span"); l.append(name, el("small", null, norma));
    b.append(l, el("span", "d", n + (unit === "habiles" ? " días háb." : " días")));
    b.addEventListener("click", () => { $("t-n").value = n; $("t-unidad").value = unit; lastPreset = name; renderTerm(); $("t-out").scrollIntoView({ block: "nearest" }); });
    $("t-presets").append(b);
  });
  $("t-agendar").addEventListener("click", () => {
    if (!lastTerm) return;
    openEvent(null, { tipo: "vencimiento", fecha: lastTerm.fin, titulo: lastPreset ? "Vence: " + lastPreset.toLowerCase() : "Vence término de " + lastTerm.n + " " + lastTerm.unitLbl });
  });
  function renderTerm() {
    if (!$("t-inicio").value) $("t-inicio").value = iso(today());
    const s = $("t-inicio").value, n = parseInt($("t-n").value, 10), unit = $("t-unidad").value, jud = $("t-judicial").checked;
    const out = $("t-out"); out.replaceChildren(); lastTerm = null;
    if (!s || !(n > 0) || n > 3650) { out.append(el("span", "small", "Escribe una fecha y una duración válidas.")); $("t-agendar").disabled = true; return; }
    const r = computeTerm(s, n, unit, jud);
    const unitLbl = unit === "habiles" ? "días hábiles" : unit === "calendario" ? "días calendario" : "meses";
    out.append(el("span", "eyebrow", "El término vence el"), el("span", "big", cap(fmtLong(r.fin))));
    const [w] = relWhen(iso(r.fin));
    out.append(el("span", "small", n + " " + unitLbl + " desde el " + fmtShort(s) + ". " + w + "."));
    if (r.skipped.length) {
      const det = el("details", "skip");
      det.append(el("summary", null, r.skipped.length + " día(s) no hábiles descontados"));
      const ul = el("ul");
      const named = r.skipped.filter(([, why]) => why !== "Sábado" && why !== "Domingo");
      const weekend = r.skipped.length - named.length;
      if (weekend) ul.append(el("li", null, weekend + " sábados y domingos"));
      named.forEach(([d, why]) => ul.append(el("li", null, fmtShort(d) + ": " + why)));
      det.append(ul); out.append(det);
    }
    lastTerm = { fin: iso(r.fin), n, unitLbl };
    $("t-agendar").disabled = false;
  }

  /* ---------- Case dialog ---------- */
  function openCase(c) {
    editingCase = c ? c.id : null;
    $("case-dlg-title").textContent = c ? "Editar expediente" : "Nuevo expediente";
    const v = c || { estado: "activo", rol: "demandante", area: "Civil", inicio: iso(today()), responsable: me.rol === "abogado" ? me.nombre : "" };
    $("k-radicado").value = v.radicado || ""; $("k-cliente").value = v.cliente || ""; $("k-contraparte").value = v.contraparte || "";
    $("k-despacho").value = v.despacho || ""; $("k-area").value = v.area || "Civil"; $("k-clase").value = v.clase || "";
    $("k-rol").value = v.rol || "demandante"; $("k-estado").value = v.estado || "activo"; $("k-responsable").value = v.responsable || "";
    $("k-inicio").value = v.inicio || ""; $("k-notas").value = v.notas || "";
    msg("case-msg", "");
    const box = $("k-asignados"); box.replaceChildren();
    if (isAdmin()) {
      const assigned = new Set((c ? c.asignados || [] : []).map((u) => u.id));
      S.usuarios.filter((u) => u.rol !== "admin").forEach((u) => {
        const lab = el("label", "check"); const cb = el("input"); cb.type = "checkbox"; cb.value = u.id; cb.checked = assigned.has(u.id);
        lab.append(cb, el("span", null, u.nombre + " (" + ROLES_USUARIO[u.rol].toLowerCase() + ")"));
        box.append(lab);
      });
      if (!box.children.length) box.append(el("span", "small muted", "Aún no hay abogados ni asistentes. Créalos en Administración."));
    }
    const z = $("case-del-zone"); z.replaceChildren();
    if (c && isAdmin()) {
      z.append(btn("ghost danger", "Eliminar expediente", () => {
        if (S.documentos.some((d) => same(d.casoId, c.id))) { msg("case-msg", "Este expediente tiene documentos. Márcalo como Archivado.", "err"); return; }
        z.replaceChildren(btn("ghost danger", "Confirmar eliminación", async () => {
          const ok = await act(() => api("DELETE", "/api/casos/" + c.id), (m) => msg("case-msg", m, "err"));
          if (ok) { $("dlg-case").close(); go("casos"); }
        }));
      }));
    }
    $("dlg-case").showModal();
    $("k-radicado").focus();
  }
  $("case-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      radicado: $("k-radicado").value.trim(), cliente: $("k-cliente").value.trim(), contraparte: $("k-contraparte").value.trim(),
      despacho: $("k-despacho").value.trim(), area: $("k-area").value, clase: $("k-clase").value.trim(), rol: $("k-rol").value,
      estado: $("k-estado").value, responsable: $("k-responsable").value.trim(), inicio: $("k-inicio").value, notas: $("k-notas").value.trim()
    };
    if (!data.radicado || !data.cliente) { msg("case-msg", "El radicado y el cliente son obligatorios.", "err"); return; }
    const asignados = Array.from($("k-asignados").querySelectorAll("input:checked")).map((i) => Number(i.value));
    let id = editingCase;
    const ok = await act(async () => {
      if (id) await api("PUT", "/api/casos/" + id, data);
      else id = (await api("POST", "/api/casos", Object.assign({ asignados }, data))).id;
      if (isAdmin() && editingCase) await api("PUT", "/api/casos/" + id + "/asignados", { usuarios: asignados });
    }, (m) => msg("case-msg", m, "err"));
    if (ok) { $("dlg-case").close(); go("caso", id); }
  });

  /* ---------- Event dialog ---------- */
  function openEvent(ev, preset) {
    editingEvent = ev ? ev.id : null;
    const v = ev || Object.assign({ tipo: "audiencia", fecha: iso(today()), casoId: "" }, preset || {});
    $("event-dlg-title").textContent = ev ? "Editar" : "Agendar";
    fillSelect($("e-caso"), S.casos.slice().sort((a, b) => a.cliente.localeCompare(b.cliente)).map((c) => [c.id, caseLabel(c)]), ["", "Sin expediente (visible para toda la oficina)"]);
    $("e-titulo").value = v.titulo || ""; $("e-tipo").value = v.tipo || "audiencia"; $("e-caso").value = v.casoId == null ? "" : String(v.casoId);
    $("e-fecha").value = v.fecha || ""; $("e-hora").value = v.hora || ""; $("e-lugar").value = v.lugar || ""; $("e-nota").value = v.nota || "";
    msg("event-msg", "");
    const z = $("event-del-zone"); z.replaceChildren();
    if (ev && isLawyer()) {
      z.append(btn("ghost danger", "Eliminar", () => {
        z.replaceChildren(btn("ghost danger", "Confirmar eliminación", async () => {
          const ok = await act(() => api("DELETE", "/api/eventos/" + ev.id), (m) => msg("event-msg", m, "err"));
          if (ok) $("dlg-event").close();
        }));
      }));
    }
    $("dlg-event").showModal();
    $("e-titulo").focus();
  }
  $("e-fecha").addEventListener("input", () => {
    const v = $("e-fecha").value; if (!v) return;
    const r = nonWorking(parse(v), false);
    msg("event-msg", r && r !== "Sábado" && r !== "Domingo" ? "Atención: " + r.toLowerCase() + "." : r ? "Atención: es " + r.toLowerCase() + "." : "", r ? "err" : "");
  });
  $("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { titulo: $("e-titulo").value.trim(), tipo: $("e-tipo").value, casoId: $("e-caso").value, fecha: $("e-fecha").value, hora: $("e-hora").value, lugar: $("e-lugar").value.trim(), nota: $("e-nota").value.trim() };
    if (!data.titulo || !data.fecha) { msg("event-msg", "El título y la fecha son obligatorios.", "err"); return; }
    const ok = await act(() => editingEvent ? api("PUT", "/api/eventos/" + editingEvent, data) : api("POST", "/api/eventos", data), (m) => msg("event-msg", m, "err"));
    if (ok) {
      $("dlg-event").close();
      if (view === "calendario") { calSel = data.fecha; const d = parse(data.fecha); calMonth = new Date(d.getFullYear(), d.getMonth(), 1); render(); }
    }
  });

  /* ---------- Administración ---------- */
  document.querySelectorAll("#adm-tabs button").forEach((b) => b.addEventListener("click", () => { admTab = b.dataset.tab; renderAdmin(); }));
  async function renderAdmin() {
    document.querySelectorAll("#adm-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === admTab)));
    ["usuarios", "papelera", "auditoria"].forEach((t) => { $("adm-" + t).hidden = admTab !== t; });
    try {
      if (admTab === "usuarios") renderUsers(await api("GET", "/api/usuarios"));
      if (admTab === "papelera") renderTrash(await api("GET", "/api/papelera"));
      if (admTab === "auditoria") renderAudit(await api("GET", "/api/auditoria"));
    } catch (err) { $("adm-" + admTab).querySelector(".card").append(el("p", "msg err", err.message)); }
  }
  function renderUsers(users) {
    const box = $("u-list"); box.replaceChildren();
    const tbl = el("table"), hr = el("tr");
    ["Nombre", "Rol", "Expedientes", "Estado", ""].forEach((h) => hr.append(el("th", null, h)));
    const th = el("thead"); th.append(hr); tbl.append(th);
    const tb = el("tbody");
    users.forEach((u) => {
      const tr = el("tr");
      const n = el("td"); n.append(el("div", "strong", u.nombre), el("div", "small muted", u.email));
      const r = el("td"); r.append(el("span", "pill " + u.rol, ROLES_USUARIO[u.rol]));
      const count = u.rol === "admin" ? "Todos" : String(S.casos.filter((c) => (c.asignados || []).some((a) => a.id === u.id)).length);
      const s = el("td"); s.append(el("span", "pill " + (u.bloqueado ? "bloqueado" : u.activo ? "activo" : "archivado"), u.bloqueado ? "Bloqueado" : u.activo ? "Activo" : "Desactivado"));
      const a = el("td"); a.append(btn("ghost sm", "Editar", () => openUser(u)));
      tr.append(n, r, el("td", "small num", count), s, a);
      tb.append(tr);
    });
    tbl.append(tb); box.append(tbl);
  }
  $("u-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { nombre: $("u-nombre").value.trim(), email: $("u-email").value.trim(), rol: $("u-rol").value, password: $("u-pass").value };
    const ok = await act(() => api("POST", "/api/usuarios", data), (m) => msg("u-msg", m, "err"));
    if (ok) { ["u-nombre", "u-email", "u-pass"].forEach((id) => { $(id).value = ""; }); msg("u-msg", "Usuario creado. Compártele su correo y contraseña inicial.", "ok"); }
  });
  function openUser(u) {
    editingUser = u;
    $("user-dlg-title").textContent = "Editar a " + u.nombre;
    $("ue-nombre").value = u.nombre; $("ue-rol").value = u.rol; $("ue-activo").value = u.activo ? "1" : "0"; $("ue-pass").value = "";
    $("ue-desbloquear").checked = false; $("ue-desbloquear-box").hidden = !u.bloqueado;
    msg("user-msg", "");
    $("dlg-user").showModal();
  }
  $("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { nombre: $("ue-nombre").value.trim(), rol: $("ue-rol").value, activo: $("ue-activo").value === "1", password: $("ue-pass").value, desbloquear: $("ue-desbloquear").checked };
    const ok = await act(() => api("PUT", "/api/usuarios/" + editingUser.id, data), (m) => msg("user-msg", m, "err"));
    if (ok) $("dlg-user").close();
  });
  function renderTrash(items) {
    const box = $("p-list"); box.replaceChildren();
    if (!items.length) { box.append(emptyBox("La papelera está vacía", "Los documentos que se eliminen quedan aquí 30 días antes de borrarse del todo.")); return; }
    const ul = el("ul", "files");
    items.forEach((d) => {
      const li = el("li", "file");
      li.append(el("span", "chip", "v" + d.version));
      const n = el("div", "fname");
      const a = el("a", null, d.nombre); a.href = fileUrl(d.id); a.target = "_blank"; a.rel = "noopener";
      const left = 30 - daysBetween(new Date(d.borrado), new Date());
      n.append(a, el("span", "fsub", d.cliente + " · " + d.radicado), el("span", "fsub", "Eliminado " + fmtStamp(d.borrado) + (d.borradoPor ? " por " + d.borradoPor : "") + ". Se borra del todo en " + Math.max(left, 0) + " días."));
      const actions = el("div", "actions");
      actions.append(btn("ghost sm", "Restaurar", () => act(() => api("POST", "/api/papelera/" + d.id + "/restaurar"))));
      if (pendingDel === "purge:" + d.id) {
        actions.append(btn("ghost sm danger", "Sí, borrar para siempre", () => { pendingDel = null; act(() => api("DELETE", "/api/papelera/" + d.id)); }),
          btn("ghost sm", "Cancelar", () => { pendingDel = null; renderAdmin(); }));
      } else actions.append(btn("ghost sm danger", "Borrar definitivamente", () => { pendingDel = "purge:" + d.id; renderAdmin(); }));
      li.append(n, actions);
      ul.append(li);
    });
    box.append(ul);
  }
  const ACCIONES = { login: "Inició sesión", login_fallido: "Intento fallido", bloqueo: "Cuenta bloqueada", cambiar_clave: "Cambió su contraseña", crear: "Creó", editar: "Editó",
    eliminar: "Eliminó", asignar: "Asignó acceso", subir: "Subió", ver: "Abrió", descargar: "Descargó", papelera: "Envió a la papelera", restaurar: "Restauró", eliminar_definitivo: "Borró definitivamente" };
  const ENTIDADES = { usuario: "usuario", caso: "expediente", evento: "evento", actuacion: "actuación", documento: "documento" };
  function renderAudit(rows) {
    const box = $("au-list"); box.replaceChildren();
    if (!rows.length) { box.append(emptyBox("Sin movimientos", "Aquí aparecerá cada inicio de sesión, consulta y cambio.")); return; }
    const tbl = el("table"), hr = el("tr");
    ["Fecha", "Usuario", "Acción", "Detalle", "IP"].forEach((h) => hr.append(el("th", null, h)));
    const th = el("thead"); th.append(hr); tbl.append(th);
    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      const f = el("td", "small num", fmtStamp(r.fecha)); f.style.whiteSpace = "nowrap";
      tr.append(f, el("td", "small", r.usuario || "Sistema"),
        el("td", "small", (ACCIONES[r.accion] || r.accion) + " " + (ENTIDADES[r.entidad] || r.entidad) + (r.entidadId ? " #" + r.entidadId : "")),
        el("td", "small muted", r.detalle), el("td", "small muted mono", r.ip));
      tb.append(tr);
    });
    tbl.append(tb); box.append(tbl);
  }

  /* ---------- Boot ---------- */
  (async function boot() {
    try {
      const r = await api("GET", "/api/me");
      if (r.user) await enter(r.user); else showLogin();
    } catch (err) { showLogin(err.message); }
  })();
})();
