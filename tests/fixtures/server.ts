import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
const sessions = new Map<string, string>();
const mvpStates = new Map<string, string>();
const secret = "fixture-private-value-never-upload";
function document(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px/1.6 system-ui;color:#142b20;background:#fff;max-width:800px;margin:50px auto;padding:24px}a{color:#075a45}button,input{font:inherit;padding:10px;margin:8px 0}button{background:#075a45;color:white;border:0;border-radius:5px;min-width:45px;min-height:44px}label{display:block}input{border:1px solid #56735f}nav{display:flex;gap:20px}h1{font-size:30px}dialog{padding:30px;border:2px solid #075a45;border-radius:8px}section{padding:20px;background:#f3f7f4;margin:20px 0}.secret{border:1px solid #aaa;padding:10px}:focus-visible{outline:3px solid #183eff;outline-offset:4px}</style></head><body><header><nav aria-label="Fixture navigation"><a href="/">Fixture home</a><a href="/public">Public barriers</a><a href="/correct">Correct page</a><a href="/protected">Protected account</a></nav></header><main>${body}</main></body></html>`;
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:4174");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const mvp = url.pathname.match(
    /^\/mvp\/(protected\/)?([a-zA-Z0-9-]+)(?:\/(repair|regress|remove|hide|expire))?$/,
  );
  if (mvp) {
    const protectedPage = !!mvp[1],
      id = mvp[2],
      action = mvp[3];
    const cookie = req.headers.cookie?.match(/fixture_session=([^;]+)/)?.[1];
    if (protectedPage && (!cookie || !sessions.has(cookie))) {
      res.writeHead(303, { Location: "/login" });
      res.end();
      return;
    }
    if (req.method === "POST" && action) {
      mvpStates.set(id, action);
      res.writeHead(303, {
        Location: `/mvp/${protectedPage ? "protected/" : ""}${id}`,
      });
      res.end();
      return;
    }
    const state = mvpStates.get(id) ?? "regress";
    if (state === "expire") {
      res.writeHead(303, { Location: "/login" });
      res.end();
      return;
    }
    const button =
      state === "remove"
        ? "<span>The save feature was removed.</span>"
        : `<button id="profile-save" ${state === "hide" ? "hidden" : ""} onclick="document.querySelector('#saved-status').textContent='Profile saved.'">${state === "repair" ? "Save profile" : ""}</button>`;
    res.end(
      document(
        "MVP remediation fixture",
        `<h1>Profile settings</h1><p>Role: ${protectedPage ? sessions.get(cookie!) : "public"}.</p><section><h2>Profile action</h2>${button}<p id="saved-status" role="status"></p></section><section><h2>Authorized development controls</h2>${["repair", "regress", "remove", "hide"].map((a) => `<form method="post" action="${url.pathname}/${a}"><button>${a === "repair" ? "Apply accessible name" : a === "regress" ? "Reintroduce missing name" : a === "remove" ? "Retire save feature" : "Hide save control"}</button></form>`).join("")}</section>`,
      ),
    );
    return;
  }
  const journey = url.pathname.match(
    /^\/journey(?:\/(protected))?(?:\/(good|broken))?$/,
  );
  if (journey) {
    const token = req.headers.cookie?.match(/fixture_session=([^;]+)/)?.[1];
    const role = token ? sessions.get(token) : undefined;
    if (journey[1] && !role) {
      res.writeHead(303, { Location: "/login" });
      res.end();
      return;
    }
    const broken = journey[2] === "broken";
    res.end(
      document(
        "Journey fixture",
        `<h1 id="journey-ready">Address journey</h1><p id="identity">Signed in as ${role ?? "public"}.</p>
      <button type="button" id="menu-toggle" aria-expanded="false" aria-controls="account-menu" onclick="const m=document.querySelector('#account-menu');m.hidden=!m.hidden;this.setAttribute('aria-expanded',String(!m.hidden));if(!m.hidden)document.querySelector('#menu-item').focus()">Account menu</button>
      <div id="account-menu" role="menu" hidden><button type="button" role="menuitem" id="menu-item" onclick="document.querySelector('#account-menu').hidden=true;document.querySelector('#menu-toggle').focus()">Close menu</button></div>
      <button type="button" id="section-toggle" aria-expanded="false" onclick="const s=document.querySelector('#expanded');s.hidden=!s.hidden;this.setAttribute('aria-expanded',String(!s.hidden))">More details</button><section id="expanded" hidden><h2>Expanded details</h2></section>
      <div role="tablist" aria-label="Address tabs"><button type="button" role="tab" id="tab-a" aria-selected="true" aria-controls="pane-a" onclick="document.querySelector('#pane-a').hidden=false;document.querySelector('#pane-b').hidden=true;this.setAttribute('aria-selected','true');document.querySelector('#tab-b').setAttribute('aria-selected','false')">Overview</button><button type="button" role="tab" id="tab-b" aria-selected="false" aria-controls="pane-b" onclick="document.querySelector('#pane-b').hidden=false;document.querySelector('#pane-a').hidden=true;this.setAttribute('aria-selected','true');document.querySelector('#tab-a').setAttribute('aria-selected','false')">Address</button></div><section role="tabpanel" id="pane-a" aria-labelledby="tab-a"><h2>Overview information</h2></section><section role="tabpanel" id="pane-b" aria-labelledby="tab-b" hidden><h2>Address information</h2></section>
      <button type="button" id="dialog-open" onclick="${broken ? "document.querySelector('#address-dialog').hidden=false" : "document.querySelector('#address-dialog').showModal()"}">Edit address</button>
      ${broken ? '<div role="dialog" id="address-dialog" aria-labelledby="address-title" hidden>' : '<dialog id="address-dialog" aria-labelledby="address-title">'}<h2 id="address-title">Address editor</h2><label>Street<input id="street" autocomplete="street-address"></label>${broken ? '<button type="button" id="dialog-barrier"></button>' : ""}<button type="button" id="cancel-dialog" onclick="${broken ? "document.querySelector('#address-dialog').hidden=true" : "document.querySelector('#address-dialog').close();document.querySelector('#dialog-open').focus()"}">Cancel</button>${broken ? "</div>" : "</dialog>"}
      <form id="address-form" onsubmit="event.preventDefault()"><label>Postal code<input id="postal" autocomplete="postal-code"></label><button type="button" id="validate" onclick="document.querySelector('#error-state').hidden=false;document.querySelector('#recovery').focus()">Check details</button><section id="error-state" hidden><h2>Invalid postal code</h2><p role="alert" id="error-alert">Enter a valid postal code.</p>${broken ? '<button type="button" id="error-barrier"></button>' : ""}<button type="button" id="recovery" onclick="${broken ? "void 0" : "document.querySelector('#error-state').hidden=true;document.querySelector('#done').hidden=false;document.querySelector('#postal').focus()"}">Try again</button></section></form>
      <p id="done" role="status" hidden>Recovery ready</p>
      <form action="/journey-submit" method="post"><button id="consequential">Place order</button></form>
      <button type="button" id="approved-write" onclick="fetch('/journey-write',{method:'POST'}).then(()=>document.querySelector('#write-status').textContent='Test setting changed')">Update test setting</button><p id="write-status" role="status"></p>
      <section class="secret"><h2>Excluded private area</h2><input id="private-input" type="password" value="${secret}" aria-label="Fixture secret"></section>
      <script>document.querySelector('#menu-toggle').focus()</script>`,
      ),
    );
    return;
  }
  if (["/journey-submit", "/journey-write"].includes(url.pathname)) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ changed: req.method === "POST" }));
    return;
  }
  if (url.pathname === "/health") {
    res.end("ok");
    return;
  }
  if (url.pathname === "/login" && req.method === "POST") {
    let data = "";
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 2000) {
        res.writeHead(413);
        res.end();
        return;
      }
    }
    const form = new URLSearchParams(data);
    const token = randomUUID();
    sessions.set(token, form.get("role") === "admin" ? "admin" : "customer");
    res.setHeader(
      "Set-Cookie",
      `fixture_session=${token}; HttpOnly; SameSite=Lax; Path=/`,
    );
    res.writeHead(303, { Location: "/protected" });
    res.end();
    return;
  }
  if (url.pathname === "/logout") {
    res.setHeader(
      "Set-Cookie",
      "fixture_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    res.writeHead(303, { Location: "/login" });
    res.end();
    return;
  }
  if (url.pathname === "/redirect-private") {
    res.writeHead(302, { Location: "http://127.0.0.1:54321/auth/v1/health" });
    res.end();
    return;
  }
  if (url.pathname === "/private-resource") {
    res.end(
      document(
        "Private subresource test",
        '<h1>Restricted network fixture</h1><p>The private image request must be blocked.</p><img src="http://127.0.0.1:4175/leak" alt="Private-network request fixture">',
      ),
    );
    return;
  }
  if (url.pathname === "/unstable") {
    res.end(
      document(
        "Changing content",
        '<h1>Changing content</h1><div id="live"></div><script>setInterval(()=>document.querySelector("#live").textContent=Date.now(),25)</script>',
      ),
    );
    return;
  }
  if (url.pathname === "/login") {
    res.end(
      document(
        "Sign in to fixture",
        `<h1>Sign in to the fixture</h1><p>This is a local test identity. Any email and password work; no real credentials are needed.</p><form method="post"><label>Email<input id="login-email" name="email" type="email" autocomplete="username" required></label><label>Password<input id="login-password" name="password" type="password" autocomplete="current-password" required></label><label>Role<select name="role"><option value="customer">Customer</option><option value="admin">Administrator</option></select></label><button id="login-submit">Sign in</button></form>`,
      ),
    );
    return;
  }
  if (url.pathname === "/protected") {
    const token = req.headers.cookie?.match(/fixture_session=([^;]+)/)?.[1];
    const role = token ? sessions.get(token) : null;
    if (!role) {
      res.writeHead(303, { Location: "/login" });
      res.end();
      return;
    }
    res.end(
      document(
        "Protected account",
        `<h1>Account settings</h1><p id="identity">Signed in as ${role}.</p><section><h2>Profile actions</h2><button id="unnamed"></button><p>This intentionally unnamed button should be reported.</p><button id="dialog-open" onclick="document.querySelector('dialog').showModal()">Edit address</button><a href="/logout">Sign out</a></section><div class="secret">${secret}<input type="password" value="${secret}" aria-label="Fixture secret"></div><dialog aria-labelledby="dialog-title"><h2 id="dialog-title">Edit shipping address</h2><form method="dialog"><label>Street<input name="street"></label><button id="dialog-unnamed"></button><button>Cancel</button></form></dialog><iframe title="Unsupported embedded fixture" src="/correct"></iframe>`,
      ),
    );
    return;
  }
  if (url.pathname === "/public") {
    res.end(
      document(
        "Public barriers",
        `<h1>Public accessibility fixture</h1><p>This page intentionally contains known rule failures.</p><section><h2>Known barriers</h2><button id="unnamed"></button><input id="unlabelled"><img src="/not-found.png"></section><section class="secret"><h2>Excluded private region</h2><p>${secret}</p><button></button></section>`,
      ),
    );
    return;
  }
  if (url.pathname === "/correct") {
    res.end(
      document(
        "Correct experience",
        '<h1>A correct basic experience</h1><p>Labels and button names are present. This is a controlled fixture, not a complete conformance claim.</p><section><h2>Account information</h2><label for="name">Full name</label><input id="name" autocomplete="name"><button>Save account information</button></section>',
      ),
    );
    return;
  }
  if (url.pathname === "/not-found.png") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.end(
    document(
      "Accessly controlled fixtures",
      '<h1>Controlled accessibility fixtures</h1><p>These local pages include correct and intentionally broken experiences for Accessly testing.</p><ul><li><a href="/public">Public page with known barriers</a></li><li><a href="/correct">Correct basic page</a></li><li><a href="/protected">Signed-in account with a dialog</a></li></ul>',
    ),
  );
});
server.listen(4174, "127.0.0.1", () =>
  console.log(
    "Controlled fixtures: http://127.0.0.1:4174. Use any test email/password for protected pages.",
  ),
);
process.on("SIGTERM", () => server.close());
