import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    push,
    get,
    update,
    onValue,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";
import { GEMINI_API_KEY } from "/gemini-config.js";

// Tried in order. If one returns "not found", the next is used automatically.
const MODELS = ["gemini-3.8-flash", "gemini-3.6-flash"];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT =
    "You are a friendly pet health and care assistant inside a Pet Care app. " +
    "Give clear, practical and concise answers about pets and domestic animals. " +
    "For symptoms that could be serious or urgent, tell the user to contact a veterinarian right away. " +
    "Do not prescribe medication or give exact drug doses. " +
    "If a question is not about animals or pet care, politely say you can only help with pet-related topics.";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// DOM
const messagesEl = document.getElementById("chat-message");
const emptyState = document.getElementById("empty-state");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("sendbtn");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const chatTitleEl = document.getElementById("chat-title");

// State
let uid = null;
let currentChatId = null;
let history = []; // [{ role: "user" | "model", parts: [{ text }] }]
let chatsCache = {};
let isSending = false;
let stopHistory = null;
let activeModel = MODELS[0];

/* ---------- Gemini API ---------- */

async function streamGemini(modelName, contents, onText) {
    if (
        !GEMINI_API_KEY ||
        GEMINI_API_KEY.startsWith("YOUR_") ||
        GEMINI_API_KEY.startsWith("paste-")
    ) {
        const err = new Error("Missing API key");
        err.code = "NO_KEY";
        throw err;
    }

    const response = await fetch(
        `${API_BASE}/${modelName}:streamGenerateContent?alt=sse`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents,
            }),
        },
    );

    if (!response.ok) {
        let detail = "";
        try {
            detail = (await response.json())?.error?.message || "";
        } catch {
            /* ignore */
        }
        const err = new Error(detail || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let blocked = false;

    const handleLine = (line) => {
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;

        let json;
        try {
            json = JSON.parse(payload);
        } catch {
            return;
        }

        if (json.promptFeedback?.blockReason) blocked = true;
        const candidate = json.candidates?.[0];
        if (candidate?.finishReason === "SAFETY") blocked = true;

        const parts = candidate?.content?.parts || [];
        const text = parts
            .filter((p) => !p.thought)
            .map((p) => p.text || "")
            .join("");
        if (text) {
            full += text;
            onText(full);
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        lines.forEach(handleLine);
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);

    if (!full.trim()) {
        const err = new Error(blocked ? "Blocked" : "Empty response");
        err.blocked = blocked;
        throw err;
    }
    return full;
}

async function generateReply(contents, onText) {
    const order = [activeModel, ...MODELS.filter((m) => m !== activeModel)];
    let lastError;

    for (const name of order) {
        try {
            const reply = await streamGemini(name, contents, onText);
            activeModel = name;
            return reply;
        } catch (error) {
            lastError = error;
            if (error.status !== 404) throw error; // only fall back on "model not found"
        }
    }
    throw lastError;
}

function getErrorMessage(error) {
    const msg = String(error?.message || "").toLowerCase();

    if (error?.code === "NO_KEY") {
        return "Gemini API key is missing. Add it to gemini-config.js.";
    }
    if (error?.blocked) {
        return "I can't help with that request. Try rephrasing your question.";
    }
    if (error?.status === 400 && msg.includes("api key")) {
        return "The Gemini API key is invalid. Check gemini-config.js.";
    }
    if (error?.status === 403) {
        return "Access denied. Check your API key restrictions in Google Cloud.";
    }
    if (error?.status === 404) {
        return "The AI model is unavailable right now. Please try again later.";
    }
    if (error?.status === 429) {
        return "Too many requests right now. Please wait a moment and try again.";
    }
    if (
        error instanceof TypeError ||
        msg.includes("failed to fetch") ||
        msg.includes("network")
    ) {
        return "Network error. Check your connection and try again.";
    }
    return "Sorry, I couldn't get a response. Please try again.";
}

/* ---------- Formatting (safe: HTML is escaped first) ---------- */

function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function inline(s) {
    return s
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(
            /(^|[\s(])\*([^\s*][^*]*?)\*(?=[\s).,!?:;]|$)/g,
            "$1<em>$2</em>",
        );
}

function formatMessage(text) {
    const lines = escapeHtml(text).split("\n");
    let html = "";
    let list = null;
    let inCode = false;
    let code = [];
    let para = [];

    const flushPara = () => {
        if (para.length) {
            html += `<p>${inline(para.join("<br>"))}</p>`;
            para = [];
        }
    };
    const closeList = () => {
        if (list) {
            html += `</${list}>`;
            list = null;
        }
    };
    const openList = (type) => {
        if (list !== type) {
            closeList();
            html += `<${type}>`;
            list = type;
        }
    };

    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            if (inCode) {
                html += `<pre><code>${code.join("\n")}</code></pre>`;
                code = [];
                inCode = false;
            } else {
                flushPara();
                closeList();
                inCode = true;
            }
            continue;
        }
        if (inCode) {
            code.push(line);
            continue;
        }

        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

        if (heading) {
            flushPara();
            closeList();
            html += `<h3>${inline(heading[1])}</h3>`;
        } else if (bullet) {
            flushPara();
            openList("ul");
            html += `<li>${inline(bullet[1])}</li>`;
        } else if (numbered) {
            flushPara();
            openList("ol");
            html += `<li>${inline(numbered[1])}</li>`;
        } else if (line.trim() === "") {
            flushPara();
            closeList();
        } else {
            closeList();
            para.push(line);
        }
    }

    if (inCode) html += `<pre><code>${code.join("\n")}</code></pre>`;
    flushPara();
    closeList();
    return html;
}

