"use strict";

const crypto = require("node:crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore();

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const BADGES = {
  "first-year-associate-ma-due-diligence": {
    name: "Diligence Counsel",
    symbol: "§",
    colors: ["#591f2b", "#9b3849", "#d6a85f"],
    shape: "legal",
  },
  "month-end-close-under-pressure": {
    name: "Close Controller",
    symbol: "Σ",
    colors: ["#173f55", "#2f7186", "#d1ad64"],
    shape: "accounting",
  },
  "requirements-gathering-workshop": {
    name: "Requirements Facilitator",
    symbol: "◇",
    colors: ["#3b315d", "#6a5a96", "#c5a969"],
    shape: "analyst",
  },
  "kopi-run": {
    name: "Kopi Coordinator",
    symbol: "☕",
    colors: ["#4a2515", "#8d4127", "#d5a646"],
    shape: "kopi",
  },
  "apac-pilot-pitch": {
    name: "Cross-Culture Navigator",
    symbol: "⇄",
    colors: ["#25384f", "#4f6f9d", "#c9b072"],
    shape: "analyst",
  },
};

function page({ credential, valid, appUrl }) {
  const badge = credential ? BADGES[credential.caseId] || BADGES["kopi-run"] : null;
  const title = valid ? `${badge.name} · SimWorks verified credential` : "Share link no longer valid · SimWorks";
  const description = valid
    ? `${credential.learnerDisplayName} earned the ${badge.name} credential from SimWorks through human-verified, AI-assisted evaluation.`
    : "This SimWorks public credential link is no longer valid.";
  const socialImage = `${appUrl}/credential-social-card.png`;
  const premium = credential?.supplementalLabel
    ? `<span class="premium" aria-label="Premium outcome accent">✦</span>`
    : "";
  const content = valid
    ? `<p class="eyebrow">SIMWORKS · VERIFIED CREDENTIAL</p>
       <div class="badge ${badge.shape}" style="--a:${badge.colors[0]};--b:${badge.colors[1]};--c:${badge.colors[2]}"><span>${escapeHtml(badge.symbol)}</span>${premium}</div>
       <h1>${escapeHtml(badge.name)}</h1>
       <p class="lead">Awarded to <strong>${escapeHtml(credential.learnerDisplayName)}</strong> for ${escapeHtml(credential.caseTitle)}${credential.supplementalLabel ? ` · ${escapeHtml(credential.supplementalLabel)}` : ""}.</p>
       <dl>
         <div><dt>Category</dt><dd>${escapeHtml(credential.category)}</dd></div>
         <div><dt>Issue date</dt><dd>${escapeHtml(new Date(credential.awardDate).toLocaleDateString("en-SG"))}</dd></div>
         <div><dt>Issuer</dt><dd>SimWorks</dd></div>
         <div><dt>Status</dt><dd class="valid">Valid</dd></div>
         <div class="wide"><dt>Credential ID</dt><dd class="mono">${escapeHtml(credential.id)}</dd></div>
       </dl>
       <p class="authority">Human verified with AI-assisted scoring</p>`
    : `<div class="invalid">×</div><h1>Share link no longer valid</h1><p class="lead">This public verification URL was revoked or does not exist. No private credential information is available from this link.</p>`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="index,follow">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="profile"><meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(socialImage)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(socialImage)}">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#eeede9;color:#242321;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
main{width:min(760px,100%);padding:52px 44px;text-align:center;background:white;border-radius:22px;box-shadow:0 1px 2px #0002,0 18px 50px #0001}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.2em;color:#797570}.badge{position:relative;display:grid;place-items:center;width:208px;height:208px;margin:32px auto;border-radius:32%;background:linear-gradient(135deg,var(--a),var(--b) 58%,var(--c));box-shadow:inset 0 0 0 3px #ffffff61,inset 0 0 0 9px #2d1e1238,0 18px 36px #0003}.badge:before{content:"";position:absolute;inset:14%;border:1px solid #ffffff73;border-radius:50%;background:#00000014}.badge>span:first-child{position:relative;font:76px Georgia,serif;color:white;text-shadow:0 3px 8px #0005}.premium{position:absolute!important;right:7%;top:7%;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#f4d27b;color:#4b3310!important;font:900 15px system-ui!important;border:1px solid #ffffffb3}
.badge.legal{border-radius:42% 42% 28% 28%;clip-path:polygon(50% 0,92% 16%,86% 72%,50% 100%,14% 72%,8% 16%)}.badge.accounting{border-radius:50%}.badge.analyst{border-radius:18%;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}.badge.kopi{border-radius:28%;clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)}
h1{margin:24px 0 10px;font:300 46px Georgia,serif}.lead{color:#67635e;line-height:1.6}.lead strong{color:#242321}dl{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:30px auto 0;padding:22px;text-align:left;background:#f4f3ef;border-radius:16px}dt{font-size:12px;color:#797570}dd{margin:5px 0 0;font-size:14px;font-weight:700}.wide{grid-column:1/-1}.mono{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all}.valid{color:#177245}.authority{margin:24px 0 0;font-size:14px;font-weight:700}.invalid{display:grid;place-items:center;width:84px;height:84px;margin:0 auto;border-radius:50%;background:#ddd9d2;font-size:34px}
@media(max-width:560px){main{padding:38px 22px}.badge{width:168px;height:168px}.badge>span:first-child{font-size:60px}h1{font-size:36px}dl{grid-template-columns:1fr}.wide{grid-column:auto}}
</style></head><body><main>${content}</main></body></html>`;
}

exports.publicCredentialPage = onRequest(
  { region: "us-central1", cors: false },
  async (req, res) => {
    const token = req.path
      .replace(/^\/verify\/?/, "")
      .replace(/^\/+|\/+$/g, "");
    let credential = null;
    if (token) {
      const grant = await db.collection("publicCredentialGrants").doc(hash(token)).get();
      if (grant.exists && !grant.data().revoked) {
        const snapshot = await db.collection("credentials").doc(grant.data().credentialId).get();
        if (snapshot.exists && snapshot.data().status === "public") credential = snapshot.data();
      }
    }
    const appUrl = (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    res
      .set("Cache-Control", "private, no-store")
      .set("Referrer-Policy", "no-referrer")
      .status(credential ? 200 : 410)
      .send(page({ credential, valid: Boolean(credential), appUrl }));
  },
);

exports._test = { escapeHtml, page };
