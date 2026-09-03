/* ═══════════════════════════════════════════════════════════════
   KERIGMA ADMIN — Painel e-commerce (v3)
   Sidebar + 14 telas: dashboard, produtos, categorias, pedidos,
   expedição, fretes, clientes, vendedoras, relatórios, avaliações,
   aparência, equipe, configurações, plano.
   ═══════════════════════════════════════════════════════════════ */

const SB_URL = window.SUPABASE_URL || '';
const SB_ANON_KEY = window.SUPABASE_KEY || '';
const AUTH_KEY = 'kerigma:sb-auth';
const THEME_KEY = 'kerigma:theme';

const session = { data: null };

let state = {
  products: [], categories: [], orders: [], customers: [], sellers: [],
  reviews: [], team: [], plans: [],
  editing: null, // {table, row, index}
  selected: new Set(),
  revFilter: 'all', orderStatusFilter: '', expStatusFilter: '',
  prodSearch: '', prodCatFilter: '', prodTypeFilter: '', prodNoStock: false,
};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const ROUTES = {
  dashboard:       ['Dashboard', 'Visão geral da sua loja digital'],
  produtos:        ['Produtos', 'Gerencie sua vitrine de e-books, cursos e materiais'],
  categorias:      ['Categorias', 'Organize seus produtos'],
  pedidos:         ['Pedidos', 'Acompanhe suas vendas'],
  expedicao:       ['Expedição', 'Fluxo de envio dos pedidos'],
  fretes:          ['Fretes', 'Transportadora, custo e rastreio'],
  clientes:        ['Clientes', 'Base de clientes'],
  vendedoras:      ['Vendedoras', 'Cadastro administrativo'],
  relatorios:      ['Relatórios', 'Análise de vendas por período'],
  avaliacoes:      ['Avaliações', 'Modere as avaliações dos clientes'],
  aparencia:       ['Aparência', 'Personalize o visual do painel'],
  equipe:          ['Equipe', 'Membros e permissões'],
  configuracoes:   ['Configurações do site', 'Dados gerais do site público'],
  plano:           ['Meu Plano', 'Gerencie sua assinatura'],
};

const ROOT = ['dashboard', 'produtos', 'categorias', 'pedidos', 'expedicao', 'fretes', 'clientes', 'vendedoras', 'relatorios', 'avaliacoes', 'aparencia', 'equipe', 'configuracoes', 'plano'];

const FAB_MAP = {
  produtos:    { act: 'newProduct',   icon: 'fa-plus',        title: 'Novo produto' },
  categorias:  { act: 'newCategory',  icon: 'fa-folder-plus', title: 'Nova categoria' },
  pedidos:     { act: 'newOrder',     icon: 'fa-plus',        title: 'Novo pedido' },
  fretes:      { act: 'newFrete',     icon: 'fa-truck',       title: 'Nova transportadora' },
  clientes:    { act: 'newClient',    icon: 'fa-user-plus',   title: 'Novo cliente' },
  vendedoras:  { act: 'newSeller',    icon: 'fa-user-plus',   title: 'Nova vendedora' },
  avaliacoes:  { act: null,           icon: 'fa-sync',        title: 'Atualizar' },
  equipe:      { act: 'newTeam',      icon: 'fa-user-plus',   title: 'Novo membro' },
};

/* ═══════════ HELPERS ═══════════ */
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmtMoney(v) {
  const n = Number(v);
  if (isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtNum(v) {
  const n = Number(v);
  return isNaN(n) ? '0' : n.toLocaleString('pt-BR');
}
function typeLabel(t) {
  return ({ ebook: 'E-book', curso: 'Curso', video: 'Vídeo', material: 'Material' })[t] || 'Produto';
}
function cap(s) {
  s = s || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch (_) { return '—'; }
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch (_) { return '—'; }
}
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }));
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ═══════════ SUPABASE REST ═══════════ */
function sbHeaders(token) {
  return { apikey: SB_ANON_KEY, Authorization: 'Bearer ' + (token || SB_ANON_KEY), 'Content-Type': 'application/json' };
}
async function sbFetch(path, opts) {
  const res = await fetch(SB_URL + path, opts);
  if (!res.ok) {
    let msg = 'Erro na requisição';
    try { const e = await res.json(); msg = e.message || e.msg || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res;
}
const authedHeaders = () => sbHeaders(session.data ? session.data.access_token : null);

function loginWithPassword(email, password) {
  return sbFetch('/auth/v1/token?grant_type=password', {
    method: 'POST', headers: sbHeaders(),
    body: JSON.stringify({ email, password })
  }).then(r => r.json());
}
function restoreWithRefreshToken(rt) {
  return sbFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: sbHeaders(),
    body: JSON.stringify({ refresh_token: rt })
  }).then(r => r.json());
}
function persistSession(data, email) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    email: email || (data.user && data.user.email) || '',
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || (Date.now() + (data.expires_in || 3600) * 1000)
  }));
  session.data = data;
}

async function sbInsert(table, row) {
  const res = await sbFetch('/rest/v1/' + table, {
    method: 'POST', headers: authedHeaders(), body: JSON.stringify(row)
  });
  if (res.status === 201 || res.status === 204) { try { return await res.json(); } catch (_) { return null; } }
  try { return await res.json(); } catch (_) { return null; }
}
async function sbUpdate(table, id, row) {
  await sbFetch('/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH', headers: authedHeaders(), body: JSON.stringify(row)
  });
}
async function sbDelete(table, id) {
  await sbFetch('/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE', headers: authedHeaders()
  });
}
async function sbUpsert(table, rows) {
  const res = await sbFetch('/rest/v1/' + table + '?on_conflict=id', {
    method: 'POST', headers: authedHeaders(), body: JSON.stringify(rows)
  });
  if (res.status === 201 || res.status === 204) { try { return await res.json(); } catch (_) { return null; } }
  try { return await res.json(); } catch (_) { return null; }
}

async function loadAll() {
  const h = authedHeaders();
  const open = sbHeaders(); // select público
  const select = { headers: session.data ? h : open };
  try { state.products = await (await sbFetch('/rest/v1/services?order=sort_order.asc', select)).json(); } catch (_) { state.products = []; }
  try { state.categories = await (await sbFetch('/rest/v1/categories?order=sort_order.asc', select)).json(); } catch (_) { state.categories = []; }
  if (session.data) {
    try {
      const [o, c, s, r, t, pl] = await Promise.all([
        sbFetch('/rest/v1/orders?order=created_at.desc', { headers: h }).then(x => x.json()),
        sbFetch('/rest/v1/customers?order=name.asc', { headers: h }).then(x => x.json()),
        sbFetch('/rest/v1/sellers?order=name.asc', { headers: h }).then(x => x.json()),
        sbFetch('/rest/v1/reviews?order=created_at.desc', { headers: h }).then(x => x.json()),
        sbFetch('/rest/v1/team_members?order=name.asc', { headers: h }).then(x => x.json()),
        sbFetch('/rest/v1/plans?order=created_at.desc', { headers: h }).then(x => x.json()),
      ]);
      state.orders = o; state.customers = c; state.sellers = s;
      state.reviews = r; state.team = t; state.plans = pl;
    } catch (_) {}
  } else {
    state.orders = []; state.customers = []; state.sellers = [];
    state.reviews = []; state.team = []; state.plans = [];
  }
}

