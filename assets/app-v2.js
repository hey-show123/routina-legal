import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const SUPABASE_URL = "https://vhflqwpmeyqfcwjocepg.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_OdizgY0UvyyGjmIfl_ENhg_DCCPDlvL";
const API_BASE = `${SUPABASE_URL}/functions/v1/routina-ai`;
const WEB_BASE = "https://hey-show123.github.io/routina-legal";
const path = location.pathname;
const page = path.includes("/oauth/consent") ? "consent" : path.includes("/changes") ? "change" : "account";
const titles = { consent: "AI接続の確認", change: "変更内容の確認", account: "AI接続と監査" };

document.body.insertAdjacentHTML("afterbegin", `
  <main class="shell">
    <header class="brand"><span class="brandmark">R</span><span>Routina</span></header>
    <section class="card">
      <p class="eyebrow">SECURE AI CONNECTION</p>
      <h1>${titles[page]}</h1>
      <p id="lead" class="lead">認証状態を確認しています…</p>
      <div id="status" class="status" role="status" aria-live="polite"></div>

      <form id="login" class="stack hidden">
        <label for="email">Routinaアカウントのメールアドレス</label>
        <input id="email" name="email" type="email" autocomplete="email" required placeholder="you@example.com">
        <button id="send-code" type="submit" class="primary">確認コードを送信</button>
        <div id="verify-code" class="stack hidden">
          <label for="otp">メールに届いた確認コード</label>
          <input id="otp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="6〜8桁">
          <button id="confirm-code" type="button" class="primary">本人確認して続ける</button>
        </div>
        <p class="fine">パスワードは使用しません。確認コードやアクセストークンを監査ログへ保存しません。</p>
      </form>

      <section id="consent" class="stack hidden">
        <div class="client"><span class="client-icon">AI</span><div><strong id="client-name"></strong><small id="client-origin"></small></div></div>
        <div class="permission"><span>i</span><div><strong>アカウント情報と継続接続</strong><small id="requested-scopes"></small></div></div>
        <div class="permission"><span>✓</span><div><strong>ルーティンを読む</strong><small>ルーティン、ステップ、スケジュールだけ。履歴・日記・位置情報は対象外です。</small></div></div>
        <fieldset>
          <legend>書き込み権限</legend>
          <label class="choice"><input type="radio" name="mode" value="confirm_each_write" checked><span><strong>変更ごとに確認</strong><small>AIは変更案を作り、この画面で承認するまで書き込みません。</small></span></label>
          <label class="choice"><input type="radio" name="mode" value="read_only"><span><strong>読み取りのみ</strong><small>AIからの提案・書き込みを禁止します。</small></span></label>
        </fieldset>
        <div class="actions"><button id="deny" class="secondary" type="button">拒否</button><button id="allow" class="primary" type="button">接続を許可</button></div>
      </section>

      <section id="change" class="stack hidden">
        <div class="client"><span class="client-icon">AI</span><div><strong id="change-client"></strong><small id="change-time"></small></div></div>
        <h2 id="change-summary"></h2>
        <ol id="operations" class="operations"></ol>
        <p class="warning">承認後もAIが適用を実行するまではデータは変わりません。適用後30日以内はUndoできますが、その後に編集された項目は上書きしません。</p>
        <div id="change-actions" class="actions"><button id="reject" class="secondary" type="button">拒否</button><button id="approve" class="primary" type="button">承認</button></div>
        <div id="undo-actions" class="actions hidden"><button id="undo" class="danger" type="button">この変更をUndo</button></div>
      </section>

      <section id="account" class="stack hidden">
        <div><h2>接続中のAI</h2><div id="connections" class="record-list"></div></div>
        <div><h2>変更履歴</h2><div id="changes" class="record-list"></div></div>
        <div><h2>監査ログ</h2><div id="audits" class="record-list"></div></div>
        <button id="sign-out" class="secondary" type="button">このブラウザからログアウト</button>
      </section>
    </section>
    <footer>OAuth 2.1 · 監査ログ · 安全なUndo</footer>
  </main>`);

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: false },
});
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");
const status = (message, error = false) => {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
};
const busy = (button, value) => { button.disabled = value; };
const session = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};
const login = async () => {
  const current = await session();
  if (current) return current;
  $("lead").textContent = "Routinaアカウントで本人確認してください。";
  show("login");
  return null;
};

