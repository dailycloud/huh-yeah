/* ── screens ── */
const nickScreen      = document.getElementById("nickScreen");
const nickScreenInput = document.getElementById("nickScreenInput");
const nickScreenBtn   = document.getElementById("nickScreenBtn");
const chatScreen    = document.getElementById("chatScreen");

/* ── chat ── */
const chat          = document.getElementById("chat");
const msgInput      = document.getElementById("msgInput");
const sendBtn       = document.getElementById("sendBtn");
const connState     = document.getElementById("connState");
const connIndicator = document.getElementById("connIndicator");
const disconnectBtn = document.getElementById("disconnectBtn");

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
let currentWsUrl   = "ws://26.230.187.243:8000/ws"; // default fallback

let nick = localStorage.getItem("nick") || "";

/* ── helpers ── */
function esc(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function fmt(ms){
  try{ return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ""; }
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
  const last = chat.querySelector(".bubble:last-child");
  if(last && last.dataset.nick === n){
    const line = document.createElement("div");
    line.className = "text";
    line.textContent = text;
    last.appendChild(line);
    last.querySelector(".ts").textContent = fmt(time_ms);
    scrollBottom();
    return;
  }
  const div = document.createElement("div");
  div.className = "bubble" + (n === nick ? " self" : "");
  div.dataset.nick = n;
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
  if (ok) {
    connState.classList.add("online");
    connIndicator.className = "status-indicator online";
  } else {
    connState.classList.remove("online");
    connIndicator.className = "status-indicator offline";
  }
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
  const old = nick;
  nick = v;
  localStorage.setItem("nick", nick);
  if(ws && ws.readyState === WebSocket.OPEN){
    ws.send(JSON.stringify({type:"set_nick", nick}));
  }
  
  // Re-render self messages with the new local nick
  document.querySelectorAll(".bubble").forEach(bubble => {
    if (bubble.dataset.nick === nick) {
      bubble.classList.add("self");
    } else if (bubble.dataset.nick === old) {
      // if it was the old nick, update its class
      bubble.classList.remove("self");
    }
  });

  hideNickModal();
});

nickInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") saveNickBtn.click();
  if(e.key === "Escape") hideNickModal();
});

/* ── build WS url helper ── */
function buildWsUrl(raw){
  const s = raw.trim().replace(/\/+$/, "");
  if(/^wss?:\/\//i.test(s)) return s + (s.endsWith("/ws") ? "" : "/ws");
  return "ws://" + s + (s.includes("/") ? "" : "/ws");
}

/* ── screen flow ── */
function showNickScreen(){
  if(ws){ ws.onclose = null; ws.onerror = null; ws.close(); ws = null; }
  if(reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
  nickScreen.classList.add("active");
  chatScreen.hidden = true;
  nickScreenInput.value = nick;
  nickScreenInput.focus();
}

function showChatScreen(){
  nickScreen.classList.remove("active");
  chatScreen.hidden = false;
  msgInput.focus();
}

disconnectBtn.addEventListener("click", ()=>{
  localStorage.removeItem("nick");
  nick = "";
  showNickScreen();
});

/* ── nickname confirmation ── */
function confirmNick(){
  const v = nickScreenInput.value.trim().slice(0, 24);
  if(!v){ nickScreenInput.focus(); return; }
  nick = v;
  localStorage.setItem("nick", nick);
  chat.innerHTML = "";
  showChatScreen();
  connect();
}

nickScreenBtn.addEventListener("click", confirmNick);
nickScreenInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter") confirmNick(); });

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
  if(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  
  try{
    ws = new WebSocket(currentWsUrl);
  } catch(e){
    addSystem("Unable to open WebSocket connection");
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
    addSystem("Connection lost, reconnecting...");
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
      addSystem(`Connected as ${nick}`);
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
    addSystem("No connection to server");
  }
}
sendBtn.addEventListener("click", send);
msgInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); send(); } });

/* ── init ── */
// Fetch server config from server API if hosted
fetch("/api/config")
  .then(r => r.json())
  .then(config => {
    if (config && config.server) {
      currentWsUrl = buildWsUrl(config.server);
      // If we are already connecting or connected, reconnect with the new URL
      if (ws) {
        ws.close();
        connect();
      }
    }
  })
  .catch(e => {
    console.log("Using default fallback connection settings", e);
  });

if(nick){
  showChatScreen();
  connect();
} else {
  showNickScreen();
}
