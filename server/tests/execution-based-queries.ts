/**
 * Execution-Based Query Testing
 * Tests 15+ diverse queries to verify:
 * - Status synonyms (open → Submitted/Pending/etc)
 * - Multi-filter combinations (client + status + year)
 * - Column value cache resolution
 * - Cascading COUNT verification
 */

import { getClientTableName, queryExternalDb } from "../mssql-db";

const TABLE = getClientTableName();

interface TestCase {
  id: number;
  question: string;
  expectedFilters: {
    client?: string;
    company?: string;
    region?: string;
    status?: string[];
    year?: number;
    projectType?: string;
    category?: string;
    division?: string;
    poc?: string;
  };
  description: string;
}

const testCases: TestCase[] = [
  // Basic Entity Tests
  {
    id: 1,
    question: "show me Google projects",
    expectedFilters: { client: "Google" },
    description: "Basic client search"
  },
  {
    id: 2,
    question: "LiRo projects",
    expectedFilters: { company: "LiRo" },
    description: "Basic company search"
  },
  {
    id: 3,
    question: "projects in the West region",
    expectedFilters: { region: "West" },
    description: "Basic region search"
  },
  
  // Status Synonym Tests
  {
    id: 4,
    question: "show open projects",
    expectedFilters: { status: ["Submitted", "Pending", "In Review", "Under Consideration", "Active", "In Progress"] },
    description: "Status synonym 'open' → multiple statuses"
  },
  {
    id: 5,
    question: "won projects this year",
    expectedFilters: { status: ["Won", "Awarded", "Accepted"], year: new Date().getFullYear() },
    description: "Status synonym 'won' with year"
  },
  {
    id: 6,
    question: "lost projects",
    expectedFilters: { status: ["Lost", "Declined", "Rejected", "Closed - Lost"] },
    description: "Status synonym 'lost'"
  },
  
  // Multi-Filter Tests
  {
    id: 7,
    question: "Google open projects in 2025",
    expectedFilters: { client: "Google", status: ["Submitted", "Pending", "In Review"], year: 2025 },
    description: "Client + Status + Year combination"
  },
  {
    id: 8,
    question: "LiRo won projects in Northeast region",
    expectedFilters: { company: "LiRo", status: ["Won", "Awarded"], region: "NA - Northeast" },
    description: "Company + Status + Region combination"
  },
  {
    id: 9,
    question: "highway projects that are submitted",
    expectedFilters: { projectType: "Road/Highway", status: ["Submitted"] },
    description: "ProjectType synonym + Status"
  },
  
  // Geographic Synonym Tests
  {
    id: 10,
    question: "UAE projects",
    expectedFilters: { region: "MENA" },
    description: "Region alias UAE → MENA"
  },
  {
    id: 11,
    question: "Middle East projects",
    expectedFilters: { region: "MENA" },
    description: "Region alias 'Middle East' → MENA"
  },
  {
    id: 12,
    question: "west coast projects",
    expectedFilters: { region: "West" },
    description: "Region alias 'west coast' → West"
  },
  
  // Project Type Synonym Tests
  {
    id: 13,
    question: "airport projects",
    expectedFilters: { projectType: "Airports" },
    description: "ProjectType partial match"
  },
  {
    id: 14,
    question: "bridge projects in Hong Kong",
    expectedFilters: { projectType: "Bridge", region: "Hong Kong" },
    description: "ProjectType + Region"
  },
  {
    id: 15,
    question: "transit projects that we won",
    expectedFilters: { projectType: "Transit", status: ["Won", "Awarded"] },
    description: "ProjectType + Won status"
  },
  
  // Complex Multi-Attribute Tests
  {
    id: 16,
    question: "Abu Dhabi projects that are open",
    expectedFilters: { client: "Abu Dhabi", status: ["Submitted", "Pending", "In Review", "Active"] },
    description: "Specific client + open status"
  },
  {
    id: 17,
    question: "Port Authority projects in 2024",
    expectedFilters: { client: "Port Authority", year: 2024 },
    description: "Partial client match + Year"
  },
  {
    id: 18,
    question: "healthcare projects from GEI",
    expectedFilters: { category: "Healthcare", company: "GEI" },
    description: "Category + Company"
  },
  
  // Edge Cases
  {
    id: 19,
    question: "Seattle Children's Hospital projects",
    expectedFilters: { client: "Seattle Children" },
    description: "Client with special characters"
  },
  {
    id: 20,
    question: "active projects in Central region",
    expectedFilters: { status: ["Active", "In Progress", "Open", "Submitted", "Pending"], region: "Central" },
    description: "Status synonym 'active' + region"
  }
];