let pendingEmail = "";
$("login").addEventListener("submit", async event => {
  event.preventDefault();
  busy($("send-code"), true);
  try {
    pendingEmail = $("email").value.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({ email: pendingEmail });
    if (error) throw error;
    show("verify-code");
    status("確認コードを送信しました。メールに届いた6〜8桁を入力してください。");
  } catch (error) {
    status(error.message || "送信できませんでした。", true);
  } finally {
    busy($("send-code"), false);
  }
});

$("confirm-code").addEventListener("click", async () => {
  const token = $("otp").value.replace(/\D/g, "");
  if (!/^\d{6,8}$/.test(token)) {
    status("6〜8桁の確認コードを入力してください。", true);
    return;
  }
  busy($("confirm-code"), true);
  try {
    const email = pendingEmail || $("email").value.trim().toLowerCase();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    location.reload();
  } catch (error) {
    status(error.message || "確認コードを検証できませんでした。", true);
    busy($("confirm-code"), false);
  }
});

const api = async (apiPath, options = {}) => {
  const current = await session();
  if (!current) throw new Error("ログインが必要です");
  const response = await fetch(API_BASE + apiPath, {
    ...options,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${current.access_token}`, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "処理できませんでした");
  return data;
};
const renderValue = value => value === null ? "null" : typeof value === "string" ? value : JSON.stringify(value);
const operationNames = {
  update_routine: "ルーティンを更新", archive_routine: "ルーティンをアーカイブ", add_step: "ステップを追加",
  update_step: "ステップを更新", archive_step: "ステップを削除", add_schedule: "スケジュールを追加",
  update_schedule: "スケジュールを更新", archive_schedule: "スケジュールを削除",
};

async function consentPage() {
  const authorizationId = new URLSearchParams(location.search).get("authorization_id");
  if (!authorizationId) {
    status("authorization_id がありません。AIクライアントから接続をやり直してください。", true);
    return;
  }
  if (!await login()) return;
  hide("login");
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error) throw error;
  if (data.redirect_url) {
    location.assign(data.redirect_url);
    return;
  }
  $("lead").textContent = "次のAIクライアントがRoutinaへの接続を求めています。";
  $("client-name").textContent = data.client.name || "AI client";
  $("client-origin").textContent = new URL(data.redirect_uri).origin;
  const scopeLabels = { openid: "本人識別", email: "メールアドレス", profile: "基本プロフィール", offline_access: "期限更新用の継続接続" };
  $("requested-scopes").textContent = (data.scope || "").split(/\s+/).filter(Boolean).map(scope => scopeLabels[scope] || scope).join("、");
  show("consent");
  $("deny").onclick = async () => {
    busy($("deny"), true);
    try {
      const { data: denied, error: denyError } = await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (denyError) throw denyError;
      location.assign(denied.redirect_url);
    } catch (denyError) {
      status(denyError.message || "拒否できませんでした。", true);
      busy($("deny"), false);
    }
  };
  $("allow").onclick = async () => {
    busy($("allow"), true);
    try {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const capabilities = mode === "read_only" ? ["routines:read"] : ["routines:read", "routines:write"];
      await api("/api/grants", { method: "POST", body: JSON.stringify({
        client_id: data.client.id, client_name: data.client.name || "AI client", mode, capabilities,
      }) });
      const { data: approved, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (approveError) throw approveError;
      location.assign(approved.redirect_url);
    } catch (approveError) {
      status(approveError.message || "接続を完了できませんでした。", true);
      busy($("allow"), false);
    }
  };
}

async function changePage() {
  if (!await login()) return;
  hide("login");
  const id = new URLSearchParams(location.search).get("id");
  if (!id) throw new Error("変更IDがありません。");
  const data = await api(`/api/change-sets/${encodeURIComponent(id)}`);
  $("lead").textContent = "AIが提案した内容を確認してください。";
  $("change-client").textContent = data.client_name;
  $("change-time").textContent = new Date(data.created_at).toLocaleString("ja-JP");
  $("change-summary").textContent = data.summary;
  const items = data.operations.map(operation => {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = operationNames[operation.op] || operation.op;
    li.append(title);
    if (operation.id) {
      const small = document.createElement("small");
      small.textContent = `対象: ${operation.id}`;
      li.append(small);
    }
    if (operation.fields) {
      const values = document.createElement("div");
      values.className = "operation-values";
      values.textContent = Object.entries(operation.fields).map(([key, value]) => `${key}: ${renderValue(value)}`).join("\n");
      li.append(values);
    }
    return li;
  });
  $("operations").replaceChildren(...items);
  show("change");
  if (data.status === "proposed") {
    $("approve").onclick = () => decide(id, "approve", $("approve"));
    $("reject").onclick = () => decide(id, "reject", $("reject"));
  } else {
    hide("change-actions");
    status(`現在の状態: ${data.status}`);
    if (data.status === "applied") show("undo-actions");
  }
  $("undo").onclick = () => decide(id, "undo", $("undo"));
}

async function decide(id, action, button) {
  busy(button, true);
  try {
    const result = await api(`/api/change-sets/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ action }) });
    hide("change-actions");
    hide("undo-actions");
    status(action === "approve" ? "承認しました。AIクライアントへ戻ると適用できます。" : action === "reject" ? "変更を拒否しました。" : "変更をUndoしました。端末へは次回同期で反映されます。");
    $("lead").textContent = `処理が完了しました（${result.status}）。`;
  } catch (error) {
    status(error.message || "処理できませんでした。", true);
    busy(button, false);
  }
}

