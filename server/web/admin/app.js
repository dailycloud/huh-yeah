const clientsCountEl = document.getElementById("clientsCount");
const messagesCountEl = document.getElementById("messagesCount");
const clientsList = document.getElementById("clientsList");
const messagesList = document.getElementById("messagesList");
const refreshBtn = document.getElementById("refreshBtn");

function fmtTime(ms){
  try{ return new Date(ms).toLocaleString(); } catch { return String(ms); }
}

function renderClients(clients){
  clientsList.innerHTML = "";
  if(!clients || !clients.length){
    clientsList.innerHTML = "<div style='color:#93a7c7'>никого нет</div>";
    return;
  }
  for(const c of clients){
    const div = document.createElement("div");
    div.className = "pill";
    div.innerHTML = `<div class="nick">${escapeHtml(c.nick)}</div><div class="time">${fmtTime(c.joined_ms)}</div>`;
    clientsList.appendChild(div);
  }
}

function renderMessages(messages){
  messagesList.innerHTML = "";
  if(!messages || !messages.length){
    messagesList.innerHTML = "<div style='color:#93a7c7'>пока пусто</div>";
    return;
  }
  for(const m of messages){
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `
      <div class="head">
        <div class="nick">${escapeHtml(m.nick)}</div>
        <div class="ts">${fmtTime(m.ts_ms)}</div>
      </div>
      <div class="text">${escapeHtml(m.text)}</div>
    `;
    messagesList.appendChild(div);
  }
  messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function load(){
  const res = await fetch("/api/admin/state", {cache:"no-store"});
  const data = await res.json();
  if(!data.ok) return;

  clientsCountEl.textContent = data.clients_count;
  messagesCountEl.textContent = data.messages_count;

  renderClients(data.clients);
  renderMessages(data.messages);
}

refreshBtn.addEventListener("click", load);
load();
setInterval(load, 1500);
