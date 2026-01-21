import { getClientTableName } from "../mssql-db";

const TABLE = getClientTableName();

interface ColumnCache {
  values: string[];
  searchTerms: Map<string, string>; // lowercase term -> actual value
  lastRefresh: Date;
}

interface SynonymMap {
  [key: string]: string | string[];
}

class ColumnValueCache {
  private cache: Map<string, ColumnCache> = new Map();
  private synonymMap: SynonymMap = {};
  private statusGroups: SynonymMap = {
    "open": ["Won", "Lead", "Qualified Lead", "Submitted", "In Progress", "Pending", "In Review", "Under Consideration", "Active"],
    "won": ["Won", "Awarded", "Accepted"],
    "lost": ["Lost", "No Go", "Declined", "Rejected", "Closed - Lost"],
    "closed": ["Won", "Awarded", "Lost", "No Go", "Declined", "Closed", "Completed"],
    "pending": ["Pending", "In Review", "Under Consideration", "Submitted", "Lead", "Qualified Lead"],
    "active": ["Active", "In Progress", "Open", "Submitted", "Pending", "Lead", "Qualified Lead", "Won"]
  };
  
  private regionAliases: SynonymMap = {
    "uae": "MENA",
    "united arab emirates": "MENA",
    "middle east": "MENA",
    "gulf": "MENA",
    "west coast": "West",
    "east coast": ["East", "NA - East", "NA - Northeast"],
    "northeast": ["NA - Northeast", "Northeast"],
    "midwest": ["Central", "Midwest"],
    "pacific": "West",
    "europe": "Europe",
    "asia": ["Central Asia", "Southeast Asia", "Asia"]
  };

  private refreshInterval = 60 * 60 * 1000; // 1 hour
  private isInitialized = false;

  private columns = [
    { name: "Client", searchable: true },
    { name: "Company", searchable: true },
    { name: "PointOfContact", searchable: true },
    { name: "ProjectType", searchable: true },
    { name: "Division", searchable: true },
    { name: "Department", searchable: true },
    { name: "RequestCategory", searchable: true },
    { name: "Region", searchable: true },
    { name: "State", searchable: true },
    { name: "StatusChoice", searchable: true },
    { name: "City", searchable: true },
    { name: "ServiceType", searchable: true }
  ];

  async initialize(
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>
  ): Promise<void> {
    if (this.isInitialized) return;
    
    console.log("[ColumnCache] Initializing column value cache...");
    await this.refresh(dbQuery);
    this.isInitialized = true;
    console.log("[ColumnCache] Initialization complete");
  }

  async refresh(
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>
  ): Promise<void> {
    console.log("[ColumnCache] Refreshing cache...");
    
    const refreshPromises = this.columns.map(async (col) => {
      try {
        const sql = `SELECT DISTINCT "${col.name}" as val FROM "${TABLE}" WHERE "${col.name}" IS NOT NULL AND "${col.name}" != ''`;
        const results = await dbQuery(sql, []);
        const values = results.map(r => r.val).filter(Boolean);
        
        // Build search terms map
        const searchTerms = new Map<string, string>();
        for (const value of values) {
          // Add exact lowercase
          searchTerms.set(value.toLowerCase(), value);
          
          // Add individual words
          const words = value.toLowerCase().split(/[\s\/\-\(\),]+/).filter(w => w.length > 2);
          for (const word of words) {
            if (!searchTerms.has(word)) {
              searchTerms.set(word, value);
            }
          }
          
          // Add common abbreviations
          if (value.includes("(") && value.includes(")")) {
            const abbrev = value.match(/\(([^)]+)\)/);
            if (abbrev && abbrev[1]) {
              searchTerms.set(abbrev[1].toLowerCase(), value);
            }
          }
        }
        
        this.cache.set(col.name, {
          values,
          searchTerms,
          lastRefresh: new Date()
        });
        
        console.log(`[ColumnCache]   ${col.name}: ${values.length} unique values`);
      } catch (err) {
        console.error(`[ColumnCache] Error loading ${col.name}:`, err);
      }
    });
    
