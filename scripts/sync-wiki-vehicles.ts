import { getPool } from "../src/lib/db/client";
import { upsertSearchRecord } from "../src/lib/db/upsert-repository";
import { fetchWikiVehicles, mapWikiVehicleToRecord } from "../src/lib/sources/star-citizen-wiki";

const pages = Math.max(1, Number(process.env.SYNC_PAGES ?? "1"));
const limit = Math.min(Math.max(1, Number(process.env.SYNC_LIMIT ?? "100")), 250);

let fetched = 0;
let saved = 0;

for (let page = 1; page <= pages; page += 1) {
  const response = await fetchWikiVehicles(page, limit);
  const vehicles = response.data ?? [];

  fetched += vehicles.length;

  for (const vehicle of vehicles) {
    const record = mapWikiVehicleToRecord(vehicle);
    if (!record) {
      continue;
    }

    await upsertSearchRecord(record);
    saved += 1;
  }
}

await getPool()?.end();

console.log(
  JSON.stringify(
    {
      source: "Star Citizen Wiki API",
      resource: "vehicles",
      pages,
      limit,
      fetched,
      saved
    },
    null,
    2
  )
);

