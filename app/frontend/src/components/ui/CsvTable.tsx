interface CsvTableProps {
  content: string;
}

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);

  return rows;
}

export function CsvTable({ content }: CsvTableProps) {
  const [headers = [], ...rows] = parseCsv(content);

  if (!headers.length) {
    return <p className="m-0 text-small text-muted">No rows to display.</p>;
  }

  return (
    <table
      aria-label="CSV data"
      className="w-max min-w-full border-separate border-spacing-0 text-left text-small"
    >
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th
              key={`${index}-${header}`}
              scope="col"
              className="sticky top-0 z-10 min-w-32 border-b border-r border-hairline bg-stone-200 px-3 py-2.5 font-semibold first:border-l"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, rowIndex) => (
          <tr key={rowIndex} className="odd:bg-white/70">
            {headers.map((_, columnIndex) => (
              <td
                key={columnIndex}
                className="border-b border-r border-hairline px-3 py-2 align-top first:border-l"
              >
                {cells[columnIndex] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
