// app.js - lightweight frontend connecting to the Worker API endpoints at /api/*
const api = path => `/api${path}`;

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k === 'class') e.className = v;
    else if(k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  if(typeof children === 'string') e.innerHTML = children;
  else children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function init() {
  // basic UI wiring
  document.getElementById('btn-dashboard').addEventListener('click', () => showView('dashboard'));
  document.getElementById('btn-accounts').addEventListener('click', () => showView('accounts'));
  document.getElementById('btn-dealers').addEventListener('click', () => showView('dealers'));
  document.getElementById('btn-transactions').addEventListener('click', () => showView('transactions'));
  await showView('dashboard');
}

async function showView(view) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if(view === 'dashboard') {
    const card = el('div',{class:'card'},[
      el('h2',{},['Dashboard']),
      el('p',{class:'small-muted'},['Recent transactions and account summary will appear here.'])
    ]);
    // load recent transactions & accounts
    try{
      const [txs,accounts] = await Promise.all([fetchJSON(api('/transactions')), fetchJSON(api('/accounts'))]);
      const txTable = buildTransactionsTable(txs.slice(0,10));
      const accList = el('div',{},[
        el('h3',{},['Accounts']),
        el('ul',{}, accounts.map(a => el('li',{},[`${a.name}: ${Number(a.balance).toLocaleString()} BDT`])))
      ]);
      card.appendChild(txTable);
      const right = el('div',{class:'card'},[accList]);
      const wrapper = el('div',{class:'grid-2'},[card,right]);
      app.appendChild(wrapper);
    }catch(e){
      app.appendChild(el('div',{},['Error loading dashboard: ' + e.message]));
    }
  }

  if(view === 'accounts') {
    const card = el('div',{class:'card'},[
      el('h2',{},['Manage Accounts']),
      buildAccountForm()
    ]);
    // list
    try{
      const accounts = await fetchJSON(api('/accounts'));
      const list = el('div',{}, accounts.map(a => el('div',{},[`${a.name} — ${Number(a.balance).toLocaleString()} BDT`])));
      card.appendChild(el('div',{},[list]));
    }catch(e){
      card.appendChild(el('div',{},['Error loading accounts']));
    }
    app.appendChild(card);
  }

  if(view === 'dealers') {
    const card = el('div',{class:'card'},[
      el('h2',{},['Dealers & Advances']),
      buildDealerForm(),
      el('div',{id:'dealer-list'})
    ]);
    app.appendChild(card);
    await refreshDealers();
  }

  if(view === 'transactions') {
    const card = el('div',{class:'card'},[
      el('h2',{},['Transactions / Challan']),
      buildTransactionForm(),
      el('div',{id:'tx-list'})
    ]);
    app.appendChild(card);
    await refreshTransactions();
  }
}

function buildTransactionsTable(txs){
  const table = el('table',{class:'table'},[]);
  const thead = el('thead',{},[
    el('tr',{},[
      el('th',{},['Date']), el('th',{},['Challan']), el('th',{},['Wood']), el('th',{},['KG']), el('th',{},['Sell/kg']), el('th',{},['Total'])
    ])
  ]);
  const tbody = el('tbody',{}, txs.map(tx => el('tr',{},[
    el('td',{},[new Date(tx.date).toLocaleDateString()]),
    el('td',{},[tx.challan]),
    el('td',{},[tx.wood_type]),
    el('td',{},[String(tx.kg)]),
    el('td',{},[String(tx.sell_rate)]),
    el('td',{},[Number(tx.total_amount).toLocaleString() + ' BDT'])
  ])));
  table.appendChild(thead); table.appendChild(tbody);
  return table;
}

