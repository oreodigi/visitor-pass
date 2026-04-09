interface CsvRow {
  name?: string;
  mobile: string;
  business_name?: string;
}

interface ParseResult {
  rows: CsvRow[];
  errors: Array<{ row: number; reason: string }>;
}

const REQUIRED_COLUMN = 'mobile';
const KNOWN_COLUMNS = ['mobile', 'name', 'business_name'];

// Column name aliases to handle common CSV header variations
const COLUMN_ALIASES: Record<string, string> = {
  phone: 'mobile',
  phone_number: 'mobile',
  phonenumber: 'mobile',
  mobile_number: 'mobile',
  mobilenumber: 'mobile',
  mob: 'mobile',
  contact: 'mobile',
  contact_number: 'mobile',
  cell: 'mobile',
  telephone: 'mobile',
  full_name: 'name',
  fullname: 'name',
  attendee_name: 'name',
  attendeename: 'name',
  company: 'business_name',
  company_name: 'business_name',
  companyname: 'business_name',
  firm: 'business_name',
  firm_name: 'business_name',
  business: 'business_name',
  organization: 'business_name',
  organisation: 'business_name',
};

export function parseCsv(raw: string): ParseResult {
  const result: ParseResult = { rows: [], errors: [] };

  if (!raw || !raw.trim()) {
    result.errors.push({ row: 0, reason: 'CSV file is empty' });
    return result;
  }

  // Split into lines, handling \r\n and \n
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    result.errors.push({
      row: 0,
      reason: 'CSV must have a header row and at least one data row',
    });
    return result;
  }

  // Parse header row
  const rawHeaders = parseCsvLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, '_')
  );

  // Map headers to known column names
  const headers = rawHeaders.map((h) => {
    if (KNOWN_COLUMNS.includes(h)) return h;
    if (COLUMN_ALIASES[h]) return COLUMN_ALIASES[h];
    return h;
  });

  // Validate that required column exists
  if (!headers.includes(REQUIRED_COLUMN)) {
    result.errors.push({
      row: 0,
      reason: `CSV must contain a "${REQUIRED_COLUMN}" column. Found columns: ${rawHeaders.join(', ')}`,
    });
    return result;
  }

  const mobileIdx = headers.indexOf('mobile');
  const nameIdx = headers.indexOf('name');
  const businessIdx = headers.indexOf('business_name');

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const rowNum = i + 1; // 1-indexed, accounting for header

    const mobile = (values[mobileIdx] || '').trim();
    if (!mobile) {
      result.errors.push({ row: rowNum, reason: 'Mobile number is empty' });
      continue;
    }

    const row: CsvRow = {
      mobile,
      name: nameIdx >= 0 ? (values[nameIdx] || '').trim() || undefined : undefined,
      business_name:
        businessIdx >= 0
          ? (values[businessIdx] || '').trim() || undefined
          : undefined,
    };

    result.rows.push(row);
  }

  return result;
}

// ── Parse a single CSV line (handles quoted fields) ───────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  result.push(current);
  return result;
}
