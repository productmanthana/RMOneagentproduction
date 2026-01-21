import fs from 'fs';

const API_URL = 'http://localhost:5000/api/query';

interface TestResult {
  query: string;
  success: boolean;
  rowCount: number;
  function_name?: string;
  error?: string;
  sql_has_issues?: string[];
}

interface ColumnData {
  column: string;
  values: string[];
}

async function runQuery(question: string): Promise<TestResult> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    
    const issues: string[] = [];
    const sql = data.sql_query || '';
    
    if (sql.includes('RequestCategory') && data.arguments?.organization) {
      issues.push('Has RequestCategory filter with organization');
    }
    if (sql.includes('"State"') && data.arguments?.organization) {
      issues.push('Has State filter with organization');
    }
    
    return {
      query: question,
      success: data.row_count > 0 || data.success,
      rowCount: data.row_count || 0,
      function_name: data.function_name,
      error: data.error,
      sql_has_issues: issues.length > 0 ? issues : undefined
    };
  } catch (err: any) {
    return {
      query: question,
      success: false,
      rowCount: 0,
      error: err.message
    };
  }
}

function generateQueries(columnData: ColumnData[]): string[] {
  const queries: string[] = [];
  
  const clientValues = columnData.find(c => c.column === 'Client')?.values || [];
  const companyValues = columnData.find(c => c.column === 'Company')?.values || [];
  const projectTypes = columnData.find(c => c.column === 'ProjectType')?.values || [];
  const categories = columnData.find(c => c.column === 'RequestCategory')?.values || [];
  const statuses = columnData.find(c => c.column === 'StatusChoice')?.values || [];
  const regions = columnData.find(c => c.column === 'Region')?.values || [];
  const states = columnData.find(c => c.column === 'State')?.values || [];
  const divisions = columnData.find(c => c.column === 'Division')?.values || [];
  const pocs = columnData.find(c => c.column === 'PointOfContact')?.values || [];
  
  const sampleClients = clientValues.filter(c => 
    c.toLowerCase().includes('airport') ||
    c.toLowerCase().includes('hospital') ||
    c.toLowerCase().includes('university') ||
    c.toLowerCase().includes('transit') ||
    c.toLowerCase().includes('school') ||
    c.toLowerCase().includes('city') ||
    c.toLowerCase().includes('county')
  ).slice(0, 15);
  
  const additionalClients = clientValues.slice(0, 10);
  const allTestClients = [...new Set([...sampleClients, ...additionalClients])];
  
  for (const client of allTestClients) {
    queries.push(`show ${client} projects`);
    queries.push(`${client} open projects`);
    queries.push(`${client} projects from last 5 years`);
    queries.push(`top 10 ${client} projects by fee`);
    queries.push(`${client} projects with status Won`);
  }
  
  for (const company of companyValues.slice(0, 5)) {
    queries.push(`show ${company} projects`);
    queries.push(`${company} open projects`);
    queries.push(`${company} projects this year`);
  }
  
  for (const category of categories.slice(0, 8)) {
    queries.push(`show ${category} projects`);
    queries.push(`${category} projects with high win rate`);
    queries.push(`open ${category} projects`);
  }
  
  for (const pt of projectTypes.slice(0, 10)) {
    queries.push(`show ${pt} projects`);
    queries.push(`${pt} projects last year`);
  }
  
  for (const poc of pocs.slice(0, 8)) {
    queries.push(`projects for ${poc}`);
    queries.push(`${poc} won projects`);
  }
  
  for (const state of states.slice(0, 10)) {
    queries.push(`${state} projects`);
    queries.push(`open projects in ${state}`);
  }
  
  for (const region of regions.slice(0, 8)) {
    queries.push(`${region} projects`);
    queries.push(`${region} region projects this year`);
  }
  
  for (const division of divisions.slice(0, 8)) {
    queries.push(`${division} division projects`);
  }
  
  return queries;
}

async function runTests(queries: string[], concurrency: number = 3): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    console.log(`Running batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(queries.length/concurrency)} (${batch.length} queries)...`);
    
    const batchResults = await Promise.all(batch.map(q => runQuery(q)));
    results.push(...batchResults);
    
    const successes = batchResults.filter(r => r.rowCount > 0).length;
    const zeros = batchResults.filter(r => r.rowCount === 0 && !r.error).length;
    const errors = batchResults.filter(r => r.error).length;
    
    console.log(`  ✓ ${successes} success, ⚠ ${zeros} zero rows, ✗ ${errors} errors`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

async function main() {
  console.log('=== COMPREHENSIVE QUERY TESTING ===\n');
  
  const columnData: ColumnData[] = JSON.parse(fs.readFileSync('server/column_values.json', 'utf-8'));
  
  console.log('Generating test queries...');
  const queries = generateQueries(columnData);
  console.log(`Generated ${queries.length} test queries\n`);
  
  console.log('Running tests (this may take a few minutes)...\n');
  const results = await runTests(queries, 2);
  
  const successCount = results.filter(r => r.rowCount > 0).length;
  const zeroRowCount = results.filter(r => r.rowCount === 0 && !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const issueCount = results.filter(r => r.sql_has_issues?.length).length;
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total queries: ${results.length}`);
  console.log(`✓ Success (>0 rows): ${successCount}`);
  console.log(`⚠ Zero rows: ${zeroRowCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`! SQL issues: ${issueCount}`);
  
  console.log('\n=== ZERO ROW QUERIES (potential issues) ===');
  const zeroRows = results.filter(r => r.rowCount === 0 && !r.error);
  zeroRows.slice(0, 30).forEach(r => {
    console.log(`  - "${r.query}" → ${r.function_name}`);
    if (r.sql_has_issues) {
      console.log(`    Issues: ${r.sql_has_issues.join(', ')}`);
    }
  });
  
  if (errorCount > 0) {
    console.log('\n=== ERROR QUERIES ===');
    results.filter(r => r.error).slice(0, 10).forEach(r => {
      console.log(`  - "${r.query}" → ${r.error}`);
    });
  }
  
  fs.writeFileSync('server/test_results.json', JSON.stringify(results, null, 2));
  console.log('\nFull results saved to server/test_results.json');
}

main().catch(console.error);