function buildAccountForm(){
  const form = el('form',{},[]);
  const name = el('input',{class:'input',placeholder:'Account name',name:'name',required:true});
  const balance = el('input',{class:'input',placeholder:'Balance (BDT)',name:'balance',type:'number',step:'0.01',value:0});
  const submit = el('button',{class:'btn',type:'submit'},['Add Account']);
  form.appendChild(name); form.appendChild(el('div',{},[balance])); form.appendChild(el('div',{},[submit]));
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    try{
      await fetchJSON(api('/accounts'), {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({name:name.value, balance: Number(balance.value)})});
      alert('Account added'); showView('accounts');
    }catch(err){ alert('Error: ' + err.message) }
  });
  return form;
}

function buildDealerForm(){
  const form = el('form',{},[]);
  const name = el('input',{class:'input',placeholder:'Dealer name',name:'name',required:true});
  const phone = el('input',{class:'input',placeholder:'Phone (optional)',name:'phone'});
  const balance = el('input',{class:'input',placeholder:'Initial advance (BDT)',name:'balance',type:'number',value:0});
  const submit = el('button',{class:'btn',type:'submit'},['Add Dealer']);
  form.appendChild(name); form.appendChild(phone); form.appendChild(balance); form.appendChild(el('div',{},[submit]));
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    try{
      await fetchJSON(api('/dealers'), {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({name:name.value, phone:phone.value, balance: Number(balance.value)})});
      alert('Dealer added'); refreshDealers();
      name.value=''; phone.value=''; balance.value=0;
    }catch(err){ alert('Error: ' + err.message) }
  });
  return form;
}

async function refreshDealers(){
  try{
    const dealers = await fetchJSON(api('/dealers'));
    const container = document.getElementById('dealer-list');
    container.innerHTML = '';
    dealers.forEach(d => container.appendChild(el('div',{},[`${d.name} — ${Number(d.balance).toLocaleString()} BDT`])));
  }catch(e){
    console.error(e);
  }
}

function buildTransactionForm(){
  const form = el('form',{},[]);
  const challan = el('input',{class:'input',placeholder:'Challan no',name:'challan',required:true});
  const wood = el('select',{class:'input',name:'wood_type'},[el('option',{},['Chamble']), el('option',{},['Meheguni']), el('option',{},['Rendi']), el('option',{},['Others'])]);
  const kg = el('input',{class:'input',placeholder:'KG',name:'kg',type:'number',step:'0.01'});
  const buy = el('input',{class:'input',placeholder:'Buy rate (BDT/kg)',name:'buy_rate',type:'number',step:'0.01'});
  const sell = el('input',{class:'input',placeholder:'Sell rate (BDT/kg)',name:'sell_rate',type:'number',step:'0.01'});
  const date = el('input',{class:'input',name:'date',type:'date',value:new Date().toISOString().slice(0,10)});
  const narration = el('textarea',{class:'input',placeholder:'Narration',name:'narration'});
  const submit = el('button',{class:'btn',type:'submit'},['Save Challan']);
  form.appendChild(challan); form.appendChild(wood); form.appendChild(kg); form.appendChild(buy); form.appendChild(sell); form.appendChild(date); form.appendChild(narration); form.appendChild(submit);

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      challan: challan.value,
      wood_type: wood.value,
      kg: Number(kg.value||0),
      buy_rate: Number(buy.value||0),
      sell_rate: Number(sell.value||0),
      total_amount: Number((kg.value||0) * (sell.value||0)),
      date: date.value,
      narration: narration.value
    };
    try{
      await fetchJSON(api('/transactions'), {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)});
      alert('Saved'); refreshTransactions();
      form.reset(); date.value = new Date().toISOString().slice(0,10);
    }catch(err){ alert('Error: ' + err.message) }
  });
  return form;
}

async function refreshTransactions(){
  try{
    const txs = await fetchJSON(api('/transactions'));
    const container = document.getElementById('tx-list') || document.getElementById('app');
    if(!container) return;
    if(document.getElementById('tx-list')) container.innerHTML = '';
    const table = buildTransactionsTable(txs);
    container.appendChild(table);
  }catch(e){
    console.error(e);
  }
}

window.addEventListener('load', init);
