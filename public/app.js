
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.NIORA_CONFIG || {};
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const state = {
  user: null,
  profile: null,
  stores: [],
  profiles: [],
  requests: [],
  catalog: [],
  inventory: [],
  expired: [],
  monthly: [],
  catalogSearch: [],
  expiredSearch: [],
  selectedExpiredItem: null,
  darkMode: localStorage.getItem('niora_dark') === '1'
};

const app = document.getElementById('app');

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function notify(msg){ alert(msg); }
function fmtRole(role){ return ({admin:'ადმინი',manager:'მენეჯერი',worker:'თანამშრომელი'})[role] || role; }
function applyTheme(){ document.body.classList.toggle('dark', state.darkMode); localStorage.setItem('niora_dark', state.darkMode ? '1' : '0'); }
function daysUntil(dateStr){ const now = new Date(); const target = new Date(dateStr + 'T00:00:00'); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return Math.round((target - start)/86400000); }
function expiryBadge(dateStr){ const d=daysUntil(dateStr); if(d<0)return '<span class="status danger">ვადაგასული</span>'; if(d<=1)return '<span class="status warn">მალე იწურება</span>'; return '<span class="status ok">ნორმალური</span>'; }
function monthKeyNow(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

async function ensureProfile(){
  const { data: { user } } = await supabase.auth.getUser();
  state.user = user;
  if (!user) { state.profile = null; return; }

  let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile) {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const role = (count || 0) === 0 ? 'admin' : 'worker';
    const approved = role === 'admin';
    const payload = {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
      role,
      approved
    };
    const ins = await supabase.from('profiles').insert(payload).select().single();
    if (ins.error) throw ins.error;
    profile = ins.data;
  }
  state.profile = profile;
}