/* ═══════════ TOAST ═══════════ */
function toast(message, type = 'success') {
  const container = $('#toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  el.innerHTML = '<i class="fas ' + (icons[type] || icons.success) + '"></i> ' + escapeHtml(message);
  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
}

/* ═══════════ ROTEAMENTO + SIDEBAR ═══════════ */
function currentRoute() {
  const h = location.hash.replace(/^#\//, '');
  return ROOT.includes(h) ? h : 'dashboard';
}
function goto(route) {
  if (!ROOT.includes(route)) route = 'dashboard';
  $$('.panel').forEach(p => p.classList.remove('active'));
  const panel = $('[data-panel="' + route + '"]');
  if (panel) panel.classList.add('active');
  $$('.sidebar-subitem').forEach(s => s.classList.toggle('active', s.dataset.route === route));
  $$('.sidebar-item.sub-trigger').forEach(t => {
    const sub = $('#sub-' + t.dataset.sub);
    const hasActive = sub && sub.querySelector('.active');
    t.closest('.sidebar-section').classList.toggle('open', !!hasActive);
  });
  if (location.hash !== '#/' + route) location.hash = '#/' + route;
  const meta = ROUTES[route] || ROUTES.dashboard;
  $('#pageTitle').textContent = meta[0];
  $('#pageCrumb').textContent = meta[1];
  closeDrawer();
  window.scrollTo(0, 0);
  syncBottomNav(route);
  updateFab(route);
  render(route);
}
function syncBottomNav(route) {
  const nav = $('#mAdminNav');
  if (!nav) return;
  nav.querySelectorAll('.mn-item[data-route]').forEach(b => {
    b.classList.toggle('mn-active', b.dataset.route === route);
  });
}
function updateFab(route) {
  const fab = $('#mFab');
  if (!fab) return;
  const cfg = FAB_MAP[route];
  if (!cfg) { fab.style.display = 'none'; return; }
  fab.style.display = 'flex';
  fab.setAttribute('data-action', cfg.act);
  const ic = $('#mFabIcon'); if (ic) ic.className = 'fas ' + (cfg.icon || 'fa-plus');
  fab.title = cfg.title || 'Nova';
}
function closeDrawer() {
  $('#sidebar').classList.remove('open');
  $('#mobileBackdrop').classList.remove('open');
}

/* ═══════════ TEMA ═══════════ */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon');
  if (icon) icon.className = 'fas ' + (theme === 'dark' ? 'fa-moon' : 'fa-sun');
  const sel = $('#appTheme');
  if (sel) sel.value = theme;
  const ac = $('#appAccent');
  if (ac) ac.value = localStorage.getItem('kerigma:accent') || '#c99a3e';
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/* ═══════════ MODAL GENÉRICO ═══════════ */
let modalDeleted = false;
function openModal(title, bodyHTML, footHTML) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHTML;
  $('#modalFoot').innerHTML = footHTML || '';
  $('#modalOverlay').classList.add('open');
  modalDeleted = false;
  $('#modalBox').scrollTop = 0;
}
function closeModal() {
  $('#modalOverlay').classList.remove('open');
  state.editing = null;
}
function mOn(sel, fn) {
  const el = $('#modalBody').querySelector(sel);
  if (el) el.addEventListener(fn ? 'click' : 'submit', fn ? fn : undefined);
}
function modalFootBtn(label, type, fn) {
  return '<button class="btn ' + type + '" id="mSubmit">' + label + '</button>';
}

/* ═══════════ CONEXÃO / LOGIN ═══════════ */
function updateConnectionUI(connected) {
  const row = $('#connRow');
  if (row) { row.classList.toggle('connected', connected); }
  const t = $('#connText'); if (t) t.textContent = connected ? 'Conectado' : 'Desconectado';
  const hc = $('#headerConnect'); if (hc) hc.style.display = connected ? 'none' : 'inline-flex';
  const hl = $('#headerLogout'); if (hl) hl.style.display = connected ? 'inline-flex' : 'none';
  $('#prodBulkDelete') && ($('#prodBulkDelete').disabled = !connected || state.selected.size === 0);
}
function openLogin() {
  $('#loginOverlay').classList.add('open');
  $('#modalPassInput').value = '';
  setTimeout(() => $('#modalPassInput').focus(), 60);
}
function closeLogin() { $('#loginOverlay').classList.remove('open'); }
function setModalStatus(type, msg) {
  const el = $('#modalStatus');
  el.style.display = 'flex';
  el.className = 'gh-status ' + type;
  el.innerHTML = msg;
}
async function handleLogin(email, password) {
  if (!email || !password) { toast('Informe email e senha.', 'error'); return false; }
  try {
    const data = await loginWithPassword(email, password);
    persistSession(data, email);
    await loadAll();
    render(currentRoute());
    updateConnectionUI(true);
    closeLogin();
    toast('Conectado!', 'success');
    return true;
  } catch (e) {
    return { error: e.message };
  }
}
function logout() {
  session.data = null;
  localStorage.removeItem(AUTH_KEY);
  state.orders = []; state.customers = []; state.sellers = [];
  state.reviews = []; state.team = []; state.plans = [];
  updateConnectionUI(false);
  closeLogin();
  render(currentRoute());
  toast('Desconectado.', 'info');
}

/* ═══════════ IMAGE ═══════════ */
function resizeImage(file, maxW = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const s = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function recentOrders() {
  const now = new Date();
  const opts = { today: 1, week: 7, month: 30, year: 365 };
  const d = opts[$('#dashPeriod') ? $('#dashPeriod').value : 'week'] || 7;
  const cutoff = new Date(now.getTime() - d * 86400000);
  return state.orders.filter(o => { const dt = new Date(o.created_at); return dt >= cutoff; });
}
function renderDashboard() {
  const row = recentOrders();
  const revenue = row.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const items = row.reduce((a, o) => a + (Number(o.items_count) || 0), 0);
  const pending = row.filter(o => o.status === 'novo' || o.status === 'pago').length;
  $('#kpiOrders').textContent = fmtNum(row.length);
  $('#kpiRevenue').textContent = fmtMoney(revenue);
  $('#kpiPending').textContent = fmtNum(pending);
  $('#kpiItems').textContent = fmtNum(items);
  const ticket = row.length ? revenue / row.length : 0;
  $('#kpiTicket').textContent = fmtMoney(ticket);
  $('#kpiActive').textContent = state.products.filter(p => p.available !== false).length;

  // mais/menos vendido
  let salesBy = {};
  state.orders.forEach(o => {
    if (o.items_count) return; // usa order_items quando houver
  });
  const countMap = {};
  (state.orders || []).forEach(o => { if (o.product_title) countMap[o.product_title] = (countMap[o.product_title] || 0) + 1; });
  const entries = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  $('#kpiTop').textContent = entries.length ? entries[0][0] : '—';
  $('#kpiBottom').textContent = entries.length ? entries[entries.length - 1][0] : '—';

  // chart 7 dias
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ date: d, key: d.toDateString(), label: d.toLocaleDateString('pt-BR', { weekday: 'short' }), total: 0 });
  }
  state.orders.forEach(o => {
    const d = new Date(o.created_at);
    const day = days.find(x => x.key === d.toDateString());
    if (day) day.total += Number(o.total) || 0;
  });
  const max = Math.max(1, ...days.map(d => d.total));
  $('#dashChart').innerHTML = days.map(d =>
    '<div class="bar-col"><div class="bar" style="height:' + Math.round((d.total / max) * 100) + '%"></div><div class="bar-label">' + d.label + '</div></div>'
  ).join('');

  // pedidos por status
  const byStatus = {};
  state.orders.forEach(o => { byStatus[o.status || 'novo'] = (byStatus[o.status || 'novo'] || 0) + 1; });
  $('#dashStatus').innerHTML = Object.entries(byStatus).length
    ? Object.entries(byStatus).map(([k, v]) =>
      '<div class="order-sum"><div class="row"><span>' + cap(k) + '</span><strong>' + v + '</strong></div></div>').join('')
    : '<p class="empty-state">Sem pedidos no período.</p>';
}

/* ═══════════════════════════════════════════════════════════════
   PRODUTOS
   ═══════════════════════════════════════════════════════════════ */