const record = (title, subtitle, badge, button) => {
  const root = document.createElement("div");
  root.className = "record";
  const row = document.createElement("div");
  row.className = "record-row";
  const strong = document.createElement("strong");
  strong.textContent = title;
  row.append(strong);
  if (badge) {
    const mark = document.createElement("span");
    mark.className = "badge";
    mark.textContent = badge;
    row.append(mark);
  }
  root.append(row);
  if (subtitle) {
    const small = document.createElement("small");
    small.textContent = subtitle;
    root.append(small);
  }
  if (button) root.append(button);
  return root;
};

async function accountPage() {
  if (!await login()) return;
  hide("login");
  const data = await api("/api/account");
  $("lead").textContent = "許可したAI接続、変更履歴、秘密情報を含まない監査ログを確認できます。";
  const connections = data.connections.length ? data.connections.map(item => {
    const revoke = document.createElement("button");
    revoke.className = "danger";
    revoke.textContent = item.revoked_at ? "解除済み" : "接続を解除";
    revoke.disabled = Boolean(item.revoked_at);
    revoke.onclick = async () => {
      busy(revoke, true);
      try {
        await api("/api/grants/revoke", { method: "POST", body: JSON.stringify({ client_id: item.client_id }) });
        revoke.textContent = "解除済み";
        status("AI接続を解除しました。");
      } catch (error) {
        status(error.message || "解除できませんでした。", true);
        busy(revoke, false);
      }
    };
    const subtitle = (item.mode === "read_only" ? "読み取りのみ" : "変更ごとに確認") + (item.last_used_at ? ` · 最終利用 ${new Date(item.last_used_at).toLocaleString("ja-JP")}` : "");
    return record(item.client_name, subtitle, item.revoked_at ? "解除済み" : "接続中", revoke);
  }) : [record("接続はありません", "CodexやClaudeからMCP URLを追加すると、ここに表示されます。")];
  $("connections").replaceChildren(...connections);
  const changes = data.change_sets.length ? data.change_sets.map(item => {
    const link = document.createElement("a");
    link.href = `${WEB_BASE}/changes/?id=${encodeURIComponent(item.id)}`;
    link.textContent = "詳細を確認";
    return record(item.summary, `${item.client_name} · ${new Date(item.created_at).toLocaleString("ja-JP")}`, item.status, link);
  }) : [record("変更履歴はありません")];
  $("changes").replaceChildren(...changes);
  const audits = data.audit_logs.length ? data.audit_logs.map(item => record(
    item.tool_name,
    `${item.client_name} · ${new Date(item.created_at).toLocaleString("ja-JP")} · request ${item.request_id}`,
    item.result,
  )) : [record("監査ログはありません")];
  $("audits").replaceChildren(...audits);
  $("sign-out").onclick = async () => { await supabase.auth.signOut(); location.reload(); };
  show("account");
}

try {
  if (page === "consent") await consentPage();
  else if (page === "change") await changePage();
  else await accountPage();
} catch (error) {
  status(error.message || "画面を読み込めませんでした。", true);
}
