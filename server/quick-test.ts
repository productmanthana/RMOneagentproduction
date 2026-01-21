import fs from 'fs';

const API_URL = 'http://localhost:5000/api/query';

interface TestResult {
  query: string;
  success: boolean;
  rowCount: number;
  function_name?: string;
  error?: string;
}

async function runQuery(question: string, timeout: number = 60000): Promise<TestResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    
    return {
      query: question,
      success: data.row_count > 0,
      rowCount: data.row_count || 0,
      function_name: data.function_name,
      error: data.error
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      query: question,
      success: false,
      rowCount: 0,
      error: err.name === 'AbortError' ? 'timeout' : err.message
    };
  }
}

const testQueries = [
  // Organization/Client queries (the problematic pattern)
  { query: "DFW Airport projects", expected: ">0", desc: "Airport client" },
  { query: "DFW Airport open projects", expected: ">0", desc: "Airport + status" },
  { query: "show Google projects", expected: ">0", desc: "Tech company" },
  { query: "Abu Dhabi Airports Company projects", expected: ">0", desc: "Airport in name" },
  { query: "University Medical Center projects", expected: ">0", desc: "Medical in name" },
  
  // Company queries
  { query: "LiRo projects", expected: ">0", desc: "Company name" },
  { query: "Hill open projects", expected: ">0", desc: "Company + status" },
  { query: "Gafcon projects this year", expected: ">=0", desc: "Company + year" },
  
  // Category queries (should work normally)
  { query: "Healthcare projects", expected: ">0", desc: "Category" },
  { query: "Transportation projects", expected: ">0", desc: "Category" },
  { query: "Education projects", expected: ">0", desc: "Category" },
  
  // State/Region queries
  { query: "Texas projects", expected: ">0", desc: "State" },
  { query: "California projects", expected: ">0", desc: "State" },
  { query: "West region projects", expected: ">0", desc: "Region" },
  
  // POC queries
  { query: "Amy Wincko projects", expected: ">0", desc: "POC name" },
  { query: "Alex Ramos won projects", expected: ">=0", desc: "POC + status" },
  
  // ProjectType queries
  { query: "Aviation projects", expected: ">0", desc: "Project type" },
  { query: "Hospitals projects", expected: ">0", desc: "Project type" },
  
  // Combined filters
  { query: "top 10 projects by fee", expected: ">0", desc: "Top N" },
  { query: "open projects this year", expected: ">0", desc: "Status + year" },
  { query: "Won projects last year", expected: ">=0", desc: "Status + year" },
];

async function runTests() {
  console.log('=== QUICK COMPREHENSIVE TEST ===\n');
  console.log(`Running ${testQueries.length} test queries...\n`);
  
  const results: TestResult[] = [];
  const issues: string[] = [];
  
  for (const test of testQueries) {
    process.stdout.write(`Testing: "${test.query}"... `);
    const result = await runQuery(test.query);
    results.push(result);
    
    let passed = false;
    if (test.expected === ">0") {
      passed = result.rowCount > 0;
    } else if (test.expected === ">=0") {
      passed = result.rowCount >= 0 && !result.error;
    }
    
    if (passed) {
      console.log(`✓ ${result.rowCount} rows`);
    } else {
      console.log(`✗ ${result.rowCount} rows ${result.error ? `(${result.error})` : ''}`);
      issues.push(`"${test.query}" (${test.desc}): expected ${test.expected}, got ${result.rowCount}`);
    }
  }
  
  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.rowCount > 0 || !r.error).length;
  const failed = testQueries.length - passed;
  console.log(`Passed: ${passed}/${testQueries.length}`);
  console.log(`Failed: ${failed}`);
  
  if (issues.length > 0) {
    console.log('\n=== ISSUES FOUND ===');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  
  fs.writeFileSync('server/quick_test_results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to server/quick_test_results.json');
}

runTests().catch(console.error);