function filteredProducts() {
  let list = state.products;
  const q = state.prodSearch.trim().toLowerCase();
  if (q) list = list.filter(p => (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  if (state.prodCatFilter) list = list.filter(p => String(p.category || '') === state.prodCatFilter);
  if (state.prodTypeFilter) list = list.filter(p => String(p.product_type || '') === state.prodTypeFilter);
  if (state.prodNoStock) list = list.filter(p => (Number(p.stock) || 0) === 0);
  return list;
}
function renderProducts() {
  const list = filteredProducts();
  const tbody = $('#prodTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  $('#prodEmpty').style.display = list.length ? 'none' : 'block';
  $('#prodCheckAll').checked = list.length > 0 && list.every(p => state.selected.has(p.id));
  const catName = id => { const c = state.categories.find(x => String(x.id) === String(id)); return c ? c.name : (id || ''); };
  list.forEach(p => {
    const tr = document.createElement('tr');
    const available = p.available !== false;
    tr.innerHTML =
      '<td class="col-check no-label"><input type="checkbox" class="prod-check" data-id="' + p.id + '"' + (state.selected.has(p.id) ? ' checked' : '') + '></td>' +
      '<td class="no-label">' + (p.image ? '<img class="prod-thumb" src="' + p.image + '" alt="" loading="lazy">' : '<span class="prod-thumb"></span>') + '</td>' +
      '<td class="tr-title" data-label="Nome"><div class="prod-name">' + escapeHtml(p.title) + '</div><div class="prod-desc">' + escapeHtml(p.description || '') + '</div></td>' +
      '<td data-label="Categoria">' + escapeHtml(catName(p.category)) + '</td>' +
      '<td data-label="Tipo">' + typeLabel(p.product_type) + '</td>' +
      '<td data-label="Preço">' + fmtMoney(p.price) + '</td>' +
      '<td data-label="Estoque">' + (Number(p.stock) || 0) + '</td>' +
      '<td data-label="Disponível"><label class="toggle"><input type="checkbox" class="tgl avail" data-id="' + p.id + '"' + (available ? ' checked' : '') + '><span class="slider"></span></label></td>' +
      '<td data-label="Destaque"><label class="toggle gold"><input type="checkbox" class="tgl feat" data-id="' + p.id + '"' + (p.featured ? ' checked' : '') + '><span class="slider"></span></label></td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + p.id + '" title="Editar"><i class="fas fa-pen"></i></button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + p.id + '" title="Excluir"><i class="fas fa-trash-alt"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.prod-check').forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) state.selected.add(cb.dataset.id); else state.selected.delete(cb.dataset.id);
    updateConnectionUI(!!session.data);
  }));
  tbody.querySelectorAll('.tgl.avail').forEach(cb => cb.addEventListener('change', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbUpdate('services', cb.dataset.id, { available: cb.checked, updated_at: new Date().toISOString() }); toast(cb.checked ? 'Disponível.' : 'Indisponível.', 'info'); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  tbody.querySelectorAll('.tgl.feat').forEach(cb => cb.addEventListener('change', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbUpdate('services', cb.dataset.id, { featured: cb.checked, updated_at: new Date().toISOString() }); toast(cb.checked ? 'Em destaque.' : 'Destaque removido.', 'info'); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  tbody.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.id)));
  tbody.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.id)));
  $('#prodBulkDelete') && ($('#prodBulkDelete').disabled = !session.data || state.selected.size === 0);
}
function openProductModal(id) {
  if (!session.data) { openLogin(); return; }
  const p = state.products.find(x => String(x.id) === String(id));
  if (!p) return;
  state.editing = { table: 'services', row: p };
  const catOpts = state.categories.map(c => '<option value="' + c.id + '"' + (String(c.id) === String(p.category) ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('');
  openModal('Editar produto',
    '<input type="hidden" id="pId" value="' + p.id + '">' +
    '<label>Título<input type="text" id="pTitle" value="' + escapeHtml(p.title || '') + '" maxlength="120"></label>' +
    '<label>Descrição<textarea id="pDesc">' + escapeHtml(p.description || '') + '</textarea></label>' +
    '<div class="form-grid">' +
      '<label>Tipo<select id="pType">' + ['ebook', 'curso', 'video', 'material'].map(t => '<option value="' + t + '"' + (p.product_type === t ? ' selected' : '') + '>' + typeLabel(t) + '</option>').join('') + '</select></label>' +
      '<label>Categoria<select id="pCat"><option value="">Sem categoria</option>' + catOpts + '</select></label>' +
      '<label>Preço (R$)<input type="number" id="pPrice" step="0.01" min="0" value="' + (p.price != null ? p.price : '') + '"></label>' +
      '<label>Estoque<input type="number" id="pStock" step="1" value="' + (Number(p.stock) || 0) + '"></label>' +
      '<label>SKU<input type="text" id="pSku" value="' + escapeHtml(p.sku || '') + '"></label>' +
      '<label>Link de pagamento<input type="url" id="pLink" value="' + escapeHtml(p.payment_link || '') + '"></label>' +
    '</div>' +
    '<label>Imagem<input type="file" id="pImage" accept="image/*"></label>' +
    (p.image ? '<img src="' + p.image + '" id="pPreview" class="preview-img" style="display:block">' : '<img id="pPreview" class="preview-img">'),
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Salvar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', saveProduct);
  $('#mCancel').addEventListener('click', closeModal);
  $('#pImage').addEventListener('change', async e => {
    if (e.target.files[0]) { const url = await resizeImage(e.target.files[0]); $('#pPreview').src = url; $('#pPreview').style.display = 'block'; }
  });
}
async function saveProduct() {
  const id = $('#pId').value;
  const data = {
    title: $('#pTitle').value.trim(),
    description: $('#pDesc').value.trim(),
    product_type: $('#pType').value,
    category: $('#pCat').value || null,
    price: $('#pPrice').value !== '' ? Number($('#pPrice').value) : null,
    stock: $('#pStock').value !== '' ? Number($('#pStock').value) : 0,
    sku: $('#pSku').value.trim(),
    payment_link: $('#pLink').value.trim(),
    updated_at: new Date().toISOString()
  };
  const img = $('#pImage').files[0];
  if (img) { try { data.image = await resizeImage(img); } catch (_) { toast('Erro ao processar imagem.', 'error'); return; } }
  try { await sbUpdate('services', id, data); await loadAll(); closeModal(); toast('Produto atualizado!', 'success'); render(currentRoute()); }
  catch (e) { toast('Erro: ' + e.message, 'error'); }
}
async function deleteProduct(id) {
  if (!session.data) { openLogin(); return; }
  openModal('Excluir produto', '<p>Tem certeza que deseja excluir este produto?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm"><i class="fas fa-trash-alt"></i> Excluir</button>');
  $('#mCancel').addEventListener('click', closeModal);
  $('#mConfirm').addEventListener('click', async () => {
    try { await sbDelete('services', id); state.selected.delete(id); await loadAll(); closeModal(); toast('Produto excluído.', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
}
function newProduct() {
  if (!session.data) { openLogin(); return; }
  state.editing = { table: 'services', row: null };
  const catOpts = state.categories.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');
  openModal('Novo produto',
    '<label>Título<input type="text" id="pTitle" maxlength="120"></label>' +
    '<label>Descrição<textarea id="pDesc"></textarea></label>' +
    '<div class="form-grid">' +
      '<label>Tipo<select id="pType">' + ['ebook', 'curso', 'video', 'material'].map(t => '<option value="' + t + '">' + typeLabel(t) + '</option>').join('') + '</select></label>' +
      '<label>Categoria<select id="pCat"><option value="">Sem categoria</option>' + catOpts + '</select></label>' +
      '<label>Preço (R$)<input type="number" id="pPrice" step="0.01" min="0"></label>' +
      '<label>Estoque<input type="number" id="pStock" step="1" value="0"></label>' +
      '<label>SKU<input type="text" id="pSku"></label>' +
      '<label>Link de pagamento<input type="url" id="pLink"></label>' +
    '</div>' +
    '<label>Imagem (capa)<input type="file" id="pImage" accept="image/*"></label>' +
    '<img id="pPreview" class="preview-img">',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', createProduct);
  $('#mCancel').addEventListener('click', closeModal);
  $('#pImage').addEventListener('change', async e => {
    if (e.target.files[0]) { const url = await resizeImage(e.target.files[0]); $('#pPreview').src = url; $('#pPreview').style.display = 'block'; }
  });
}
async function createProduct() {
  const img = $('#pImage').files[0];
  if (!img) { toast('Selecione uma imagem de capa.', 'error'); return; }
  let image;
  try { image = await resizeImage(img); } catch (_) { toast('Erro ao processar imagem.', 'error'); return; }
  const data = {
    title: $('#pTitle').value.trim(),
    description: $('#pDesc').value.trim(),
    product_type: $('#pType').value,
    category: $('#pCat').value || null,
    price: $('#pPrice').value !== '' ? Number($('#pPrice').value) : null,
    stock: $('#pStock').value !== '' ? Number($('#pStock').value) : 0,
    sku: $('#pSku').value.trim(),
    payment_link: $('#pLink').value.trim(),
    image,
    sort_order: state.products.length,
    available: true, featured: false
  };
  try { await sbInsert('services', data); await loadAll(); closeModal(); toast('Produto criado!', 'success'); render(currentRoute()); }
  catch (e) { toast('Erro: ' + e.message, 'error'); }
}

/* ═══════════ CATEGORIAS ═══════════ */
function renderCategories() {
  const grid = $('#catGrid');
  if (!grid) return;
  grid.innerHTML = '';
  $('#catEmpty').style.display = state.categories.length ? 'none' : 'block';
  state.categories.forEach(c => {
    const count = state.products.filter(p => String(p.category || '') === String(c.id)).length;
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML =
      (c.image ? '<img class="cat-img" src="' + c.image + '" alt="">' : '<div class="cat-img"></div>') +
      '<div class="cat-body"><div class="cat-name">' + escapeHtml(c.name) + '</div>' +
      '<div class="cat-count">' + count + ' produto(s)</div>' +
      '<div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + c.id + '"><i class="fas fa-pen"></i></button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + c.id + '"><i class="fas fa-trash-alt"></i></button>' +
      '</div></div>';
    grid.appendChild(card);
  });
  grid.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openCategoryModal(b.dataset.id)));
  grid.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => deleteCategory(b.dataset.id)));
}
function openCategoryModal(id) {
  if (!session.data) { openLogin(); return; }
  const c = state.categories.find(x => String(x.id) === String(id));
  openModal(c ? 'Editar categoria' : 'Nova categoria',
    '<input type="hidden" id="cId" value="' + (c ? c.id : '') + '">' +
    '<label>Nome<input type="text" id="cName" value="' + (c ? escapeHtml(c.name) : '') + '" maxlength="60"></label>' +
    '<label>Slug (opcional)<input type="text" id="cSlug" value="' + (c ? escapeHtml(c.slug || '') : '') + '" maxlength="60"></label>' +
    '<label>Descrição<textarea id="cDesc">' + (c ? escapeHtml(c.description || '') : '') + '</textarea></label>' +
    '<label>Imagem<input type="file" id="cImage" accept="image/*"></label>' +
    (c && c.image ? '<img src="' + c.image + '" class="preview-img" style="display:block">' : '<img class="preview-img" id="cPrev">'),
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn(c ? 'Salvar' : 'Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = { name: $('#cName').value.trim(), slug: $('#cSlug').value.trim() || null, description: $('#cDesc').value.trim() };
    const img = $('#cImage').files[0];
    if (img) { try { data.image = await resizeImage(img, 800); } catch (_) {} }
    try {
      if (c) { await sbUpdate('categories', c.id, data); }
      else { data.sort_order = state.categories.length; await sbInsert('categories', data); }
      await loadAll(); closeModal(); toast(c ? 'Categoria atualizada!' : 'Categoria criada!', 'success'); render(currentRoute());
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}
async function deleteCategory(id) {
  if (!session.data) { openLogin(); return; }
  openModal('Excluir categoria', '<p>Excluir esta categoria?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Excluir</button>');
  $('#mCancel').addEventListener('click', closeModal);
  $('#mConfirm').addEventListener('click', async () => {
    try { await sbDelete('categories', id); await loadAll(); closeModal(); toast('Categoria excluída.', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
}

/* ═══════════ CLIENTES ═══════════ */
function renderCustomers() {
  const tbody = $('#custTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  $('#custEmpty').style.display = state.customers.length ? 'none' : 'block';
  state.customers.forEach(c => {
    const orders = state.orders.filter(o => String(o.customer_id) === String(c.id));
    const total = orders.reduce((a, o) => a + (Number(o.total) || 0), 0);
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Nome"><div class="prod-name">' + escapeHtml(c.name) + '</div></td>' +
      '<td data-label="WhatsApp">' + escapeHtml(c.whatsapp || '—') + '</td>' +
      '<td data-label="Email">' + escapeHtml(c.email || '—') + '</td>' +
      '<td data-label="Cidade">' + escapeHtml(c.city || '—') + '</td>' +
      '<td data-label="Pedidos">' + orders.length + '</td>' +
      '<td data-label="Total">' + fmtMoney(total) + '</td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + c.id + '"><i class="fas fa-pen"></i></button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + c.id + '"><i class="fas fa-trash-alt"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openCustomerModal(b.dataset.id)));
  tbody.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => deleteCustomer(b.dataset.id)));
}
function openCustomerModal(id) {
  if (!session.data) { openLogin(); return; }
  const c = state.customers.find(x => String(x.id) === String(id));
  openModal(c ? 'Editar cliente' : 'Novo cliente',
    '<input type="hidden" id="cId" value="' + (c ? c.id : '') + '">' +
    '<label>Nome<input type="text" id="cName" value="' + (c ? escapeHtml(c.name) : '') + '" maxlength="100"></label>' +
    '<div class="form-grid">' +
      '<label>WhatsApp<input type="text" id="cWpp" value="' + (c ? escapeHtml(c.whatsapp || '') : '') + '" maxlength="20"></label>' +
      '<label>Email<input type="email" id="cEmail" value="' + (c ? escapeHtml(c.email || '') : '') + '" maxlength="120"></label>' +
      '<label>CPF<input type="text" id="cCpf" value="' + (c ? escapeHtml(c.cpf || '') : '') + '" maxlength="14"></label>' +
      '<label>Cidade<input type="text" id="cCity" value="' + (c ? escapeHtml(c.city || '') : '') + '" maxlength="80"></label>' +
    '</div>' +
    '<label>Endereço<input type="text" id="cAddr" value="' + (c ? escapeHtml(c.address || '') : '') + '" maxlength="180"></label>' +
    '<label>Observações<textarea id="cNotes">' + (c ? escapeHtml(c.notes || '') : '') + '</textarea></label>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn(c ? 'Salvar' : 'Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = { name: $('#cName').value.trim(), whatsapp: $('#cWpp').value.trim(), email: $('#cEmail').value.trim(), cpf: $('#cCpf').value.trim(), city: $('#cCity').value.trim(), address: $('#cAddr').value.trim(), notes: $('#cNotes').value.trim() };
    try {
      if (c) { await sbUpdate('customers', c.id, data); }
      else { await sbInsert('customers', data); }
      await loadAll(); closeModal(); toast(c ? 'Cliente atualizado!' : 'Cliente criado!', 'success'); render(currentRoute());
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}
async function deleteCustomer(id) {
  if (!session.data) { openLogin(); return; }
  openModal('Excluir cliente', '<p>Excluir este cliente?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Excluir</button>');
  $('#mCancel').addEventListener('click', closeModal);
  $('#mConfirm').addEventListener('click', async () => {
    try { await sbDelete('customers', id); await loadAll(); closeModal(); toast('Cliente excluído.', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
}

/* ═══════════ VENDEDORAS ═══════════ */
function renderSellers() {
  const tbody = $('#sellerTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  $('#sellerEmpty').style.display = state.sellers.length ? 'none' : 'block';
  state.sellers.forEach(s => {
    const orders = state.orders.filter(o => String(o.seller_id) === String(s.id));
    const total = orders.reduce((a, o) => a + (Number(o.total) || 0), 0);
    const comm = total * (Number(s.commission_percent) || 0) / 100;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Nome"><div class="prod-name">' + escapeHtml(s.name) + '</div></td>' +
      '<td data-label="WhatsApp">' + escapeHtml(s.whatsapp || '—') + '</td>' +
      '<td data-label="Comissão">' + (s.commission_percent != null ? Number(s.commission_percent) + '%' : '—') + '</td>' +
      '<td data-label="Ativa"><label class="toggle"><input type="checkbox" class="s-act" data-id="' + s.id + '"' + (s.active !== false ? ' checked' : '') + '><span class="slider"></span></label></td>' +
      '<td data-label="Vendas">' + orders.length + '</td>' +
      '<td data-label="Comissão estimada">' + fmtMoney(comm) + '</td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn" data-act="edit" data-id="' + s.id + '"><i class="fas fa-pen"></i></button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + s.id + '"><i class="fas fa-trash-alt"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.s-act').forEach(cb => cb.addEventListener('change', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbUpdate('sellers', cb.dataset.id, { active: cb.checked }); toast('Atualizado.', 'info'); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  tbody.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openSellerModal(b.dataset.id)));
  tbody.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => deleteSeller(b.dataset.id)));
}
function openSellerModal(id) {
  if (!session.data) { openLogin(); return; }
  const s = state.sellers.find(x => String(x.id) === String(id));
  openModal(s ? 'Editar vendedora' : 'Nova vendedora',
    '<input type="hidden" id="sId" value="' + (s ? s.id : '') + '">' +
    '<label>Nome<input type="text" id="sName" value="' + (s ? escapeHtml(s.name) : '') + '" maxlength="100"></label>' +
    '<div class="form-grid">' +
      '<label>WhatsApp<input type="text" id="sWpp" value="' + (s ? escapeHtml(s.whatsapp || '') : '') + '" maxlength="20"></label>' +
      '<label>Email<input type="email" id="sEmail" value="' + (s ? escapeHtml(s.email || '') : '') + '" maxlength="120"></label>' +
    '</div>' +
    '<label>Comissão (%)<input type="number" id="sComm" step="0.1" min="0" max="100" value="' + (s ? s.commission_percent : '') + '"></label>' +
    '<label>Observações<textarea id="sNotes">' + (s ? escapeHtml(s.notes || '') : '') + '</textarea></label>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn(s ? 'Salvar' : 'Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = { name: $('#sName').value.trim(), whatsapp: $('#sWpp').value.trim(), email: $('#sEmail').value.trim(), commission_percent: $('#sComm').value !== '' ? Number($('#sComm').value) : null, notes: $('#sNotes').value.trim() };
    try {
      if (s) { await sbUpdate('sellers', s.id, data); }
      else { data.active = true; await sbInsert('sellers', data); }
      await loadAll(); closeModal(); toast(s ? 'Vendedora atualizada!' : 'Vendedora criada!', 'success'); render(currentRoute());
    } catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}
async function deleteSeller(id) {
  if (!session.data) { openLogin(); return; }
  openModal('Excluir vendedora', '<p>Excluir esta vendedora?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Excluir</button>');
  $('#mCancel').addEventListener('click', closeModal);
  $('#mConfirm').addEventListener('click', async () => {
    try { await sbDelete('sellers', id); await loadAll(); closeModal(); toast('Vendedora excluída.', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
}

/* ═══════════ EQUIPE ═══════════ */
function renderTeam() {
  const tbody = $('#teamTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  $('#teamEmpty').style.display = state.team.length ? 'none' : 'block';
  state.team.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Nome"><div class="prod-name">' + escapeHtml(m.name) + '</div></td>' +
      '<td data-label="Email">' + escapeHtml(m.email || '—') + '</td>' +
      '<td data-label="Papel">' + escapeHtml(cap(m.role || 'membro')) + '</td>' +
      '<td data-label="Ativo"><label class="toggle"><input type="checkbox" class="t-act" data-id="' + m.id + '"' + (m.active !== false ? ' checked' : '') + '><span class="slider"></span></label></td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn danger" data-act="del" data-id="' + m.id + '"><i class="fas fa-trash-alt"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.t-act').forEach(cb => cb.addEventListener('change', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbUpdate('team_members', cb.dataset.id, { active: cb.checked }); toast('Atualizado.', 'info'); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  tbody.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => {
    openModal('Remover membro', '<p>Remover este membro da equipe?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Remover</button>');
    $('#mCancel').addEventListener('click', closeModal);
    $('#mConfirm').addEventListener('click', async () => {
      try { await sbDelete('team_members', b.dataset.id); await loadAll(); closeModal(); toast('Membro removido.', 'success'); render(currentRoute()); }
      catch (e) { toast('Erro: ' + e.message, 'error'); }
    });
  }));
}
function openTeamModal() {
  if (!session.data) { openLogin(); return; }
  openModal('Novo membro',
    '<label>Nome<input type="text" id="tName" maxlength="100"></label>' +
    '<label>Email<input type="email" id="tEmail" maxlength="120"></label>' +
    '<label>Papel<select id="tRole"><option value="admin">Administrador</option><option value="editor">Editor</option><option value="viewer">Somente leitura</option></select></label>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = { name: $('#tName').value.trim(), email: $('#tEmail').value.trim(), role: $('#tRole').value, active: true };
    try { await sbInsert('team_members', data); await loadAll(); closeModal(); toast('Membro adicionado!', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}

/* ═══════════ PEDIDOS ═══════════ */
function filteredOrders() {
  let list = state.orders;
  if (state.orderStatusFilter) list = list.filter(o => o.status === state.orderStatusFilter);
  return list;
}
function statusBadge(s) {
  s = s || 'novo';
  return '<span class="badge ' + s + '">' + cap(s) + '</span>';
}
function orderCustomer(row) {
  const c = state.customers.find(x => String(x.id) === String(row.customer_id));
  return c ? c.name : (row.customer_name || 'Cliente');
}
function orderSeller(row) {
  const s = state.sellers.find(x => String(x.id) === String(row.seller_id));
  return s ? s.name : '—';
}
function renderOrders() {
  const tbody = $('#orderTbody');
  if (!tbody) return;
  const list = filteredOrders();
  tbody.innerHTML = '';
  $('#orderEmpty').style.display = list.length ? 'none' : 'block';
  list.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Código"><strong>' + escapeHtml(o.code || '#') + '</strong></td>' +
      '<td data-label="Cliente">' + escapeHtml(orderCustomer(o)) + '</td>' +
      '<td data-label="Vendedora">' + escapeHtml(orderSeller(o)) + '</td>' +
      '<td data-label="Total">' + fmtMoney(o.total) + '</td>' +
      '<td data-label="Pagamento">' + escapeHtml(o.payment_method || '—') + '</td>' +
      '<td data-label="Status">' + statusBadge(o.status) + '</td>' +
      '<td data-label="Data">' + fmtDate(o.created_at) + '</td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn" data-act="view" data-id="' + o.id + '" title="Ver"><i class="fas fa-eye"></i></button>' +
        '<button class="icon-btn" data-act="edit" data-id="' + o.id + '" title="Editar"><i class="fas fa-pen"></i></button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + o.id + '" title="Excluir"><i class="fas fa-trash-alt"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-act="view"]').forEach(b => b.addEventListener('click', () => viewOrder(b.dataset.id)));
  tbody.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener('click', () => openOrderModal(b.dataset.id)));
  tbody.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', () => {
    openModal('Excluir pedido', '<p>Excluir este pedido?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Excluir</button>');
    $('#mCancel').addEventListener('click', closeModal);
    $('#mConfirm').addEventListener('click', async () => {
      try { await sbDelete('orders', b.dataset.id); await loadAll(); closeModal(); toast('Pedido excluído.', 'success'); render(currentRoute()); }
      catch (e) { toast('Erro: ' + e.message, 'error'); }
    });
  }));
}
function viewOrder(id) {
  if (!session.data) { openLogin(); return; }
  const o = state.orders.find(x => String(x.id) === String(id));
  if (!o) return;
  const items = (o.items_count || '').length ? '' : '';
  openModal('Pedido ' + (o.code || '#'),
    '<div class="order-sum">' +
      '<div class="row"><span>Cliente</span><strong>' + escapeHtml(orderCustomer(o)) + '</strong></div>' +
      '<div class="row"><span>Vendedora</span><strong>' + escapeHtml(orderSeller(o)) + '</strong></div>' +
      '<div class="row"><span>Status</span><strong>' + statusBadge(o.status) + '</strong></div>' +
      '<div class="row"><span>Pagamento</span><strong>' + escapeHtml(o.payment_method || '—') + ' (' + escapeHtml(o.payment_status || '—') + ')</strong></div>' +
      '<div class="row"><span>Subt.</span><strong>' + fmtMoney(o.subtotal) + '</strong></div>' +
      '<div class="row"><span>Desconto</span><strong>' + fmtMoney(o.discount) + '</strong></div>' +
      '<div class="row"><span>Frete</span><strong>' + fmtMoney(o.shipping_cost) + ' (' + escapeHtml(o.shipping_method || '—') + ')</strong></div>' +
      '<div class="row"><span>Total</span><strong>' + fmtMoney(o.total) + '</strong></div>' +
      '<div class="row"><span>Rastreio</span><strong>' + escapeHtml(o.tracking_code || '—') + '</strong></div>' +
      '<div class="row"><span>Data</span><strong>' + fmtDateTime(o.created_at) + '</strong></div>' +
    '</div>',
    '<button class="btn btn-primary" id="mClose">Fechar</button>'
  );
  $('#mClose').addEventListener('click', closeModal);
}
function openOrderModal(id) {
  if (!session.data) { openLogin(); return; }
  const o = state.orders.find(x => String(x.id) === String(id));
  if (!o) return;
  const custOpts = state.customers.map(c => '<option value="' + c.id + '"' + (String(c.id) === String(o.customer_id) ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>').join('');
  const selOpts = state.sellers.map(s => '<option value="' + s.id + '"' + (String(s.id) === String(o.seller_id) ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>').join('');
  openModal('Editar pedido',
    '<input type="hidden" id="oId" value="' + o.id + '">' +
    '<label>Código<input type="text" id="oCode" value="' + escapeHtml(o.code || '') + '"></label>' +
    '<div class="form-grid">' +
      '<label>Cliente<select id="oCustomer"><option value="">—</option>' + custOpts + '</select></label>' +
      '<label>Vendedora<select id="oSeller"><option value="">—</option>' + selOpts + '</select></label>' +
      '<label>Status<select id="oStatus">' + ['novo', 'pago', 'expedido', 'entregue', 'cancelado'].map(s => '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + cap(s) + '</option>').join('') + '</select></label>' +
      '<label>Pagamento<select id="oPay">' + ['pix', 'cartao', 'boleto', 'dinheiro'].map(p => '<option value="' + p + '"' + (o.payment_method === p ? ' selected' : '') + '>' + cap(p) + '</option>').join('') + '</select></label>' +
      '<label>Total (R$)<input type="number" id="oTotal" step="0.01" min="0" value="' + (o.total != null ? o.total : '') + '"></label>' +
      '<label>Frete (R$)<input type="number" id="oShipping" step="0.01" min="0" value="' + (o.shipping_cost != null ? o.shipping_cost : '') + '"></label>' +
    '</div>' +
    '<label>Observações<textarea id="oNotes">' + escapeHtml(o.notes || '') + '</textarea></label>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Salvar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = {
      code: $('#oCode').value.trim(), customer_id: $('#oCustomer').value || null, seller_id: $('#oSeller').value || null,
      status: $('#oStatus').value, payment_method: $('#oPay').value,
      total: $('#oTotal').value !== '' ? Number($('#oTotal').value) : null,
      shipping_cost: $('#oShipping').value !== '' ? Number($('#oShipping').value) : null,
      notes: $('#oNotes').value.trim(), updated_at: new Date().toISOString()
    };
    try { await sbUpdate('orders', o.id, data); await loadAll(); closeModal(); toast('Pedido atualizado!', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}
function newOrder() {
  if (!session.data) { openLogin(); return; }
  const custOpts = state.customers.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');
  const selOpts = state.sellers.map(s => '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>').join('');
  openModal('Novo pedido',
    '<label>Código<input type="text" id="oCode" placeholder="ex.: K-0001"></label>' +
    '<div class="form-grid">' +
      '<label>Cliente<select id="oCustomer"><option value="">Sem cliente</option>' + custOpts + '</select></label>' +
      '<label>Vendedora<select id="oSeller"><option value="">Sem vendedora</option>' + selOpts + '</select></label>' +
      '<label>Status<select id="oStatus">' + ['novo', 'pago', 'expedido', 'entregue', 'cancelado'].map(s => '<option value="' + s + '">' + cap(s) + '</option>').join('') + '</select></label>' +
      '<label>Pagamento<select id="oPay">' + ['pix', 'cartao', 'boleto', 'dinheiro'].map(p => '<option value="' + p + '">' + cap(p) + '</option>').join('') + '</select></label>' +
      '<label>Total (R$)<input type="number" id="oTotal" step="0.01" min="0"></label>' +
      '<label>Frete (R$)<input type="number" id="oShipping" step="0.01" min="0" value="0"></label>' +
    '</div>' +
    '<label>Observações<textarea id="oNotes"></textarea></label>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Criar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const data = {
      code: $('#oCode').value.trim() || 'K-' + String(state.orders.length + 1).padStart(4, '0'),
      customer_id: $('#oCustomer').value || null, seller_id: $('#oSeller').value || null, status: $('#oStatus').value, payment_method: $('#oPay').value, payment_status: 'pendente', expedit_status: 'a_expedir', frete_status: 'pendente', total: $('#oTotal').value !== '' ? Number($('#oTotal').value) : 0, shipping_cost: $('#oShipping').value !== '' ? Number($('#oShipping').value) : 0, notes: $('#oNotes').value.trim()
    };
    try { await sbInsert('orders', data); await loadAll(); closeModal(); toast('Pedido criado!', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  });
  $('#mCancel').addEventListener('click', closeModal);
}

/* ═══════════ EXPEDIÇÃO ═══════════ */
function renderExpedicao() {
  const tbody = $('#expTbody');
  if (!tbody) return;
  let list = state.orders;
  if (state.expStatusFilter) list = list.filter(o => o.expedit_status === state.expStatusFilter);
  tbody.innerHTML = '';
  $('#expEmpty').style.display = list.length ? 'none' : 'block';
  list.forEach(o => {
    const st = o.expedit_status || 'a_expedir';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Código"><strong>' + escapeHtml(o.code || '#') + '</strong></td>' +
      '<td data-label="Cliente">' + escapeHtml(orderCustomer(o)) + '</td>' +
      '<td data-label="Status"><span class="badge ' + st + '">' + cap(st) + '</span></td>' +
      '<td data-label="Rastreio">' + escapeHtml(o.tracking_code || '—') + '</td>' +
      '<td class="no-label"><div class="row-actions">' +
        '<button class="icon-btn" data-act="next" data-id="' + o.id + '" title="Avançar status"><i class="fas fa-arrow-right"></i></button>' +
        '<button class="icon-btn" data-act="rastreio" data-id="' + o.id + '" title="Adicionar rastreio"><i class="fas fa-truck"></i></button>' +
      '</div></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-act="next"]').forEach(b => b.addEventListener('click', async () => {
    if (!session.data) { openLogin(); return; }
    const o = state.orders.find(x => String(x.id) === b.dataset.id);
    const order = ['a_expedir', 'preparando', 'enviado', 'entregue'];
    const idx = order.indexOf(o.expedit_status);
    const next = order[(idx + 1) % order.length];
    try { await sbUpdate('orders', o.id, { expedit_status: next, updated_at: new Date().toISOString() }); await loadAll(); toast('Status: ' + cap(next) + '.', 'info'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  tbody.querySelectorAll('[data-act="rastreio"]').forEach(b => b.addEventListener('click', () => {
    if (!session.data) { openLogin(); return; }
    const o = state.orders.find(x => String(x.id) === b.dataset.id);
    openModal('Rastreio', '<label>Pedido <strong>' + escapeHtml(o.code || '#') + '</strong></label><label>Código de rastreio<input type="text" id="rCode" value="' + escapeHtml(o.tracking_code || '') + '"></label>', '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Salvar', 'btn-primary', true));
    $('#mSubmit').addEventListener('click', async () => {
      try { await sbUpdate('orders', o.id, { tracking_code: $('#rCode').value.trim(), updated_at: new Date().toISOString() }); await loadAll(); closeModal(); toast('Rastreio salvo.', 'success'); render(currentRoute()); }
      catch (e) { toast('Erro: ' + e.message, 'error'); }
    });
    $('#mCancel').addEventListener('click', closeModal);
  }));
}

/* ═══════════ FRETES ═══════════ */
function renderFretes() {
  const tbody = $('#freteTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  $('#freteEmpty').style.display = state.orders.length ? 'none' : 'block';
  state.orders.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="tr-title" data-label="Código"><strong>' + escapeHtml(o.code || '#') + '</strong></td>' +
      '<td data-label="Cliente">' + escapeHtml(orderCustomer(o)) + '</td>' +
      '<td data-label="Método">' + escapeHtml(o.shipping_method || '—') + '</td>' +
      '<td data-label="Custo">' + fmtMoney(o.shipping_cost) + '</td>' +
      '<td data-label="Rastreio">' + escapeHtml(o.tracking_code || '—') + '</td>' +
      '<td data-label="Status"><span class="badge ' + (o.frete_status || 'pendente') + '">' + cap(o.frete_status || 'pendente') + '</span></td>';
    tbody.appendChild(tr);
  });
}

/* ═══════════ RELATÓRIOS ═══════════ */
function renderRelatorios() {
  const from = $('#repFrom').value ? new Date($('#repFrom').value + 'T00:00:00') : null;
  const to = $('#repTo').value ? new Date($('#repTo').value + 'T23:59:59') : null;
  let list = state.orders;
  if (from) list = list.filter(o => new Date(o.created_at) >= from);
  if (to) list = list.filter(o => new Date(o.created_at) <= to);
  const revenue = list.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const ticket = list.length ? revenue / list.length : 0;
  const items = list.reduce((a, o) => a + (Number(o.items_count) || 0), 0);
  $('#repRevenue').textContent = fmtMoney(revenue);
  $('#repOrders').textContent = fmtNum(list.length);
  $('#repTicket').textContent = fmtMoney(ticket);
  $('#repItems').textContent = fmtNum(items);

  const prodCount = {};
  list.forEach(o => { if (o.product_title) prodCount[o.product_title] = (prodCount[o.product_title] || 0) + 1; });
  const topProd = Object.entries(prodCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('#repTopProducts').innerHTML = topProd.length
    ? topProd.map(([n, c]) => '<div class="order-sum"><div class="row"><span>' + escapeHtml(n) + '</span><strong>' + c + '</strong></div></div>').join('')
    : '<p class="empty-state">Sem dados.</p>';

  const sellerCount = {};
  list.forEach(o => { if (o.seller_id) { const s = state.sellers.find(x => String(x.id) === String(o.seller_id)); const name = s ? s.name : '?'; sellerCount[name] = (sellerCount[name] || 0) + 1; } });
  const topSell = Object.entries(sellerCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('#repTopSellers').innerHTML = topSell.length
    ? topSell.map(([n, c]) => '<div class="order-sum"><div class="row"><span>' + escapeHtml(n) + '</span><strong>' + c + '</strong></div></div>').join('')
    : '<p class="empty-state">Sem dados.</p>';
}

/* ═══════════ AVALIAÇÕES ═══════════ */
function stars(r) {
  r = Number(r) || 0;
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= Math.round(r) ? '★' : '☆';
  return s;
}
function renderReviews() {
  const box = $('#revList');
  if (!box) return;
  let list = state.reviews;
  if (state.revFilter === 'pending') list = list.filter(r => r.approved !== true);
  if (state.revFilter === 'approved') list = list.filter(r => r.approved === true);
  box.innerHTML = '';
  $('#revEmpty').style.display = list.length ? 'none' : 'block';
  list.forEach(r => {
    const p = state.products.find(x => String(x.id) === String(r.product_id));
    const item = document.createElement('div');
    item.className = 'rev-item';
    item.innerHTML =
      '<div style="flex:1">' +
        '<div class="rev-stars">' + stars(r.rating) + '</div>' +
        '<div style="font-weight:700">' + escapeHtml(r.customer_name || 'Cliente') + '</div>' +
        '<div class="rev-meta">' + escapeHtml(p ? p.title : 'Produto') + ' · ' + fmtDate(r.created_at) + '</div>' +
        '<p style="margin-top:6px">' + escapeHtml(r.comment || '') + '</p>' +
      '</div>' +
      '<div class="row-actions">' +
        '<button class="icon-btn gold" data-act="toggle" data-id="' + r.id + '" data-ok="' + (r.approved === true ? '1' : '0') + '" title="' + (r.approved === true ? 'Reprovar' : 'Aprovar') + '">' + (r.approved === true ? '<i class="fas fa-times"></i>' : '<i class="fas fa-check"></i>') + '</button>' +
        '<button class="icon-btn danger" data-act="del" data-id="' + r.id + '"><i class="fas fa-trash-alt"></i></button>' +
      '</div>';
    box.appendChild(item);
  });
  box.querySelectorAll('[data-act="toggle"]').forEach(b => b.addEventListener('click', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbUpdate('reviews', b.dataset.id, { approved: b.dataset.ok === '0' }); await loadAll(); toast('Atualizado.', 'info'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
  box.querySelectorAll('[data-act="del"]').forEach(b => b.addEventListener('click', async () => {
    if (!session.data) { openLogin(); return; }
    try { await sbDelete('reviews', b.dataset.id); await loadAll(); toast('Avaliação excluída.', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
}

/* ═══════════ PLANO ═══════════ */
function renderPlano() {
  const card = $('#planCard');
  if (!card) return;
  const current = state.plans.find(p => p.status === 'active') || state.plans[0];
  if (current) {
    const feats = (Array.isArray(current.features) ? current.features : []).map(f => '<li>' + escapeHtml(f) + '</li>').join('');
    card.innerHTML = '<div class="plan-card current">' +
      '<div class="p-name">' + escapeHtml(current.plan_name || 'Plano atual') + '</div>' +
      '<div class="p-price">' + fmtMoney(current.price) + '<span style="font-size:0.8rem;color:var(--muted)">/' + escapeHtml(current.period || 'mês') + '</span></div>' +
      '<ul class="p-features">' + feats + '</ul>' +
      '<div class="rev-meta">Renova em ' + fmtDate(current.next_billing) + '</div>' +
      '</div>';
  } else {
    card.innerHTML = '<div class="plan-card current"><div class="p-name">Sem plano ativo</div><p style="color:var(--muted);font-size:0.82rem">Assine abaixo para continuar usando a plataforma.</p></div>';
  }
  const plans = [
    { name: 'Mensal', price: 39.90, period: 'mês', features: ['Tudo incluso', 'Produtos ilimitados', 'Suporte'] },
    { name: 'Trimestral', price: 99.90, period: '3 meses', features: ['Tudo incluso', 'Produtos ilimitados', 'Suporte prioritário'], current: true },
    { name: 'Anual', price: 299.90, period: 'ano', features: ['Tudo incluso', 'Produtos ilimitados', 'Suporte VIP'] },
  ];
  $('#planGrid').innerHTML = plans.map(p =>
    '<div class="plan-card' + (p.current ? ' current' : '') + '">' +
      '<div class="p-name">' + p.name + '</div>' +
      '<div class="p-price">' + fmtMoney(p.price) + '<span style="font-size:0.8rem;color:var(--muted)">/' + p.period + '</span></div>' +
      '<ul class="p-features">' + p.features.map(f => '<li>' + f + '</li>').join('') + '</ul>' +
      (p.current ? '<button class="btn btn-outline btn-sm" disabled>Plano atual</button>' : '<button class="btn btn-primary btn-sm but-plan" data-price="' + p.price + '" data-name="' + p.name + '">Assinar' + (current ? '' : '') + '</button>') +
    '</div>').join('');
  document.querySelectorAll('.but-plan').forEach(b => b.addEventListener('click', async () => {
    if (!session.data) { openLogin(); return; }
    const data = { plan_name: b.dataset.name, period: 'mês', price: Number(b.dataset.price), status: 'active', user_id: session.data.user && session.data.user.id, features: ['Tudo incluso'], next_billing: new Date(Date.now() + 30 * 86400000).toISOString() };
    try { await sbInsert('plans', data); await loadAll(); toast('Plano assinado!', 'success'); render(currentRoute()); }
    catch (e) { toast('Erro: ' + e.message, 'error'); }
  }));
}

/* ═══════════ IMPORT CSV ═══════════ */
function importCSV() {
  if (!session.data) { openLogin(); return; }
  openModal('Importar produtos (CSV)',
    '<p style="font-size:0.85rem;color:var(--muted)">Formato: <code>título,preço,tipo_estoque,categoria</code>.<br>Preço com ponto decimal. Tipos: ebook, curso, video, material.</p>' +
    '<textarea id="csvArea" placeholder="E-book Básico,29.90,50,ebook&#10;Curso Completo,149.90,10,curso"></textarea>',
    '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Importar', 'btn-primary', true)
  );
  $('#mSubmit').addEventListener('click', async () => {
    const text = $('#csvArea').value;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = lines.map(l => {
      const [title, price, stock, type] = l.split(',').map(x => x.trim());
      return { title, price: price !== '' ? Number(price) : null, stock: stock != null && stock !== '' ? Number(stock) : 0, product_type: type || 'ebook', available: true, featured: false, sort_order: state.products.length };
    }).filter(r => r.title);
    if (!rows.length) { toast('Nada para importar.', 'warning'); return; }
    openModal('Confirmar importação', '<p>Importar <strong>' + rows.length + '</strong> produto(s)?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button>' + modalFootBtn('Importar', 'btn-primary', true));
    $('#mSubmit').addEventListener('click', async () => {
      try { await sbInsert('services', rows.length === 1 ? rows[0] : rows); await loadAll(); closeModal(); toast(rows.length + ' produto(s) importado(s)!', 'success'); render(currentRoute()); }
      catch (e) { toast('Erro: ' + e.message, 'error'); }
    });
    $('#mCancel').addEventListener('click', closeModal);
  });
  $('#mCancel').addEventListener('click', closeModal);
}

/* ═══════════ SETTINGS ═══════════ */
async function loadSettings() {
  try {
    const res = await sbFetch('/rest/v1/site_settings?limit=1', { headers: sbHeaders() });
    const rows = await res.json();
    const row = Array.isArray(rows) && rows[0] ? rows[0] : {};
    const f = $('#settingsForm').elements;
    const fields = ['heroTitle', 'heroSubtitle', 'whatsapp', 'email', 'ctaTitle', 'ctaText', 'address', 'whatsappText'];
    fields.forEach(k => { if (row[k] != null && f[k]) f[k].value = row[k]; });
    return row;
  } catch (_) { return {}; }
}
async function saveSettings() {
  if (!session.data) { openLogin(); return false; }
  const f = $('#settingsForm').elements;
  const data = {
    hero_title: f.heroTitle.value.trim(), hero_subtitle: f.heroSubtitle.value.trim(), whatsapp: f.whatsapp.value.trim(),
    email: f.email.value.trim(), cta_title: f.ctaTitle.value.trim(), cta_text: f.ctaText.value.trim(),
    address: f.address.value.trim(), whatsapp_text: f.whatsappText.value.trim(), updated_at: new Date().toISOString()
  };
  try {
    const existing = await loadSettings();
    if (existing.id) { await sbUpdate('site_settings', existing.id, data); }
    else { data.id = uid(); await sbInsert('site_settings', data); }
    toast('Configurações salvas!', 'success');
    return true;
  } catch (e) { toast('Erro: ' + e.message, 'error'); return false; }
}

/* ═══════════ RENDER DISPATCH ═══════════ */
let lastSeasoned = null;
function render(route) {
  route = route || currentRoute();
  if (route === 'dashboard') renderDashboard();
  else if (route === 'produtos') renderProducts();
  else if (route === 'categorias') renderCategories();
  else if (route === 'pedidos') renderOrders();
  else if (route === 'expedicao') renderExpedicao();
  else if (route === 'fretes') renderFretes();
  else if (route === 'clientes') renderCustomers();
  else if (route === 'vendedoras') renderSellers();
  else if (route === 'relatorios') renderRelatorios();
  else if (route === 'avaliacoes') renderReviews();
  else if (route === 'equipe') renderTeam();
  else if (route === 'plano') renderPlano();
}

/* ═══════════ SESSION RESTORE ═══════════ */
async function tryRestoreSession() {
  const saved = localStorage.getItem(AUTH_KEY);
  if (!saved) return;
  let parsed;
  try { parsed = JSON.parse(saved); } catch (_) { localStorage.removeItem(AUTH_KEY); return; }
  if (!parsed.refresh_token) { localStorage.removeItem(AUTH_KEY); return; }
  try {
    const data = await restoreWithRefreshToken(parsed.refresh_token);
    persistSession(data, parsed.email);
    await loadAll();
    updateConnectionUI(true);
    if (parsed.email) toast('Conectado como ' + parsed.email + '.', 'success');
  } catch (_) {
    localStorage.removeItem(AUTH_KEY);
    updateConnectionUI(false);
  }
}

/* ═══════════ INIT ═══════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Tema
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#appTheme').addEventListener('change', () => { localStorage.setItem(THEME_KEY, $('#appTheme').value); applyTheme($('#appTheme').value); });
  $('#appSave').addEventListener('click', () => {
    localStorage.setItem('kerigma:accent', $('#appAccent').value);
    document.documentElement.style.setProperty('--accent', $('#appAccent').value);
    toast('Aparência salva!', 'success');
  });

  // Sidebar / navegação
  $$('.sidebar-item.sub-trigger').forEach(t => t.addEventListener('click', () => t.closest('.sidebar-section').classList.toggle('open')));
  $$('.sidebar-subitem').forEach(s => s.addEventListener('click', () => goto(s.dataset.route)));
  $$('[data-route]').forEach(el => { if (el.classList.contains('sidebar-item') && !el.classList.contains('sub-trigger')) el.addEventListener('click', (e) => { e.preventDefault(); goto(el.dataset.route); }); });
  $('#menuToggle').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#mobileBackdrop').classList.add('open'); });
  $('#mobileBackdrop').addEventListener('click', closeDrawer);
  window.addEventListener('hashchange', () => goto(currentRoute()));

  // Bottom nav (mobile)
  $('#mAdminNav') && $('#mAdminNav').querySelectorAll('.mn-item[data-route]').forEach(b => {
    b.addEventListener('click', () => goto(b.dataset.route));
  });
  $('#mnMenu') && $('#mnMenu').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#mobileBackdrop').classList.add('open'); });

  // FAB (mobile)
  $('#mFab') && $('#mFab').addEventListener('click', () => {
    const act = $('#mFab').dataset.action;
    if (act === 'newProduct')    { newProduct(); return; }
    if (act === 'newCategory')   { $('#addCatBtn') && $('#addCatBtn').click(); return; }
    if (act === 'newOrder')      { $('#orderNew') && $('#orderNew').click(); return; }
    if (act === 'newFrete')      { $('#addFrete') && $('#addFrete').click(); return; }
    if (act === 'newClient')     { $('#addClient') && $('#addClient').click(); return; }
    if (act === 'newSeller')     { $('#addSeller') && $('#addSeller').click(); return; }
    if (act === 'newTeam')       { $('#addTeam') && $('#addTeam').click(); return; }
    if (act === null)            { render(currentRoute()); toast('Atualizado.', 'info'); return; }
  });

  // Atalhos topbar
  $('#headerConnect').addEventListener('click', e => { e.preventDefault(); openLogin(); });
  $('#headerLogout').addEventListener('click', e => { e.preventDefault(); logout(); });
  $('#loginOverlay').addEventListener('click', e => { if (e.target === $('#loginOverlay')) closeLogin(); });
  $('#modalLoginBtn').addEventListener('click', async () => {
    $('#modalLoginBtn').disabled = true;
    await setModalStatus('', '<span class="gh-spinner"></span> Conectando...');
    const r = await handleLogin($('#modalEmailInput').value.trim(), $('#modalPassInput').value);
    if (r && r.error) { await setModalStatus('error', '<i class="fas fa-times-circle"></i> ' + escapeHtml(r.error)); toast('Erro: ' + r.error, 'error'); }
    else { $('#modalPassInput').value = ''; $('#modalStatus').style.display = 'none'; }
    $('#modalLoginBtn').disabled = false;
  });
  $('#modalPassInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#modalLoginBtn').click(); });

  // Modal fechar
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', e => { if (e.target === $('#modalOverlay')) closeModal(); });

  // Dashboard
  $('#dashPeriod').addEventListener('change', () => render('dashboard'));

  // Produtos toolbar
  $('#prodNew').addEventListener('click', newProduct);
  $('#prodRefresh').addEventListener('click', async () => { await loadAll(); render('produtos'); toast('Atualizado.', 'info'); });
  $('#prodImport').addEventListener('click', importCSV);
  $('#prodSearch').addEventListener('input', debounce(e => { state.prodSearch = e.target.value; renderProducts(); }, 250));
  $('#prodCatFilter').addEventListener('change', e => { state.prodCatFilter = e.target.value; renderProducts(); });
  $('#prodTypeFilter').addEventListener('change', e => { state.prodTypeFilter = e.target.value; renderProducts(); });
  $('#prodNoStock').addEventListener('change', e => { state.prodNoStock = e.target.checked; renderProducts(); });
  $('#prodCheckAll').addEventListener('change', e => {
    state.selected.clear();
    if (e.target.checked) filteredProducts().forEach(p => state.selected.add(p.id));
    renderProducts();
  });
  $('#prodBulkDelete').addEventListener('click', async () => {
    if (!session.data || !state.selected.size) return;
    openModal('Excluir selecionados', '<p>Excluir <strong>' + state.selected.size + '</strong> produto(s)?</p>', '<button class="btn btn-outline" id="mCancel">Cancelar</button><button class="btn btn-danger" id="mConfirm">Excluir</button>');
    $('#mCancel').addEventListener('click', closeModal);
    $('#mConfirm').addEventListener('click', async () => {
      for (const id of state.selected) { await sbDelete('services', id); }
      state.selected.clear(); await loadAll(); closeModal(); toast('Excluídos.', 'success'); render('produtos');
    });
  });

  // Categorias
  $('#catNew').addEventListener('click', () => openCategoryModal(null));

  // Pedidos
  $('#orderNew').addEventListener('click', newOrder);
  $('#orderStatusFilter').addEventListener('change', e => { state.orderStatusFilter = e.target.value; renderOrders(); });

  // Expedição
  $('#expStatusFilter').addEventListener('change', e => { state.expStatusFilter = e.target.value; renderExpedicao(); });

  // Clientes / vendedoras / equipe
  $('#custNew').addEventListener('click', () => openCustomerModal(null));
  $('#sellerNew').addEventListener('click', () => openSellerModal(null));
  $('#teamNew').addEventListener('click', openTeamModal);

  // Relatórios
  $('#repFrom').addEventListener('change', renderRelatorios);
  $('#repTo').addEventListener('change', renderRelatorios);
  $('#repExport').addEventListener('click', exportRelatorio);

  function exportRelatorio() {
    const from = $('#repFrom').value; const to = $('#repTo').value;
    let list = state.orders;
    if (from) list = list.filter(o => new Date(o.created_at) >= new Date(from + 'T00:00:00'));
    if (to) list = list.filter(o => new Date(o.created_at) <= new Date(to + 'T23:59:59'));
    const rows = [['Código', 'Cliente', 'Vendedora', 'Total', 'Status', 'Pagamento', 'Data']];
    list.forEach(o => rows.push([o.code || '', orderCustomer(o), orderSeller(o), o.total, o.status || '', o.payment_method || '', fmtDate(o.created_at)]));
    const csv = '\uFEFF' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'relatorio-kerigma.csv'; a.click();
    URL.revokeObjectURL(a.href);
    toast('Relatório exportado.', 'success');
  }

  // Avaliações
  $('#revFilter').addEventListener('change', e => { state.revFilter = e.target.value; renderReviews(); });

  // Configurações
  $('#settingsSave').addEventListener('click', async () => { await saveSettings(); });

  // SW
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw-admin.js').catch(() => {}); });
  }

  // Inicial
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  goto(currentRoute());
  await loadAll();
  render(currentRoute());
  try { await loadSettings(); } catch (_) {}
  await tryRestoreSession();
  render(currentRoute());
});
