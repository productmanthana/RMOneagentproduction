import sql from 'mssql';

async function test() {
  try {
    await sql.connect(process.env.CLIENT_MSSQL_URL!);
    
    // Test searching by partial project name
    const result = await sql.query`
      SELECT TOP 5 Title, Client, StatusChoice 
      FROM vw_ChatBotData 
      WHERE Title LIKE '%Bridge%'
    `;
    console.log("Project name search 'Bridge':", result.recordset.length, "results");
    result.recordset.forEach(r => console.log(`  - ${r.Title}`));
    
    await sql.close();
  } catch (e) {
    console.error(e);
  }
}
test();
