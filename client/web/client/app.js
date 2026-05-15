/* ── screens ── */
const connectScreen = document.getElementById("connectScreen");
const chatScreen    = document.getElementById("chatScreen");
const serverInput   = document.getElementById("serverInput");
const connectBtn    = document.getElementById("connectBtn");
const connectError  = document.getElementById("connectError");
const disconnectBtn = document.getElementById("disconnectBtn");

/* ── chat ── */
const chat      = document.getElementById("chat");
const msgInput  = document.getElementById("msgInput");
const sendBtn   = document.getElementById("sendBtn");
const connState = document.getElementById("connState");

/* ── nick modal ── */
const changeNickBtn  = document.getElementById("changeNickBtn");
const nickModal      = document.getElementById("nickModal");
const nickInput      = document.getElementById("nickInput");
const saveNickBtn    = document.getElementById("saveNickBtn");
const cancelNickBtn  = document.getElementById("cancelNickBtn");
const modalBg        = document.getElementById("modalBg");

let ws = null;
let reconnectTimer = null;
let reconnectDelay = 800;
let currentWsUrl   = "";

let nick = localStorage.getItem("nick") || "Guest";

/* ── helpers ── */
function esc(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmt(ms){
  try{ return new Date(ms).toLocaleTimeString(); } catch { return ""; }
}
function scrollBottom(){ chat.scrollTop = chat.scrollHeight; }

function addSystem(text){
  const div = document.createElement("div");
  div.className = "sys";
  div.textContent = text;
  chat.appendChild(div);
  scrollBottom();
}
function addMessage(n, text, time_ms){
  const div = document.createElement("div");
  div.className = "bubble";
  div.innerHTML = `
    <div class="head">
      <div class="nick">${esc(n)}</div>
      <div class="ts">${esc(fmt(time_ms))}</div>
    </div>
    <div class="text">${esc(text)}</div>
  `;
  chat.appendChild(div);
  scrollBottom();
}
function setConn(ok){
  connState.textContent = ok ? "online" : "offline";
  connState.style.color = ok ? "#7ee787" : "";
}

/* ── nick modal ── */
function showNickModal(){ nickInput.value = nick; nickModal.hidden = false; nickInput.focus(); nickInput.select(); }
function hideNickModal(){ nickModal.hidden = true; }

changeNickBtn.addEventListener("click", showNickModal);
modalBg.addEventListener("click", hideNickModal);
cancelNickBtn.addEventListener("click", (e)=>{ e.preventDefault(); hideNickModal(); });

saveNickBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  const v = nickInput.value.trim().slice(0,24) || "Guest";
  nick = v;
  localStorage.setItem("nick", nick);
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify({type:"set_nick", nick}));
  }
  hideNickModal();
});
nickInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") saveNickBtn.click();
  if(e.key === "Escape") hideNickModal();
});

/* ── connect screen ── */
function showError(msg){
  connectError.textContent = msg;
  connectError.hidden = false;
}
function hideError(){
  connectError.hidden = true;
}

function buildWsUrl(raw){
  const s = raw.trim().replace(/\/+$/, "");
  if(/^wss?:\/\//i.test(s)) return s + (s.endsWith("/ws") ? "" : "/ws");
  return "ws://" + s + (s.includes("/") ? "" : "/ws");
}

function showConnectScreen(){
  if(ws){ ws.onclose = null; ws.onerror = null; ws.close(); ws = null; }
  if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  chatScreen.hidden = true;
  connectScreen.hidden = false;
  serverInput.focus();
}

function showChatScreen(){
  connectScreen.hidden = true;
  chatScreen.hidden = false;
  msgInput.focus();
}

disconnectBtn.addEventListener("click", ()=>{
  localStorage.removeItem("lastServer");
  showConnectScreen();
});

connectBtn.addEventListener("click", tryConnect);
serverInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter") tryConnect(); });

function tryConnect(){
  hideError();
  const raw = serverInput.value.trim();
  if(!raw){ showError("Введите адрес сервера"); serverInput.focus(); return; }

  const url = buildWsUrl(raw);
  localStorage.setItem("lastServer", serverInput.value.trim());
  currentWsUrl = url;
  reconnectDelay = 800;
  chat.innerHTML = "";
  showChatScreen();
  connect();
}

/* ── websocket ── */
function scheduleReconnect(){
  if(reconnectTimer) return;
  reconnectTimer = setTimeout(()=>{
    reconnectTimer = null;
    reconnectDelay = Math.min(4000, Math.floor(reconnectDelay * 1.3));
    connect();
  }, reconnectDelay);
}

function connect(){
  if(!currentWsUrl) return;
  try{
    ws = new WebSocket(currentWsUrl);
  } catch(e){
    addSystem("не могу открыть WebSocket: " + e);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", ()=>{
    reconnectDelay = 800;
    setConn(true);
    ws.send(JSON.stringify({type:"set_nick", nick}));
  });

  ws.addEventListener("close", ()=>{
    setConn(false);
    if(chatScreen.hidden) return;
    addSystem("соединение закрыто, переподключаюсь...");
    scheduleReconnect();
  });

  ws.addEventListener("error", ()=>{});

  ws.addEventListener("message", (ev)=>{
    let data;
    try{ data = JSON.parse(ev.data); } catch { return; }
    const t = data.type;

    if(t === "history"){
      chat.innerHTML = "";
      for(const m of (data.messages || [])){
        addMessage(m.nick, m.text, m.ts_ms);
      }
      addSystem(`подключено как ${nick}`);
      return;
    }
    if(t === "system"){ addSystem(data.text || ""); return; }
    if(t === "message"){ addMessage(data.nick, data.text, data.time_ms); return; }
  });
}

/* ── send ── */
function send(){
  const text = msgInput.value.trim();
  if(!text) return;
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify({type:"message", text}));
    msgInput.value = "";
    msgInput.focus();
  } else {
    addSystem("нет соединения");
  }
}
sendBtn.addEventListener("click", send);
msgInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); send(); } });

/* ── init ── */
const saved = localStorage.getItem("lastServer");
if(saved){
  serverInput.value = saved;
}
showConnectScreen();
