import app, { expireFulfillmentReservations } from "./app.js";
import { prisma } from "./db.js";
import { cleanupSecurityData } from "./security.js";

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  console.log(`Swert Treat API listening on http://localhost:${port}`);
});
const reservationExpiryWorker = setInterval(() => {
  expireFulfillmentReservations().catch((error) => {
    console.error("Fulfilment reservation expiry failed.", { code: error.code || "INTERNAL" });
  });
}, 60_000);
reservationExpiryWorker.unref();
const securityCleanupWorker = setInterval(() => {
  cleanupSecurityData(prisma).catch((error) => {
    console.error("Security data cleanup failed.", { code: error.code || "INTERNAL" });
  });
}, 60 * 60 * 1000);
securityCleanupWorker.unref();

async function shutdown() {
  clearInterval(reservationExpiryWorker);
  clearInterval(securityCleanupWorker);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