    await Promise.all(refreshPromises);
    this.buildSynonymMap();
  }

  private buildSynonymMap(): void {
    this.synonymMap = {};
    
    // Add ProjectType synonyms
    const projectTypes = this.cache.get("ProjectType");
    if (projectTypes) {
      for (const [term, value] of projectTypes.searchTerms) {
        if (term !== value.toLowerCase()) {
          this.synonymMap[term] = value;
        }
      }
    }
    
    // Add Region aliases
    Object.assign(this.synonymMap, this.regionAliases);
    
    console.log(`[ColumnCache] Built synonym map with ${Object.keys(this.synonymMap).length} entries`);
  }

  needsRefresh(): boolean {
    if (!this.isInitialized) return true;
    
    const firstCache = this.cache.values().next().value;
    if (!firstCache) return true;
    
    return Date.now() - firstCache.lastRefresh.getTime() > this.refreshInterval;
  }

  // Find which column contains the search term
  findMatchingColumn(searchTerm: string): { column: string; matchedValue: string } | null {
    const termLower = searchTerm.toLowerCase().trim();
    
    // Priority order for column checking
    const columnPriority = ["Client", "Company", "Region", "State", "ProjectType", "Division", "Department", "RequestCategory"];
    
    for (const colName of columnPriority) {
      const colCache = this.cache.get(colName);
      if (!colCache) continue;
      
      // Check exact match first
      if (colCache.searchTerms.has(termLower)) {
        return { column: colName, matchedValue: colCache.searchTerms.get(termLower)! };
      }
      
      // Check partial match
      for (const [cachedTerm, actualValue] of colCache.searchTerms) {
        if (cachedTerm.includes(termLower) || termLower.includes(cachedTerm)) {
          return { column: colName, matchedValue: actualValue };
        }
      }
    }
    
    return null;
  }

  // Resolve status synonym to actual database values
  resolveStatus(term: string): string[] {
    const termLower = term.toLowerCase().trim();
    
    // Check predefined groups
    if (this.statusGroups[termLower]) {
      const group = this.statusGroups[termLower];
      return Array.isArray(group) ? group : [group];
    }
    
    // Check actual status values from cache
    const statusCache = this.cache.get("StatusChoice");
    if (statusCache) {
      for (const [cachedTerm, actualValue] of statusCache.searchTerms) {
        if (cachedTerm === termLower || cachedTerm.includes(termLower)) {
          return [actualValue];
        }
      }
    }
    
    // Return as-is if no match
    return [term];
  }

  // Resolve region synonym to actual database values
  resolveRegion(term: string): string[] {
    const termLower = term.toLowerCase().trim();
    
    // Check predefined aliases
    if (this.regionAliases[termLower]) {
      const alias = this.regionAliases[termLower];
      return Array.isArray(alias) ? alias : [alias];
    }
    
    // Check cache
    const regionCache = this.cache.get("Region");
    if (regionCache) {
      for (const [cachedTerm, actualValue] of regionCache.searchTerms) {
        if (cachedTerm === termLower || cachedTerm.includes(termLower) || termLower.includes(cachedTerm)) {
          return [actualValue];
        }
      }
    }
    
    // Return as-is
    return [term];
  }

  // Resolve project type synonym
  resolveProjectType(term: string): string | null {
    const termLower = term.toLowerCase().trim();
    
    // Check synonym map
    if (this.synonymMap[termLower]) {
      const val = this.synonymMap[termLower];
      return Array.isArray(val) ? val[0] : val;
    }
    
    // Check cache
    const ptCache = this.cache.get("ProjectType");
    if (ptCache) {
      for (const [cachedTerm, actualValue] of ptCache.searchTerms) {
        if (cachedTerm === termLower || cachedTerm.includes(termLower) || termLower.includes(cachedTerm)) {
          return actualValue;
        }
      }
    }
    
    return null;
  }

  // Get all values for a column
  getColumnValues(columnName: string): string[] {
    return this.cache.get(columnName)?.values || [];
  }

  // Check if a value exists in any column
  async verifyValueExists(
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>,
    column: string,
    value: string
  ): Promise<number> {
    try {
      const sql = `SELECT COUNT(*) as cnt FROM "${TABLE}" WHERE "${column}" LIKE @p1`;
      const result = await dbQuery(sql, [`%${value}%`]);
      return result[0]?.cnt || 0;
    } catch (err) {
      console.error(`[ColumnCache] Error verifying value:`, err);
      return 0;
    }
  }

  // Run cascading resolution for a search term
  async cascadeResolve(
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>,
    searchTerm: string
  ): Promise<{ column: string; value: string; count: number } | null> {
    const termLower = searchTerm.toLowerCase().trim();
    
    console.log(`[ColumnCache] Cascading resolve for: "${searchTerm}"`);
    
    // Tier 1: Check cache for matches
    const cacheMatch = this.findMatchingColumn(searchTerm);
    if (cacheMatch) {
      console.log(`[ColumnCache]   Cache match: ${cacheMatch.column} = "${cacheMatch.matchedValue}"`);
      const count = await this.verifyValueExists(dbQuery, cacheMatch.column, cacheMatch.matchedValue);
      if (count > 0) {
        console.log(`[ColumnCache]   Verified: ${count} rows`);
        return { column: cacheMatch.column, value: cacheMatch.matchedValue, count };
      }
    }
    
    // Tier 2: Direct LIKE search on priority columns
    const priorityColumns = ["Client", "Company", "Region", "ProjectType", "Division"];
    const countResults: { column: string; count: number }[] = [];
    
    for (const col of priorityColumns) {
      const count = await this.verifyValueExists(dbQuery, col, searchTerm);
      if (count > 0) {
        countResults.push({ column: col, count });
      }
    }
    
    if (countResults.length > 0) {
      // Pick column with highest count
      countResults.sort((a, b) => b.count - a.count);
      const best = countResults[0];
      console.log(`[ColumnCache]   Direct match: ${best.column} with ${best.count} rows`);
      return { column: best.column, value: searchTerm, count: best.count };
    }
    
    // Tier 3: No match found
    console.log(`[ColumnCache]   No matches found for "${searchTerm}"`);
    return null;
  }

  // Verify a combination of filters
  async verifyCombination(
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>,
    filters: { column: string; value: string | string[] }[]
  ): Promise<number> {
    if (filters.length === 0) return 0;
    
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    for (const filter of filters) {
      if (Array.isArray(filter.value)) {
        const placeholders = filter.value.map((_, i) => `@p${paramIndex + i}`).join(", ");
        whereClauses.push(`"${filter.column}" IN (${placeholders})`);
        params.push(...filter.value);
        paramIndex += filter.value.length;
      } else {
        whereClauses.push(`"${filter.column}" LIKE @p${paramIndex}`);
        params.push(`%${filter.value}%`);
        paramIndex++;
      }
    }
    
    const sql = `SELECT COUNT(*) as cnt FROM "${TABLE}" WHERE ${whereClauses.join(" AND ")}`;
    
    try {
      const result = await dbQuery(sql, params);
      return result[0]?.cnt || 0;
    } catch (err) {
      console.error(`[ColumnCache] Error verifying combination:`, err);
      return 0;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const columnCache = new ColumnValueCache();
