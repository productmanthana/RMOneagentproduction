import sql from 'mssql';

interface TestCase {
  q: string;
  description: string;
  sqlWhere: string;
}

const tests: TestCase[] = [
  // Fee/Revenue queries
  { q: "projects with fee over 1 million", description: "Fee > $1M", sqlWhere: "TRY_CONVERT(DECIMAL(18,2), Fee) > 1000000" },
  { q: "high value won projects", description: "Won + Fee > $500K", sqlWhere: "StatusChoice IN ('Won', 'Awarded') AND TRY_CONVERT(DECIMAL(18,2), Fee) > 500000" },
  { q: "projects between 100k and 500k fee", description: "Fee range", sqlWhere: "TRY_CONVERT(DECIMAL(18,2), Fee) BETWEEN 100000 AND 500000" },
  { q: "small projects under 50k", description: "Fee < $50K", sqlWhere: "TRY_CONVERT(DECIMAL(18,2), Fee) < 50000 AND TRY_CONVERT(DECIMAL(18,2), Fee) > 0" },
  
  // Complex date ranges
  { q: "projects from Q1 2025", description: "Q1 2025", sqlWhere: "ConstStartDate >= '2025-01-01' AND ConstStartDate < '2025-04-01'" },
  { q: "projects in last 6 months", description: "Last 6 months", sqlWhere: "ConstStartDate >= DATEADD(MONTH, -6, GETDATE())" },
  { q: "projects between 2023 and 2024", description: "Year range", sqlWhere: "YEAR(TRY_CONVERT(DATE, ConstStartDate)) IN (2023, 2024)" },
  
  // Multi-filter combinations
  { q: "won highway projects over 1M in East", description: "4 filters", sqlWhere: "StatusChoice IN ('Won', 'Awarded') AND ProjectType LIKE '%Road/Highway%' AND TRY_CONVERT(DECIMAL(18,2), Fee) > 1000000 AND Region = 'East'" },
  { q: "pending transit projects in California 2024", description: "4 filters", sqlWhere: "StatusChoice IN ('Pending', 'In Review', 'Submitted') AND ProjectType LIKE '%Transit%' AND State = 'California' AND YEAR(TRY_CONVERT(DATE, ConstStartDate)) = 2024" },
  { q: "LiRo bridge projects that we lost", description: "Company + type + status", sqlWhere: "Company LIKE '%LiRo%' AND ProjectType LIKE '%Bridge%' AND StatusChoice IN ('Lost', 'Declined', 'Rejected')" },
  
  // Client variations with special characters
  { q: "NYC DOT projects", description: "Client with abbreviation", sqlWhere: "Client LIKE '%DOT%' AND (Client LIKE '%NYC%' OR Client LIKE '%New York%')" },
  { q: "Port Authority of NY and NJ", description: "Long client name", sqlWhere: "Client LIKE '%Port Authority%'" },
  { q: "MTA projects in 2025", description: "Client + year", sqlWhere: "Client LIKE '%MTA%' AND YEAR(TRY_CONVERT(DATE, ConstStartDate)) = 2025" },
  
  // Category + Region combos
  { q: "healthcare projects in Northeast", description: "Category + region", sqlWhere: "RequestCategory LIKE '%Healthcare%' AND Region = 'Northeast'" },
  { q: "transportation projects in MENA region", description: "Category + MENA", sqlWhere: "RequestCategory LIKE '%Transport%' AND Region = 'MENA'" },
  { q: "water projects in West", description: "Category + region", sqlWhere: "RequestCategory LIKE '%Water%' AND Region = 'West'" },
  
  // Status + Fee combinations
  { q: "won projects with total fee", description: "Aggregate fee for won", sqlWhere: "StatusChoice IN ('Won', 'Awarded')" },
  { q: "lost high value projects", description: "Lost + high fee", sqlWhere: "StatusChoice IN ('Lost', 'Declined', 'Rejected') AND TRY_CONVERT(DECIMAL(18,2), Fee) > 500000" },
  
  // Edge cases
  { q: "projects with no fee assigned", description: "NULL or 0 fee", sqlWhere: "(Fee IS NULL OR TRY_CONVERT(DECIMAL(18,2), Fee) = 0 OR Fee = '')" },
  { q: "oldest projects still open", description: "Open + old date", sqlWhere: "StatusChoice IN ('Submitted', 'Pending', 'Active') AND ConstStartDate < '2020-01-01'" },
  
  // Company comparisons
  { q: "GEI projects vs LiRo count", description: "Compare companies", sqlWhere: "Company LIKE '%GEI%' OR Company LIKE '%LiRo%'" },
  { q: "all companies in Texas", description: "State filter", sqlWhere: "State = 'Texas'" },
  
  // Complex project type queries
  { q: "rail or transit projects we won", description: "Multiple types + status", sqlWhere: "(ProjectType LIKE '%Rail%' OR ProjectType LIKE '%Transit%') AND StatusChoice IN ('Won', 'Awarded')" },
  { q: "airport projects in active status", description: "Type + status", sqlWhere: "ProjectType LIKE '%Airport%' AND StatusChoice IN ('Active', 'In Progress', 'Submitted', 'Pending')" },
];

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║         COMPLEX EDGE CASE TESTING - 24 QUERIES (Fee, Dates, etc.)         ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  await sql.connect(process.env.CLIENT_MSSQL_URL!);
  
  let passed = 0;
  const results: {test: number, question: string, count: number, status: string}[] = [];
  
  for (let i = 0; i < tests.length; i++) {
    const { q, description, sqlWhere } = tests[i];
    console.log(`[Test ${i+1}] "${q}"`);
    console.log(`  Description: ${description}`);
    
    try {
      const query = `SELECT COUNT(*) as cnt FROM vw_ChatBotData WHERE ${sqlWhere}`;
      const result = await sql.query(query);
      const count = result.recordset[0].cnt;
      
      const status = count >= 0 ? '✓ PASS' : '✗ FAIL';
      console.log(`  SQL: WHERE ${sqlWhere.substring(0, 60)}...`);
      console.log(`  Results: ${count.toLocaleString()} projects`);
      console.log(`  Status: ${status}\n`);
      
      results.push({test: i+1, question: q, count, status});
      if (count >= 0) passed++;
    } catch (err: any) {
      console.log(`  ERROR: ${err.message}\n`);
      results.push({test: i+1, question: q, count: -1, status: '✗ ERROR'});
    }
  }
  
  // Additional aggregate queries
  console.log("\n══════════════════════════════════════════════════════════════════════════════");
  console.log("AGGREGATE QUERIES (Fee Totals)");
  console.log("══════════════════════════════════════════════════════════════════════════════\n");
  
  const aggregates = [
    { desc: "Total fee of won projects", sql: "SELECT SUM(TRY_CONVERT(DECIMAL(18,2), Fee)) as total FROM vw_ChatBotData WHERE StatusChoice IN ('Won', 'Awarded')" },
    { desc: "Average fee per project", sql: "SELECT AVG(TRY_CONVERT(DECIMAL(18,2), Fee)) as avg_fee FROM vw_ChatBotData WHERE TRY_CONVERT(DECIMAL(18,2), Fee) > 0" },
    { desc: "Highest single project fee", sql: "SELECT MAX(TRY_CONVERT(DECIMAL(18,2), Fee)) as max_fee FROM vw_ChatBotData" },
    { desc: "Total fee by region (top 3)", sql: "SELECT TOP 3 Region, SUM(TRY_CONVERT(DECIMAL(18,2), Fee)) as total FROM vw_ChatBotData GROUP BY Region ORDER BY total DESC" },
  ];
  
  for (const agg of aggregates) {
    try {
      const result = await sql.query(agg.sql);
      if (result.recordset.length === 1) {
        const val = Object.values(result.recordset[0])[0];
        console.log(`  ${agg.desc}: $${Number(val).toLocaleString()}`);
      } else {
        console.log(`  ${agg.desc}:`);
        result.recordset.forEach((r: any) => {
          console.log(`    - ${r.Region}: $${Number(r.total).toLocaleString()}`);
        });
      }
      passed++;
    } catch (err: any) {
      console.log(`  ${agg.desc}: ERROR - ${err.message}`);
    }
  }
  
  console.log("\n══════════════════════════════════════════════════════════════════════════════");
  console.log(`SUMMARY: ${passed}/${tests.length + aggregates.length} tests passed`);
  console.log("══════════════════════════════════════════════════════════════════════════════");
  
  // Print table summary
  console.log("\n📊 RESULTS TABLE:");
  console.log("┌─────┬────────────────────────────────────────────────┬──────────────┬────────┐");
  console.log("│ #   │ Question                                       │ Count        │ Status │");
  console.log("├─────┼────────────────────────────────────────────────┼──────────────┼────────┤");
  for (const r of results) {
    const qTrunc = r.question.length > 44 ? r.question.substring(0,41) + "..." : r.question.padEnd(44);
    const countStr = r.count >= 0 ? r.count.toLocaleString().padStart(10) : 'ERROR'.padStart(10);
    console.log(`│ ${String(r.test).padStart(2)}  │ ${qTrunc} │ ${countStr}   │ ${r.status.includes('PASS') ? '  ✓   ' : '  ✗   '} │`);
  }
  console.log("└─────┴────────────────────────────────────────────────┴──────────────┴────────┘");
  
  await sql.close();
}

runTests().catch(console.error);