/* ---------- UI helpers ---------- */

function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(role, text) {
    emptyState.hidden = true;

    const wrap = document.createElement("div");
    wrap.className = `message ${role === "user" ? "user-message" : "bot-message"}`;

    const content = document.createElement("div");
    content.className = "message-content";
    if (role === "user") {
        content.textContent = text;
    } else {
        content.innerHTML = formatMessage(text);
    }

    wrap.appendChild(content);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return { wrap, content };
}

function showTyping(content) {
    content.innerHTML =
        '<div class="typing"><span></span><span></span><span></span></div>';
}

function clearMessages() {
    messagesEl.querySelectorAll(".message").forEach((el) => el.remove());
    emptyState.hidden = false;
}

function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
}

function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

function closeSidebar() {
    sidebar.classList.remove("open");
}

function makeTitle(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length > 40 ? clean.slice(0, 40) + "..." : clean;
}

/* ---------- Chat history ---------- */

function renderHistory() {
    const entries = Object.entries(chatsCache).sort(
        (a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0),
    );

    historyList.innerHTML = "";

    if (!entries.length) {
        const empty = document.createElement("li");
        empty.className = "history-empty";
        empty.textContent = "No chats yet";
        historyList.appendChild(empty);
        return;
    }

    entries.forEach(([id, meta]) => {
        const li = document.createElement("li");
        li.className = "history-item" + (id === currentChatId ? " active" : "");

        const titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "history-item-title";
        titleBtn.textContent = meta.title || "Untitled chat";
        titleBtn.title = meta.title || "Untitled chat";
        titleBtn.addEventListener("click", () => loadChat(id));

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "history-delete";
        delBtn.setAttribute("aria-label", "Delete chat");
        delBtn.textContent = "\u00D7";
        delBtn.addEventListener("click", () => deleteChat(id));

        li.append(titleBtn, delBtn);
        historyList.appendChild(li);
    });
}

function newChat() {
    if (isSending) return;
    currentChatId = null;
    history = [];
    chatTitleEl.textContent = "New chat";
    clearMessages();
    renderHistory();
    closeSidebar();
    input.focus();
}

