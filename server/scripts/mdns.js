// Répond aux requêtes mDNS pour "taxij7.local" avec l'adresse IP locale de cette machine,
// pour permettre aux téléphones du même Wi-Fi d'utiliser un nom au lieu de l'IP.
const os = require("os");
const mdns = require("multicast-dns")();

const HOSTNAME = "taxij7.local";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const ip = getLanIp();
if (!ip) {
  console.error("Impossible de trouver une adresse IP locale.");
  process.exit(1);
}

mdns.on("query", (query) => {
  const match = query.questions.some((q) => q.type === "A" && q.name === HOSTNAME);
  if (match) {
    mdns.respond({
      answers: [{ name: HOSTNAME, type: "A", ttl: 120, data: ip }],
    });
  }
});

console.log(`Réponse mDNS active : ${HOSTNAME} -> ${ip}`);