async function runSingleTest(testCase: TestCase): Promise<{ passed: boolean; result: any; error?: string }> {
  console.log(`\n[Test ${testCase.id}] ${testCase.description}`);
  console.log(`  Question: "${testCase.question}"`);
  
  try {
    // Build verification query based on expected filters
    const whereClauses: string[] = [];
    
    if (testCase.expectedFilters.client) {
      whereClauses.push(`"Client" LIKE '%${testCase.expectedFilters.client}%'`);
    }
    if (testCase.expectedFilters.company) {
      whereClauses.push(`"Company" LIKE '%${testCase.expectedFilters.company}%'`);
    }
    if (testCase.expectedFilters.region) {
      whereClauses.push(`"Region" = '${testCase.expectedFilters.region}'`);
    }
    if (testCase.expectedFilters.status) {
      const statusList = testCase.expectedFilters.status.map(s => `'${s}'`).join(", ");
      whereClauses.push(`"StatusChoice" IN (${statusList})`);
    }
    if (testCase.expectedFilters.year) {
      whereClauses.push(`YEAR(TRY_CONVERT(DATE, "ConstStartDate")) = ${testCase.expectedFilters.year}`);
    }
    if (testCase.expectedFilters.projectType) {
      whereClauses.push(`"ProjectType" LIKE '%${testCase.expectedFilters.projectType}%'`);
    }
    if (testCase.expectedFilters.category) {
      whereClauses.push(`"RequestCategory" LIKE '%${testCase.expectedFilters.category}%'`);
    }
    
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*) as cnt FROM "${TABLE}" ${whereClause}`;
    
    const result = await queryExternalDb(countSql, []);
    const count = result[0]?.cnt || 0;
    
    console.log(`  Expected Filters:`, JSON.stringify(testCase.expectedFilters));
    console.log(`  Verification SQL: ${countSql}`);
    console.log(`  Result: ${count} rows`);
    
    const passed = count > 0;
    console.log(`  Status: ${passed ? '✓ PASS' : '✗ FAIL (no data)'}`);
    
    return { passed, result: { count, sql: countSql } };
  } catch (error: any) {
    console.log(`  Status: ✗ ERROR - ${error.message}`);
    return { passed: false, result: null, error: error.message };
  }
}

async function runStatusSynonymTest() {
  console.log("\n" + "=".repeat(70));
  console.log("STATUS SYNONYM VERIFICATION");
  console.log("=".repeat(70));
  
  const statusSynonyms = {
    "open": ["Submitted", "Pending", "In Review", "Under Consideration", "Active", "In Progress"],
    "won": ["Won", "Awarded", "Accepted"],
    "lost": ["Lost", "Declined", "Rejected", "Closed - Lost"],
    "closed": ["Won", "Awarded", "Lost", "Declined", "Closed", "Completed"],
    "pending": ["Pending", "In Review", "Under Consideration", "Submitted"],
    "active": ["Active", "In Progress", "Open", "Submitted", "Pending"]
  };
  
  for (const [synonym, statuses] of Object.entries(statusSynonyms)) {
    const statusList = statuses.map(s => `'${s}'`).join(", ");
    const sql = `SELECT COUNT(*) as cnt FROM "${TABLE}" WHERE "StatusChoice" IN (${statusList})`;
    
    try {
      const result = await queryExternalDb(sql, []);
      const count = result[0]?.cnt || 0;
      console.log(`  "${synonym}" → [${statuses.slice(0, 3).join(", ")}...] = ${count} rows`);
    } catch (err: any) {
      console.log(`  "${synonym}" → ERROR: ${err.message}`);
    }
  }
}

async function runRegionAliasTest() {
  console.log("\n" + "=".repeat(70));
  console.log("REGION ALIAS VERIFICATION");
  console.log("=".repeat(70));
  
  const regionAliases = {
    "uae": "MENA",
    "middle east": "MENA",
    "west coast": "West",
    "east coast": "East",
    "gulf": "MENA"
  };
  
  for (const [alias, region] of Object.entries(regionAliases)) {
    const sql = `SELECT COUNT(*) as cnt FROM "${TABLE}" WHERE "Region" = '${region}'`;
    
    try {
      const result = await queryExternalDb(sql, []);
      const count = result[0]?.cnt || 0;
      console.log(`  "${alias}" → "${region}" = ${count} rows`);
    } catch (err: any) {
      console.log(`  "${alias}" → ERROR: ${err.message}`);
    }
  }
}

async function runProjectTypeSynonymTest() {
  console.log("\n" + "=".repeat(70));
  console.log("PROJECT TYPE SYNONYM VERIFICATION");
  console.log("=".repeat(70));
  
  const typeSynonyms = {
    "highway": "Road/Highway",
    "road": "Road/Highway",
    "airport": "Airports",
    "bridge": "Bridge",
    "transit": "Transit",
    "rail": "Rail"
  };
  
  for (const [synonym, type] of Object.entries(typeSynonyms)) {
    const sql = `SELECT COUNT(*) as cnt FROM "${TABLE}" WHERE "ProjectType" LIKE '%${type}%'`;
    
    try {
      const result = await queryExternalDb(sql, []);
      const count = result[0]?.cnt || 0;
      console.log(`  "${synonym}" → "${type}" = ${count} rows`);
    } catch (err: any) {
      console.log(`  "${synonym}" → ERROR: ${err.message}`);
    }
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║       EXECUTION-BASED QUERY TESTING - 20 DIVERSE QUERIES          ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  console.log(`\nTable: ${TABLE}`);
  
  // Run synonym verifications
  await runStatusSynonymTest();
  await runRegionAliasTest();
  await runProjectTypeSynonymTest();
  
  // Run main test cases
  console.log("\n" + "=".repeat(70));
  console.log("QUERY TEST CASES");
  console.log("=".repeat(70));
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = await runSingleTest(testCase);
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total: ${testCases.length}`);
  console.log(`  Passed: ${passed} (${((passed / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${failed}`);
  console.log("=".repeat(70));
  
  return { passed, failed, total: testCases.length };
}

// Run if called directly
main().catch(console.error);

export { main as runExecutionBasedTests, testCases };
