"use strict";
const path = require("path");
const { createApp } = require("./app");

const port = Number(process.env.PORT) || 3000;
const app = createApp({
  dataDir: process.env.DATA_DIR || path.join(__dirname, "..", "data"),
  secureCookies: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY || false
});

// Empty the 30-day document trash at start-up and every 6 hours.
const purgar = () => { const n = app.locals.purgarPapelera(); if (n) console.log("Papelera: " + n + " documento(s) eliminados definitivamente."); };
purgar();
setInterval(purgar, 6 * 3600 * 1000).unref();

app.listen(port, () => console.log("Expedientes escuchando en http://localhost:" + port));