async function loadData(){
  await ensureProfile();
  if (!state.user) return;

  const [storesRes, profilesRes, requestsRes, catalogRes] = await Promise.all([
    supabase.from('stores').select('*').order('number'),
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('join_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('catalog').select('*').order('name')
  ]);

  state.stores = storesRes.data || [];
  state.profiles = profilesRes.data || [];
  state.requests = requestsRes.data || [];
  state.catalog = catalogRes.data || [];

  if (state.profile?.store_id) {
    const [invRes, expRes, monRes] = await Promise.all([
      supabase.from('inventory_entries').select('*').eq('store_id', state.profile.store_id).eq('archived', false).order('expiry_date'),
      supabase.from('expired_items').select('*').eq('store_id', state.profile.store_id).order('name'),
      supabase.from('expired_monthly').select('*').eq('store_id', state.profile.store_id).order('month_key', { ascending: false })
    ]);
    state.inventory = invRes.data || [];
    state.expired = expRes.data || [];
    state.monthly = monRes.data || [];
  } else {
    state.inventory = [];
    state.expired = [];
    state.monthly = [];
  }
}

function authView(){
  return `
    <div class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="logo">N</div>
          <div><h1>Niora</h1><p>ონლაინ MVP • Georgian UI • Supabase</p></div>
        </div>
        <div class="top-actions">
          <button class="theme-btn" id="themeToggle">${state.darkMode ? '☀️' : '🌙'}</button>
        </div>
      </div>
    </div>
    <div class="auth-shell">
      <div class="auth-wrap">
        <div class="card hero">
          <h2>სრული ქართული ინტერფეისი მაღაზიებისთვის</h2>
          <p>რეგისტრაცია, როლები, საერთო კატალოგი, ვადები, ვადაგასული სია და თვიური რეპორტი.</p>
          <div class="stats">
            <div class="stat"><div class="num">email</div><div class="lab">რეგისტრაცია</div></div>
            <div class="stat"><div class="num">admin</div><div class="lab">პირველი user</div></div>
            <div class="stat"><div class="num">+1/+5/+10</div><div class="lab">სწრაფი ვადა</div></div>
          </div>
        </div>
        <div class="list">
          <div class="card">
            <div class="panel-title"><h3>რეგისტრაცია</h3></div>
            <p class="small">თუ Supabase-ში Confirm Email ჩართულია, დაადასტურე email და მერე შედი.</p>
            <form id="registerForm">
              <label>სრული სახელი<input name="full_name" required></label>
              <label>Email<input type="email" name="email" required></label>
              <label>პაროლი<input type="password" name="password" required></label>
              <button class="btn primary" type="submit">რეგისტრაცია</button>
            </form>
          </div>
          <div class="card">
            <div class="panel-title"><h3>შესვლა</h3></div>
            <form id="loginForm">
              <label>Email<input type="email" name="email" required></label>
              <label>პაროლი<input type="password" name="password" required></label>
              <button class="btn secondary" type="submit">შესვლა</button>
            </form>
          </div>
        </div>
      </div>
    </div>`;
}

function mainView(){
  const store = state.stores.find(s => s.id === state.profile?.store_id);
  const totalSoon = state.inventory.filter(x => daysUntil(x.expiry_date) <= 1).length;
  const totalExpired = state.inventory.filter(x => daysUntil(x.expiry_date) < 0).length + state.expired.reduce((a,b)=>a+(b.quantity||0),0);
  const tabs = [['dashboard','მთავარი'],['stores','მაღაზიები'],['catalog','კატალოგი'],['inventory','ვადები'],['expired','ვადაგასული'],['users','მომხმარებლები'],['reports','რეპორტი']];
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="logo">N</div>
        <div>
          <h1>Niora</h1>
          <p>${store ? esc(store.number + ' • ' + store.name) : 'ჯგუფი არჩეული არ არის'} • ${fmtRole(state.profile.role)}</p>
        </div>
      </div>
      <div class="top-actions">
        <button class="theme-btn" id="themeToggle">${state.darkMode ? '☀️' : '🌙'}</button>
        <span class="badge">${esc(state.profile.full_name || state.user.email)}</span>
        <span class="badge">${esc(state.user.email)}</span>
        <button class="btn secondary" id="logoutBtn">გასვლა</button>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="tabs">${tabs.map((t,i)=>`<button class="tab ${i===0?'active':''}" data-tab="${t[0]}">${t[1]}</button>`).join('')}</div>

    <section class="panel" data-panel="dashboard">
      <div class="grid">
        <div class="card hero">
          <h2>მიმდინარე მდგომარეობა</h2>
          <p>აქედან შეგიძლია ნახო საერთო სტატუსი და მერე შეხვიდე კონკრეტულ განყოფილებაში.</p>
          <div class="stats">
            <div class="stat"><div class="num">${state.inventory.length}</div><div class="lab">აქტიური პარტია</div></div>
            <div class="stat"><div class="num">${totalSoon}</div><div class="lab">მალე გასასვლელი</div></div>
            <div class="stat"><div class="num">${totalExpired}</div><div class="lab">ვადაგასული / გასული</div></div>
          </div>
        </div>
        <div class="card">
          <div class="panel-title"><h3>მთავარი წესები</h3></div>
          <div class="list">
            <div class="list-item">პირველი პროფილი ხდება <b>admin</b>.</div>
            <div class="list-item">admin შეუძლია სხვა user-ის role შეცვალოს.</div>
            <div class="list-item">კატალოგი საერთოა ყველა მაღაზიისთვის.</div>
            <div class="list-item">ვადები იზოლირებულია კონკრეტული მაღაზიისთვის.</div>
            <div class="list-item">ძებნა მუშაობს სახელით ან ბოლო 5 ციფრით.</div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel hidden" data-panel="stores">
      <div class="grid">
        <div class="card">
          <div class="panel-title"><h3>მაღაზიები</h3></div>
          <div class="list">
            ${state.stores.map(s => `
              <div class="list-item">
                <div><b>${esc(s.number)}</b> • ${esc(s.name)}</div>
                <div class="small mt8">${s.manager_id ? 'მენეჯერი დანიშნულია' : 'მენეჯერი არ არის'}</div>
                <div class="row mt8">
                  ${state.profile.store_id === s.id ? `<span class="badge">შენი ჯგუფი</span>` : `<button class="btn soft" data-join="${s.id}">გაწევრიანება</button>`}
                </div>
              </div>
            `).join('') || `<div class="notice">მაღაზიები ჯერ არ არის.</div>`}
          </div>
        </div>
        <div class="list">
          ${state.profile.role === 'admin' ? `
            <div class="card">
              <div class="panel-title"><h3>ახალი მაღაზია</h3></div>
              <form id="storeForm">
                <label>ნომერი<input name="number" placeholder="#023"></label>
                <label>სახელი<input name="name" placeholder="Vazisubani"></label>
                <button class="btn primary" type="submit">შექმნა</button>
              </form>
            </div>
          ` : ''}
          ${(state.profile.role === 'admin' || state.profile.role === 'manager') ? `
            <div class="card">
              <div class="panel-title"><h3>გაწევრიანების მოთხოვნები</h3></div>
              <div class="list">
                ${filteredRequests().map(r => `
                  <div class="list-item">
                    <div><b>${esc(profileById(r.profile_id)?.full_name || 'User')}</b><div class="small mt8">${esc(profileById(r.profile_id)?.email || '')}</div></div>
                    <div class="small">${esc(storeById(r.store_id)?.number || '')} • ${esc(storeById(r.store_id)?.name || '')}</div>
                    <div class="row mt8 right">
                      <button class="btn soft" data-approve="${r.id}">დამტკიცება</button>
                      <button class="btn danger" data-reject="${r.id}">უარყოფა</button>
                    </div>
                  </div>
                `).join('') || `<div class="notice">მოთხოვნები არ არის.</div>`}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </section>

    <section class="panel hidden" data-panel="catalog">
      <div class="grid">
        <div class="card">
          <div class="panel-title"><h3>ძებნა საერთო კატალოგში</h3></div>
          <div class="search"><span>⌕</span><input id="catalogSearchInput" placeholder="სახელი ან ბოლო 5 ციფრი"></div>
          <div id="catalogResults" class="list mt16">${renderCatalogResults()}</div>
        </div>
        <div class="card">
          <div class="panel-title"><h3>ახალი პროდუქტი საერთო ბაზაში</h3></div>
          <form id="catalogForm">
            <label>კოდი<input name="code" placeholder="4860100090123"></label>
            <label>სახელი<input name="name" placeholder="რძე 1 ლ"></label>
            <button class="btn primary" type="submit">დამატება</button>
          </form>
        </div>
      </div>
    </section>

    <section class="panel hidden" data-panel="inventory">
      <div class="grid">
        <div class="card">
          <div class="panel-title"><h3>ვადიანი პარტიის დამატება</h3></div>
          ${state.profile.store_id ? `
            <form id="inventoryForm">
              <div class="form-grid">
                <label>კოდი<input name="code" placeholder="სრული კოდი"></label>
                <label>სახელი<input name="name" placeholder="თუ კატალოგში არსებობს, იგივე დარჩება"></label>
              </div>
              <div class="form-grid">
                <label>ვადის თარიღი<input type="date" id="expiryInput" name="expiry_date"></label>
                <label>რაოდენობა<input type="number" min="1" name="quantity" value="1"></label>
              </div>
              <div class="toolbar">
                <button class="btn soft" type="button" data-add-days="1">+1 დღე</button>
                <button class="btn soft" type="button" data-add-days="5">+5 დღე</button>
                <button class="btn soft" type="button" data-add-days="10">+10 დღე</button>
              </div>
              <div class="mt16"><button class="btn primary" type="submit">შენახვა</button></div>
            </form>
          ` : `<div class="notice">ჯერ შედი რომელიმე მაღაზიაში.</div>`}
        </div>
        <div class="card">
          <div class="panel-title"><h3>აქტიური ვადები</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>პროდუქტი</th><th>კოდი</th><th>ვადა</th><th>რაოდენობა</th><th>სტატუსი</th><th>ქმედება</th></tr></thead>
              <tbody>
                ${state.inventory.map(x => `
                  <tr>
                    <td>${esc(x.name)}</td>
                    <td>${esc(x.code)}</td>
                    <td>${esc(x.expiry_date)}</td>
                    <td>${esc(x.quantity)}</td>
                    <td>${expiryBadge(x.expiry_date)}</td>
                    <td>
                      <div class="row">
                        <button class="btn soft" data-edit="${x.id}">რედაქტირება</button>
                        ${daysUntil(x.expiry_date) < 0 ? `<button class="btn warn" data-move="${x.id}">ვადაგასულში</button>` : ``}
                        <button class="btn danger" data-delete="${x.id}">წაშლა</button>
                      </div>
                    </td>
                  </tr>
                `).join('') || `<tr><td colspan="6"><div class="notice">ჩანაწერები ჯერ არ არის.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="panel hidden" data-panel="expired">
      <div class="grid">
        <div class="card">
          <div class="panel-title"><h3>ხელით დამატება ვადაგასულში</h3></div>
          <div class="search"><span>⌕</span><input id="expiredSearchInput" placeholder="სახელი ან ბოლო 5 ციფრი"></div>
          <div id="expiredSearchResults" class="list mt16">${renderExpiredSearchResults()}</div>
          <form id="manualExpiredForm" class="mt16">
            <label>არჩეული პროდუქტი<input id="selectedExpiredDisplay" readonly value="${state.selectedExpiredItem ? `${state.selectedExpiredItem.name} • ${state.selectedExpiredItem.code}` : ''}"></label>
            <label>რაოდენობა<input type="number" min="1" name="quantity" value="1"></label>
            <button class="btn primary" type="submit">დამატება ვადაგასულში</button>
          </form>
        </div>
        <div class="card">
          <div class="panel-title"><h3>ვადაგასული დაგროვილი სია</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>პროდუქტი</th><th>კოდი</th><th>რაოდენობა</th></tr></thead>
              <tbody>
                ${state.expired.map(x => `
                  <tr><td>${esc(x.name)}</td><td>${esc(x.code)}</td><td>${esc(x.quantity)}</td></tr>
                `).join('') || `<tr><td colspan="3"><div class="notice">ვადაგასული ჯერ არ არის.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="panel hidden" data-panel="users">
      <div class="card">
        <div class="panel-title"><h3>მომხმარებლები და როლები</h3></div>
        ${state.profile.role === 'admin' ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>სახელი</th><th>Email</th><th>როლი</th><th>მაღაზია</th><th>მოქმედება</th></tr></thead>
              <tbody>
                ${state.profiles.map(p => `
                  <tr>
                    <td>${esc(p.full_name || '')}</td>
                    <td>${esc(p.email)}</td>
                    <td>${esc(fmtRole(p.role))}</td>
                    <td>${esc(storeById(p.store_id)?.number || '-')}</td>
                    <td>
                      <div class="row">
                        <button class="btn soft" data-role="${p.id}" data-nextrole="admin">ადმინი</button>
                        <button class="btn soft" data-role="${p.id}" data-nextrole="manager">მენეჯერი</button>
                        <button class="btn soft" data-role="${p.id}" data-nextrole="worker">მუშაკი</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="notice">ამ განყოფილებაზე წვდომა მხოლოდ ადმინს აქვს.</div>`}
      </div>
    </section>

    <section class="panel hidden" data-panel="reports">
      <div class="card">
        <div class="panel-title"><h3>თვიური რეპორტი</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>თვე</th><th>პროდუქტი</th><th>კოდი</th><th>რაოდენობა</th></tr></thead>
            <tbody>
              ${state.monthly.map(r => `
                <tr><td>${esc(r.month_key)}</td><td>${esc(r.name)}</td><td>${esc(r.code)}</td><td>${esc(r.quantity)}</td></tr>
              `).join('') || `<tr><td colspan="4"><div class="notice">რეპორტი ჯერ არ არის.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>`;
}

function renderCatalogResults(){
  if (!state.catalogSearch.length) return '<div class="notice">ძებნის შედეგები აქ გამოჩნდება.</div>';
  return state.catalogSearch.map(x => `<div class="list-item"><b>${esc(x.name)}</b><div class="small mt8">${esc(x.code)} • ბოლო 5: ${esc(x.code.slice(-5))}</div></div>`).join('');
}
function renderExpiredSearchResults(){
  if (!state.expiredSearch.length) return '<div class="notice">ძიების შედეგები აქ გამოჩნდება.</div>';
  return state.expiredSearch.map(x => `
    <div class="list-item">
      <div><b>${esc(x.name)}</b><div class="small mt8">${esc(x.code)} • ბოლო 5: ${esc(x.code.slice(-5))}</div></div>
      <div class="row right"><button class="btn soft" data-pick-expired="${x.id}" data-code="${esc(x.code)}" data-name="${esc(x.name)}">არჩევა</button></div>
    </div>
  `).join('');
}
function storeById(id){ return state.stores.find(s => s.id === id); }
function profileById(id){ return state.profiles.find(p => p.id === id); }
function filteredRequests(){
  if (state.profile.role === 'admin') return state.requests.filter(r => r.status === 'pending');
  if (state.profile.role === 'manager') return state.requests.filter(r => r.status === 'pending' && storeById(r.store_id)?.manager_id === state.profile.id);
  return [];
}

function render(){
  applyTheme();
  app.innerHTML = state.user ? mainView() : authView();
  bind();
}

async function signUp(email, password, full_name){
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name } }
  });
  if (error) throw error;
}
async function signIn(email, password){
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
async function signOut(){
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function createStore(number, name){
  const { error } = await supabase.from('stores').insert({ number, name });
  if (error) throw error;
}
async function requestJoin(store_id){
  const { error } = await supabase.from('join_requests').insert({ profile_id: state.profile.id, store_id, status: 'pending' });
  if (error) throw error;
}
async function approveRequest(id){
  const req = state.requests.find(x => x.id === id);
  if (!req) return;
  const profile = profileById(req.profile_id);
  if (!profile) return;
  let role = profile.role;
  if (state.profile.role === 'manager') role = 'worker';
  const { error: e1 } = await supabase.from('profiles').update({ store_id: req.store_id, approved: true, role }).eq('id', req.profile_id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('join_requests').update({ status: 'approved' }).eq('id', id);
  if (e2) throw e2;
}
async function rejectRequest(id){
  const { error } = await supabase.from('join_requests').update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
}
async function upsertCatalog(code, name){
  const found = state.catalog.find(x => x.code === code);
  if (found) { notify('ეს პროდუქტი უკვე არსებობს საერთო ბაზაში'); return; }
  const { error } = await supabase.from('catalog').insert({ code, name, created_by: state.profile.id });
  if (error) throw error;
}
async function searchCatalog(q){
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return state.catalog.filter(x => x.name.toLowerCase().includes(term) || x.code.includes(term) || x.code.slice(-5).includes(term)).slice(0, 20);
}
async function addInventory(code, name, expiry_date, quantity){
  const found = state.catalog.find(x => x.code === code);
  const finalName = found?.name || name;
  if (!finalName) throw new Error('სახელი სავალდებულოა');
  if (!found) await upsertCatalog(code, name);
  const { error } = await supabase.from('inventory_entries').insert({
    store_id: state.profile.store_id,
    code, name: finalName, expiry_date, quantity: Number(quantity),
    created_by: state.profile.id
  });
  if (error) throw error;
}
async function updateInventory(id, expiry_date, quantity){
  const { error } = await supabase.from('inventory_entries').update({ expiry_date, quantity: Number(quantity) }).eq('id', id);
  if (error) throw error;
}
async function deleteInventory(id){
  const { error } = await supabase.from('inventory_entries').delete().eq('id', id);
  if (error) throw error;
}
async function moveExpired(id, qty){
  const item = state.inventory.find(x => x.id === id);
  if (!item) return;
  const quantity = Number(qty);
  if (!quantity || quantity < 1 || quantity > item.quantity) throw new Error('არასწორი რაოდენობა');

  const existing = state.expired.find(x => x.code === item.code);
  if (existing) {
    const { error } = await supabase.from('expired_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('expired_items').insert({
      store_id: state.profile.store_id,
      code: item.code,
      name: item.name,
      quantity
    });
    if (error) throw error;
  }

  const month_key = monthKeyNow();
  const monthExisting = state.monthly.find(x => x.code === item.code && x.month_key === month_key);
  if (monthExisting) {
    const { error } = await supabase.from('expired_monthly').update({ quantity: monthExisting.quantity + quantity }).eq('id', monthExisting.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('expired_monthly').insert({
      store_id: state.profile.store_id,
      code: item.code,
      name: item.name,
      month_key,
      quantity
    });
    if (error) throw error;
  }

  const left = item.quantity - quantity;
  const { error: invErr } = await supabase.from('inventory_entries').update({ quantity: left, archived: left === 0 }).eq('id', item.id);
  if (invErr) throw invErr;
}
async function manualAddExpired(code, name, qty){
  const quantity = Number(qty);
  if (!quantity || quantity < 1) throw new Error('რაოდენობა სავალდებულოა');
  const existing = state.expired.find(x => x.code === code);
  if (existing) {
    const { error } = await supabase.from('expired_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('expired_items').insert({
      store_id: state.profile.store_id, code, name, quantity
    });
    if (error) throw error;
  }

  const month_key = monthKeyNow();
  const monthExisting = state.monthly.find(x => x.code === code && x.month_key === month_key);
  if (monthExisting) {
    const { error } = await supabase.from('expired_monthly').update({ quantity: monthExisting.quantity + quantity }).eq('id', monthExisting.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('expired_monthly').insert({
      store_id: state.profile.store_id, code, name, month_key, quantity
    });
    if (error) throw error;
  }
}
async function changeRole(profileId, role){
  const update = { role };
  if (role === 'manager' && !profileById(profileId)?.store_id && state.stores.length) {
    update.store_id = state.stores[0].id;
  }
  const { error } = await supabase.from('profiles').update(update).eq('id', profileId);
  if (error) throw error;
}

function addDaysToInput(days){
  const input = qs('#expiryInput');
  if (!input) return;
  const current = input.value ? new Date(input.value + 'T00:00:00') : new Date();
  current.setDate(current.getDate() + days);
  input.value = current.toISOString().slice(0,10);
}

function bind(){
  qs('#themeToggle')?.addEventListener('click', () => { state.darkMode = !state.darkMode; applyTheme(); render(); });

  if (!state.user) {
    qs('#registerForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await signUp(fd.get('email'), fd.get('password'), fd.get('full_name'));
        notify('რეგისტრაცია შესრულდა. თუ Confirm Email ჩართულია, ჯერ email დაადასტურე.');
      } catch (err) { notify(err.message); }
    });
    qs('#loginForm')?.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await signIn(fd.get('email'), fd.get('password'));
        await loadData(); render();
      } catch (err) { notify(err.message); }
    });
    return;
  }

  qs('#logoutBtn')?.addEventListener('click', async () => { await signOut(); state.user = null; state.profile = null; render(); });

  qsa('.tab').forEach(tab => tab.addEventListener('click', () => {
    qsa('.tab').forEach(t => t.classList.remove('active'));
    qsa('.panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    qs(`[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
  }));

  qs('#storeForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { await createStore(fd.get('number'), fd.get('name')); await loadData(); render(); notify('მაღაზია შეიქმნა'); }
    catch(err){ notify(err.message); }
  });

  qsa('[data-join]').forEach(btn => btn.addEventListener('click', async () => {
    try { await requestJoin(btn.dataset.join); await loadData(); render(); notify('მოთხოვნა გაიგზავნა'); }
    catch(err){ notify(err.message); }
  }));

  qsa('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
    try { await approveRequest(btn.dataset.approve); await loadData(); render(); notify('დამტკიცდა'); }
    catch(err){ notify(err.message); }
  }));
  qsa('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
    try { await rejectRequest(btn.dataset.reject); await loadData(); render(); notify('უარყოფილია'); }
    catch(err){ notify(err.message); }
  }));

  qs('#catalogSearchInput')?.addEventListener('input', async e => {
    state.catalogSearch = await searchCatalog(e.target.value);
    qs('#catalogResults').innerHTML = renderCatalogResults();
  });

  qs('#catalogForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { await upsertCatalog(fd.get('code'), fd.get('name')); await loadData(); render(); notify('დაემატა საერთო კატალოგში'); }
    catch(err){ notify(err.message); }
  });

  qsa('[data-add-days]').forEach(btn => btn.addEventListener('click', () => addDaysToInput(Number(btn.dataset.addDays))));

  qs('#inventoryForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await addInventory(fd.get('code'), fd.get('name'), fd.get('expiry_date'), fd.get('quantity'));
      await loadData(); render(); notify('პარტია დაემატა');
    } catch (err) { notify(err.message); }
  });

  qsa('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const item = state.inventory.find(x => x.id === btn.dataset.edit);
    if (!item) return;
    const quantity = prompt('ახალი რაოდენობა', item.quantity);
    if (quantity === null) return;
    const expiry = prompt('ახალი თარიღი (YYYY-MM-DD)', item.expiry_date);
    if (expiry === null) return;
    try { await updateInventory(item.id, expiry, quantity); await loadData(); render(); notify('განახლდა'); }
    catch(err){ notify(err.message); }
  }));

  qsa('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('ნამდვილად წავშალო?')) return;
    try { await deleteInventory(btn.dataset.delete); await loadData(); render(); notify('წაიშალა'); }
    catch(err){ notify(err.message); }
  }));

  qsa('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
    const item = state.inventory.find(x => x.id === btn.dataset.move);
    const qty = prompt(`რამდენი გადავიდეს ვადაგასულში? მაქს ${item.quantity}`, item.quantity);
    if (qty === null) return;
    try { await moveExpired(item.id, qty); await loadData(); render(); notify('გადატანილია'); }
    catch(err){ notify(err.message); }
  }));

  qs('#expiredSearchInput')?.addEventListener('input', async e => {
    state.expiredSearch = await searchCatalog(e.target.value);
    qs('#expiredSearchResults').innerHTML = renderExpiredSearchResults();
    qsa('[data-pick-expired]').forEach(btn => btn.addEventListener('click', () => {
      state.selectedExpiredItem = { code: btn.dataset.code, name: btn.dataset.name };
      qs('#selectedExpiredDisplay').value = `${btn.dataset.name} • ${btn.dataset.code}`;
    }));
  });

  qs('#manualExpiredForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.selectedExpiredItem) { notify('ჯერ აირჩიე პროდუქტი'); return; }
    const fd = new FormData(e.target);
    try {
      await manualAddExpired(state.selectedExpiredItem.code, state.selectedExpiredItem.name, fd.get('quantity'));
      state.selectedExpiredItem = null;
      await loadData(); render(); notify('დაემატა ვადაგასულში');
    } catch (err) { notify(err.message); }
  });

  qsa('[data-role]').forEach(btn => btn.addEventListener('click', async () => {
    try { await changeRole(btn.dataset.role, btn.dataset.nextrole); await loadData(); render(); notify('როლი განახლდა'); }
    catch(err){ notify(err.message); }
  }));
}

async function init(){
  try {
    const { data: { session } } = await supabase.auth.getSession();
    state.user = session?.user || null;
    await loadData();
  } catch (e) {
    console.error(e);
  }
  render();
}

init();
