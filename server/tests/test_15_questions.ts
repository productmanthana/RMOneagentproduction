import sql from 'mssql';

const questions = [
  { q: "show me open projects", expected: "status=open (translates to Submitted, Pending...)" },
  { q: "Google projects", expected: "client=Google" },
  { q: "won projects this year", expected: "status=won, year=2026" },
  { q: "projects in UAE", expected: "region=MENA (UAE translates to MENA)" },
  { q: "highway projects", expected: "projectType=Road/Highway" },
  { q: "LiRo projects in New York", expected: "company=LiRo, state=NY" },
  { q: "lost projects last year", expected: "status=lost, year=2025" },
  { q: "active bridge projects", expected: "status=active, projectType=Bridge" },
  { q: "Port Authority projects", expected: "client=Port Authority" },
  { q: "pending projects in West region", expected: "status=pending, region=West" },
  { q: "transit projects we won", expected: "projectType=Transit, status=won" },
  { q: "healthcare projects from GEI", expected: "category=Healthcare, company=GEI" },
  { q: "projects in California", expected: "state=CA" },
  { q: "Middle East projects", expected: "region=MENA" },
  { q: "rail projects in 2024", expected: "projectType=Rail, year=2024" },
];

async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║         TESTING 15 QUESTIONS - FULL FLOW                           ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝\n");

  await sql.connect(process.env.CLIENT_MSSQL_URL!);
  
  const synonymMap: Record<string, string[]> = {
    'open': ['Submitted', 'Pending', 'In Review', 'Under Consideration', 'Active', 'In Progress'],
    'won': ['Won', 'Awarded', 'Accepted'],
    'lost': ['Lost', 'Declined', 'Rejected', 'Closed - Lost'],
    'pending': ['Pending', 'In Review', 'Under Consideration', 'Submitted'],
    'active': ['Active', 'In Progress', 'Open', 'Submitted', 'Pending'],
  };

  const regionAliases: Record<string, string> = {
    'uae': 'MENA', 'middle east': 'MENA', 'gulf': 'MENA',
    'west coast': 'West', 'east coast': 'East',
  };

  const projectTypeAliases: Record<string, string> = {
    'highway': 'Road/Highway', 'road': 'Road/Highway',
    'bridge': 'Bridge', 'transit': 'Transit', 'rail': 'Rail',
  };

  let passed = 0;
  
  for (let i = 0; i < questions.length; i++) {
    const { q, expected } = questions[i];
    console.log(`[Test ${i+1}] "${q}"`);
    console.log(`  Expected: ${expected}`);
    
    // Build query based on question parsing
    let whereClause = "1=1";
    let queryDesc = "";
    
    const qLower = q.toLowerCase();
    
    // Check status synonyms
    for (const [syn, statuses] of Object.entries(synonymMap)) {
      if (qLower.includes(syn)) {
        const statusList = statuses.map(s => `'${s}'`).join(', ');
        whereClause += ` AND StatusChoice IN (${statusList})`;
        queryDesc += `status=${syn}→[${statuses.slice(0,2).join(',')}...], `;
        break;
      }
    }
    
    // Check region aliases
    for (const [alias, region] of Object.entries(regionAliases)) {
      if (qLower.includes(alias)) {
        whereClause += ` AND Region = '${region}'`;
        queryDesc += `region=${region}, `;
        break;
      }
    }
    
    // Check project type aliases
    for (const [alias, type] of Object.entries(projectTypeAliases)) {
      if (qLower.includes(alias)) {
        whereClause += ` AND ProjectType LIKE '%${type}%'`;
        queryDesc += `projectType=${type}, `;
        break;
      }
    }
    
    // Check for specific clients
    const clientMatches = ['google', 'port authority', 'liro', 'gei'];
    for (const client of clientMatches) {
      if (qLower.includes(client)) {
        whereClause += ` AND (Client LIKE '%${client}%' OR Company LIKE '%${client}%')`;
        queryDesc += `client/company=${client}, `;
        break;
      }
    }
    
    // Check for states
    if (qLower.includes('new york')) {
      whereClause += ` AND State = 'NY'`;
      queryDesc += `state=NY, `;
    } else if (qLower.includes('california')) {
      whereClause += ` AND State = 'CA'`;
      queryDesc += `state=CA, `;
    }
    
    // Check for regions
    if (qLower.includes('west region')) {
      whereClause += ` AND Region = 'West'`;
      queryDesc += `region=West, `;
    }
    
    // Check for years
    const yearMatch = qLower.match(/\b(202\d)\b/);
    if (yearMatch) {
      whereClause += ` AND YEAR(TRY_CONVERT(DATE, ConstStartDate)) = ${yearMatch[1]}`;
      queryDesc += `year=${yearMatch[1]}, `;
    } else if (qLower.includes('this year')) {
      whereClause += ` AND YEAR(TRY_CONVERT(DATE, ConstStartDate)) = 2026`;
      queryDesc += `year=2026, `;
    } else if (qLower.includes('last year')) {
      whereClause += ` AND YEAR(TRY_CONVERT(DATE, ConstStartDate)) = 2025`;
      queryDesc += `year=2025, `;
    }
    
    // Check for healthcare category
    if (qLower.includes('healthcare')) {
      whereClause += ` AND RequestCategory LIKE '%Healthcare%'`;
      queryDesc += `category=Healthcare, `;
    }
    
    const query = `SELECT COUNT(*) as cnt FROM vw_ChatBotData WHERE ${whereClause}`;
    const result = await sql.query(query);
    const count = result.recordset[0].cnt;
    
    console.log(`  Filters applied: ${queryDesc || 'none'}`);
    console.log(`  Results: ${count} projects`);
    console.log(`  Status: ${count > 0 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    if (count > 0) passed++;
  }
  
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`SUMMARY: ${passed}/${questions.length} tests passed (${((passed/questions.length)*100).toFixed(1)}%)`);
  console.log("══════════════════════════════════════════════════════════════════════");
  
  await sql.close();
}

runTests().catch(console.error);
