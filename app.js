const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "jarvis-control-center-tasks-v1";
let tasks = loadTasks();

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch { /* local storage may be disabled */ }
  renderTasks();
}
function renderTasks() {
  const list = $("taskList");
  list.innerHTML = "";
  if (!tasks.length) {
    list.innerHTML = '<div class="empty">No missions yet. Add your first task above.</div>';
  } else {
    tasks.forEach(task => {
      const row = document.createElement("div");
      row.className = `task-row${task.done ? " done" : ""}`;
      const check = document.createElement("input");
      check.type = "checkbox"; check.checked = task.done; check.setAttribute("aria-label", "Complete task");
      check.addEventListener("change", () => { task.done = check.checked; saveTasks(); });
      const text = document.createElement("span"); text.className = "task-text"; text.textContent = task.text;
      const del = document.createElement("button"); del.className = "delete-task"; del.textContent = "×"; del.setAttribute("aria-label", "Delete task");
      del.addEventListener("click", () => { tasks = tasks.filter(t => t.id !== task.id); saveTasks(); });
      row.append(check, text, del); list.append(row);
    });
  }
  $("taskCount").textContent = tasks.filter(t => !t.done).length;
}
$("taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const text = $("taskInput").value.trim();
  if (!text) return;
  tasks.unshift({ id: `${Date.now()}-${Math.random()}`, text, done: false });
  $("taskInput").value = "";
  saveTasks();
});
$("clearDone").addEventListener("click", () => { tasks = tasks.filter(t => !t.done); saveTasks(); });

function updateClock() {
  $("clock").textContent = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date());
}
updateClock(); setInterval(updateClock, 30000); renderTasks();

async function checkHealth() {
  $("systemStatus").textContent = "CHECKING SYSTEM";
  try {
    const r = await fetch("/api/health");
    if (!r.ok) throw new Error("Backend unavailable");
    const data = await r.json();
    $("systemStatus").textContent = "SYSTEM READY";
    $("aiState").textContent = data.aiConfigured ? "Online" : "Setup";
    $("aiHint").textContent = data.aiConfigured ? "Provider key configured" : "Add server API key";
    const connected = Object.values(data.integrations || {}).filter(v => v === "connected").length;
    $("accountCount").innerHTML = `${connected} <em>/ 6</em>`;
  } catch {
    $("systemStatus").textContent = "BACKEND OFFLINE";
    $("aiState").textContent = "Offline";
    $("aiHint").textContent = "Deploy the Node server";
  }
}
$("refreshStatus").addEventListener("click", checkHealth);
checkHealth();

const guides = {
  youtube: ["YouTube", "YouTube connections use Google OAuth and the YouTube Data API.", [
    "Create a Google Cloud project.",
    "Enable YouTube Data API v3 and configure OAuth consent.",
    "Create OAuth client credentials and request only required scopes.",
    "Implement the server-side OAuth callback and encrypted token storage.",
    "Test read-only channel data before enabling upload or publishing."
  ]],
  instagram: ["Instagram", "Instagram publishing APIs are limited to eligible professional accounts and supported API products.", [
    "Set up a Meta developer app.",
    "Choose the current Instagram API product for your account type.",
    "Configure OAuth redirect URI and request approved scopes.",
    "Complete any required app review and business verification.",
    "Store tokens server-side and test with a permitted professional account."
  ]],
  facebook: ["Facebook Pages", "Page management uses Meta OAuth and the relevant Page permissions.", [
    "Create a Meta developer app.",
    "Configure Facebook Login and the needed Pages API permissions.",
    "Set a verified HTTPS redirect URI.",
    "Complete app review where required.",
    "Store Page access tokens securely and test read-only operations first."
  ]],
  x: ["X / Twitter", "X API access and write permissions depend on developer access and plan.", [
    "Create a developer project and app.",
    "Configure OAuth 2.0 and a callback URL.",
    "Request only the permissions your features need.",
    "Keep client secrets and tokens on the server.",
    "Check API access limits and pricing before building publishing."
  ]],
  tiktok: ["TikTok", "TikTok publishing depends on the applicable developer APIs, scopes, and app review.", [
    "Register a TikTok developer app.",
    "Enable Login Kit and the applicable Content Posting API product.",
    "Configure redirect URLs and requested scopes.",
    "Complete required review and user-consent flow.",
    "Test with draft/private publishing modes where supported."
  ]],
  whatsapp: ["WhatsApp Business", "The official WhatsApp Business Platform is intended for approved business messaging workflows, not controlling a personal WhatsApp account.", [
    "Create or use a Meta business portfolio.",
    "Set up a WhatsApp Business Platform / Cloud API app.",
    "Configure a business phone number and webhook endpoint.",
    "Follow template, opt-in, and messaging policy requirements.",
    "Store tokens securely and test only with permitted recipients."
  ]]
};
document.querySelectorAll(".connect-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const guide = guides[btn.dataset.platform];
    $("dialogTitle").textContent = `Set up ${guide[0]}`;
    $("dialogText").textContent = guide[1];
    const ol = $("dialogSteps"); ol.innerHTML = "";
    guide[2].forEach(s => { const li = document.createElement("li"); li.textContent = s; ol.append(li); });
    $("setupDialog").showModal();
  });
});

$("focusCommand").addEventListener("click", () => {
  $("commandInput").focus();
  $("commandInput").scrollIntoView({ behavior: "smooth", block: "center" });
});

async function askJarvis(message) {
  const reply = $("assistantReply");
  reply.classList.remove("hidden");
  reply.textContent = "JARVIS is thinking…";
  $("assistantLabel").textContent = "PROCESSING REQUEST";
  $("sendBtn").disabled = true;
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, language: $("languageSelect").value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Assistant request failed.");
    reply.textContent = data.answer;
    $("assistantLabel").textContent = "RESPONSE READY";
    speakIfAvailable(data.answer);
  } catch (err) {
    reply.textContent = err.message || "Could not reach JARVIS. Check your server configuration.";
    $("assistantLabel").textContent = "ACTION NEEDED";
  } finally {
    $("sendBtn").disabled = false;
  }
}
$("sendBtn").addEventListener("click", () => {
  const msg = $("commandInput").value.trim();
  if (msg) askJarvis(msg);
});
$("commandInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("sendBtn").click(); }
});

function speakIfAvailable(text) {
  if (!("speechSynthesis" in window)) return;
  // Spoken output is optional; browser voices may not include Urdu.
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = $("languageSelect").value === "ur" ? "ur-PK" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
$("voiceBtn").addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("assistantReply").classList.remove("hidden");
    $("assistantReply").textContent = "Voice recognition is not supported in this browser. Try Chrome, check microphone permission, or type your command.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = $("languageSelect").value === "ur" ? "ur-PK" : "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  $("assistantLabel").textContent = "LISTENING — SPEAK NOW";
  $("voiceBtn").textContent = "◉";
  recognition.onresult = event => {
    $("commandInput").value = event.results[0][0].transcript;
    $("assistantLabel").textContent = "VOICE CAPTURED";
  };
  recognition.onerror = event => {
    $("assistantLabel").textContent = "VOICE INPUT FAILED";
    $("assistantReply").classList.remove("hidden");
    $("assistantReply").textContent = `Voice input failed (${event.error}). You can type your command instead.`;
  };
  recognition.onend = () => { $("voiceBtn").textContent = "🎙"; if ($("assistantLabel").textContent.startsWith("LISTENING")) $("assistantLabel").textContent = "JARVIS is ready for instructions"; };
  try { recognition.start(); } catch { $("assistantLabel").textContent = "VOICE INPUT BUSY"; }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
