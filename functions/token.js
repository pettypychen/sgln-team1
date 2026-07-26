"use strict";

const crypto = require("node:crypto");

function derivePrivateToken(participantId, version, secret) {
  if (!secret) throw new Error("Private token secret is not configured.");
  const normalizedVersion = Number(version) || 1;
  return `private_${crypto
    .createHmac("sha256", secret)
    .update(`${participantId}:${normalizedVersion}`)
    .digest("hex")}`;
}

module.exports = { derivePrivateToken };