async function loadChat(chatId) {
    if (isSending) return;
    if (chatId === currentChatId) {
        closeSidebar();
        return;
    }

    try {
        const snap = await get(ref(db, `chatMessages/${uid}/${chatId}`));
        const msgs = snap.exists()
            ? Object.values(snap.val()).sort((a, b) => a.ts - b.ts)
            : [];

        clearMessages();
        msgs.forEach((m) => addMessage(m.role, m.text));

        currentChatId = chatId;
        history = msgs.map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
        }));

        chatTitleEl.textContent = chatsCache[chatId]?.title || "Chat";
        renderHistory();
        closeSidebar();
    } catch (error) {
        console.error("Could not load chat:", error);
        alert("Could not load this chat. Please try again.");
    }
}

async function deleteChat(chatId) {
    if (isSending) return;
    if (!confirm("Delete this chat?")) return;

    try {
        await update(ref(db), {
            [`chats/${uid}/${chatId}`]: null,
            [`chatMessages/${uid}/${chatId}`]: null,
        });
        if (chatId === currentChatId) newChat();
    } catch (error) {
        console.error("Could not delete chat:", error);
        alert("Could not delete this chat. Please try again.");
    }
}

async function saveExchange(userText, botText) {
    try {
        const now = Date.now();
        let chatId = currentChatId;
        const isNew = !chatId;
        const updates = {};

        if (isNew) {
            chatId = push(ref(db, `chats/${uid}`)).key;
            updates[`chats/${uid}/${chatId}`] = {
                title: makeTitle(userText),
                createdAt: now,
                updatedAt: now,
            };
        } else {
            updates[`chats/${uid}/${chatId}/updatedAt`] = now;
        }

        const userKey = push(ref(db, `chatMessages/${uid}/${chatId}`)).key;
        const botKey = push(ref(db, `chatMessages/${uid}/${chatId}`)).key;
        updates[`chatMessages/${uid}/${chatId}/${userKey}`] = {
            role: "user",
            text: userText,
            ts: now,
        };
        updates[`chatMessages/${uid}/${chatId}/${botKey}`] = {
            role: "model",
            text: botText,
            ts: now + 1,
        };

        await update(ref(db), updates);

        if (isNew) {
            currentChatId = chatId;
            chatTitleEl.textContent = makeTitle(userText);
        }
    } catch (error) {
        console.error("Could not save chat:", error);
    }
}

/* ---------- Sending messages ---------- */

async function sendMessage(rawText) {
    const text = rawText.trim();
    if (!text || isSending || !uid) return;

    isSending = true;
    setBusy(true);
    input.value = "";
    autoResize();

    addMessage("user", text);
    const { wrap, content } = addMessage("model", "");
    showTyping(content);

    const userTurn = { role: "user", parts: [{ text }] };
    let reply = "";

    try {
        reply = await generateReply([...history, userTurn], (partial) => {
            content.innerHTML = formatMessage(partial);
            scrollToBottom();
        });
        history.push(userTurn, { role: "model", parts: [{ text: reply }] });
    } catch (error) {
        console.error("AI error:", error);
        wrap.classList.add("error");
        content.textContent = getErrorMessage(error);
        reply = "";
    }

    if (reply) await saveExchange(text, reply);

    isSending = false;
    setBusy(false);
    input.focus();
}

/* ---------- Events ---------- */

form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
    }
});

input.addEventListener("input", autoResize);

document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => sendMessage(btn.dataset.prompt));
});

newChatBtn.addEventListener("click", newChat);

sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

/* ---------- Auth + live history list ---------- */

onAuthStateChanged(auth, (user) => {
    if (stopHistory) {
        stopHistory();
        stopHistory = null;
    }

    if (!user) {
        window.location.href = "/auth/login.html";
        return;
    }

    uid = user.uid;

    stopHistory = onValue(
        ref(db, `chats/${uid}`),
        (snapshot) => {
            chatsCache = snapshot.exists() ? snapshot.val() : {};
            renderHistory();
        },
        (error) => console.error("Could not load chat history:", error),
    );
});
