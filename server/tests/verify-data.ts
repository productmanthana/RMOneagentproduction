import { queryExternalDb, getClientTableName } from "../mssql-db";
const TABLE = getClientTableName();

async function main() {
  console.log("Test 8 Analysis: LiRo won projects by region:");
  const q1 = await queryExternalDb(
    `SELECT "Region", COUNT(*) as cnt FROM "${TABLE}" 
     WHERE "Company" LIKE '%LiRo%' AND "StatusChoice" IN ('Won','Awarded')
     GROUP BY "Region" ORDER BY cnt DESC`, []
  );
  console.log(q1);

  console.log("\nTest 9 Analysis: Road/Highway by status:");
  const q2 = await queryExternalDb(
    `SELECT TOP 5 "StatusChoice", COUNT(*) as cnt FROM "${TABLE}" 
     WHERE "ProjectType" LIKE '%Road/Highway%'
     GROUP BY "StatusChoice" ORDER BY cnt DESC`, []
  );
  console.log(q2);

  console.log("\nTest 14 Analysis: Bridge projects by region:");
  const q3 = await queryExternalDb(
    `SELECT "Region", COUNT(*) as cnt FROM "${TABLE}" 
     WHERE "ProjectType" LIKE '%Bridge%'
     GROUP BY "Region" ORDER BY cnt DESC`, []
  );
  console.log(q3);
  
  process.exit(0);
}
main().catch(console.error);
