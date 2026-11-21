// Line-based split CSV parser: a fast drop-in for csv-reader 1.0.0.
//
// Approach: split the whole text on LF once, then work line by line with a
// tight per-line loop. A plain line with no quote and no stray CR is answered
// by one native split(','). Quoted fields are scanned with indexOf/slice
// chunks, and a quoted field whose quote stays open simply carries over to
// the next line, joining the pieces with LF -- the only reassembly the
// format needs. Every quirk of csv-reader 1.0.0 is reproduced: the leading
// U+FEFF drop, stray_cr for a CR outside quotes, doubled quotes, CRLF and
// lone CR inside quotes read as LF, quote_junk after a closing quote,
// unterminated_quote (the quote turns literal and the rest is re-read as
// unquoted), quotes inside unquoted fields staying literal, no trimming or
// conversion, and short_row / long_row padding and cutting with errors in
// the order met. Error line numbers are the 1-based line the record starts
// on, counting every LF, CRLF and lone CR inside quotes.
//
// Dependency-free ES module. run(input) returns {columns, rows, errors}.

const COMMA = 0;
const LINE = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  // Split once on LF. A segment that ends with CR (and is not the last one)
  // ended in CRLF; its CR is the line terminator, not content.
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const lines = text.slice(start).split('\n');
  const nLines = lines.length;

  // Cursor state over the lines.
  let idx = 0; // index of the current line
  let line = 1; // 1-based line number of the current line
  let p = 0; // position inside the current line's content
  let raw = ''; // current line segment, terminator CR included if CRLF
  let end = 0; // end of the current line's content (excludes a CRLF CR)
  let last = false; // current line is the final segment (EOF, no terminator)
  let crlf = false; // current line ended in CRLF

  // The record being read: its start line and its index in rows.
  let recordLine = 1;
  let recordRow = null;

  function setCur() {
    raw = lines[idx];
    last = idx === nLines - 1;
    if (!last && raw.length > 0 && raw.charCodeAt(raw.length - 1) === 13) {
      crlf = true;
      end = raw.length - 1;
    } else {
      crlf = false;
      end = raw.length;
    }
  }

  function nextLine() {
    idx += 1;
    line += 1;
    if (idx < nLines) setCur();
  }

  // Reads unquoted characters onto `init` up to the next comma or line
  // break. A CR not followed by LF is dropped and reported as stray_cr.
  // Returns {value, ended, added} where added counts the characters kept
  // by this call (the initial value is not counted).
  function readUnquoted(init) {
    let value = init;
    let added = 0;
    for (;;) {
      if (p >= end) {
        if (last) return { value, ended: END, added };
        nextLine();
        p = 0;
        return { value, ended: LINE, added };
      }
      const comma = raw.indexOf(',', p);
      const cr = raw.indexOf('\r', p);
      if (comma !== -1 && comma < end && (cr === -1 || cr >= end || comma < cr)) {
        if (comma > p) {
          value += raw.slice(p, comma);
          added += comma - p;
        }
        p = comma + 1;
        return { value, ended: COMMA, added };
      }
      if (cr !== -1 && cr < end) {
        if (cr > p) {
          value += raw.slice(p, cr);
          added += cr - p;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        p = cr + 1;
        continue;
      }
      if (end > p) {
        value += raw.slice(p, end);
        added += end - p;
      }
      p = end;
    }
  }

  // Reads a quoted field whose opening quote is at the cursor. Doubled
  // quotes collapse to one; each CRLF or lone CR inside reads as LF. When
  // the line ends before the quote closes, the field carries over to the
  // next line with an LF joined in. A quote that never closes is a literal
  // character and the text after it is re-read as unquoted.
  function readQuoted() {
    const openIdx = idx;
    const openPos = p;
    const openLine = line;
    p += 1;
    let value = '';
    for (;;) {
      if (p >= end) {
        if (last) {
          idx = openIdx;
          p = openPos + 1;
          line = openLine;
          setCur();
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          return readUnquoted('"');
        }
        value += '\n';
        nextLine();
        p = 0;
        continue;
      }
      const q = raw.indexOf('"', p);
      const cr = raw.indexOf('\r', p);
      const qOk = q !== -1 && q < end;
      const crOk = cr !== -1 && cr < end;
      if (qOk && (!crOk || q < cr)) {
        if (raw.charCodeAt(q + 1) === 34) {
          value += raw.slice(p, q);
          value += '"';
          p = q + 2;
          continue;
        }
        value += raw.slice(p, q);
        p = q + 1;
        if (p >= end) {
          if (last) return { value, ended: END, added: 0 };
          nextLine();
          p = 0;
          return { value, ended: LINE, added: 0 };
        }
        if (raw.charCodeAt(p) === 44) {
          p += 1;
          return { value, ended: COMMA, added: 0 };
        }
        // Anything else after the closing quote is junk, appended as it
        // stands up to the next comma or line break.
        const junk = readUnquoted(value);
        if (junk.added > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
        return junk;
      }
      if (crOk) {
        value += raw.slice(p, cr);
        value += '\n';
        line += 1;
        p = cr + 1;
        continue;
      }
      value += raw.slice(p, end);
      p = end;
    }
  }

  setCur();
  for (;;) {
    // Past the last line there is nothing left to read. (A record that
    // ends at EOF leaves idx on the final line, so this guard -- not the
    // line content -- is what stops the loop.)
    if (idx >= nLines) break;
    // Lines with no characters are no records: an empty LF line, or a
    // CRLF line holding only its CR.
    if (end === 0) {
      if (last) break;
      nextLine();
      p = 0;
      continue;
    }
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    p = 0;
    let fields;
    let lastQuoted = false;
    let ended;

    // Fast path: a whole record on one line with no quote and no stray CR
    // is one native split. (A CR found at `end` is just the CRLF
    // terminator of this line.)
    const crPos = raw.indexOf('\r');
    if (raw.indexOf('"') === -1 && (crPos === -1 || crPos === end)) {
      fields = raw.slice(0, end).split(',');
      ended = last ? END : LINE;
      if (!last) nextLine();
      else idx += 1;
      p = 0;
    } else {
      fields = [];
      do {
        lastQuoted = raw.charCodeAt(p) === 34;
        const field = lastQuoted ? readQuoted() : readUnquoted('');
        fields.push(field.value);
        ended = field.ended;
      } while (ended === COMMA);
    }

    // A line that held only stray CRs is left with no characters: no
    // record (its stray_cr errors stay).
    const done = ended === END;
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) {
      if (done) break;
      continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      if (done) break;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
    if (done) break;
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
