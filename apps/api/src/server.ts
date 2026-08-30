import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { photoWorker } from "./composition/index.js";

photoWorker.start();

app.listen(env.PORT, () => {
  console.log(`Intellery API running on PORT ${env.PORT}`);
});