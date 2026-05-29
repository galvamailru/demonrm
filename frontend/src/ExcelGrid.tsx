import { HotTable, HotTableClass } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GridColumn, GridSchema } from "./api";

registerAllModules();

interface ExcelGridProps {
  schema: GridSchema | null;
  readOnly?: boolean;
  onDataChange?: (rows: Record<string, unknown>[]) => void;
  onRowSelect?: (row: Record<string, unknown> | null) => void;
  height?: number;
}

function schemaToMatrix(schema: GridSchema): {
  colHeaders: string[];
  columns: GridColumn[];
  data: unknown[][];
} {
  const hasId = schema.rows.some((r) => r.id != null && r.id !== "");
  const columns = hasId
    ? [{ key: "id", title: "ID", width: 60, editable: false, type: "number" }, ...schema.columns]
    : schema.columns;

  const colHeaders = columns.map((c) => c.title);
  const data = schema.rows.map((row) =>
    columns.map((col) => {
      const v = row[col.key];
      if (col.type === "checkbox") {
        return v === true || v === "true" || v === 1;
      }
      if (col.type === "number") {
        return v === "" || v == null ? 0 : Number(v);
      }
      return v ?? "";
    })
  );

  return { colHeaders, columns, data };
}

function matrixToRows(
  columns: GridColumn[],
  data: unknown[][]
): Record<string, unknown>[] {
  return data
    .filter((row) => row.some((cell) => cell !== "" && cell != null))
    .map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        let val: unknown = row[i];
        if (col.type === "checkbox") {
          val = val === true || val === "true";
        } else if (col.type === "number") {
          val = val === "" || val == null ? 0 : Number(val);
        }
        obj[col.key] = val;
      });
      return obj;
    });
}

export default function ExcelGrid({
  schema,
  readOnly = false,
  onDataChange,
  onRowSelect,
  height = 420,
}: ExcelGridProps) {
  const hotRef = useRef<HotTableClass>(null);

  const parsed = useMemo(
    () => (schema ? schemaToMatrix(schema) : null),
    [schema]
  );

  const columnsConfig = useMemo(() => {
    if (!parsed) return [];
    return parsed.columns.map((col, idx) => {
      let cellType: "numeric" | "text" | "checkbox" | "date" = "text";
      if (col.type === "number") cellType = "numeric";
      else if (col.type === "checkbox") cellType = "checkbox";
      else if (col.type === "date") cellType = "date";

      return {
        data: idx,
        type: cellType,
        readOnly: readOnly || !col.editable,
        numericFormat:
          col.type === "number"
            ? { pattern: col.key.includes("pct") ? "0,0.00" : "0,0.00" }
            : undefined,
        dateFormat: col.type === "date" ? "YYYY-MM-DD" : undefined,
        width: col.width,
      };
    });
  }, [parsed, readOnly]);

  const afterChange = useCallback(() => {
    if (!parsed || !onDataChange || readOnly) return;
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;
    onDataChange(matrixToRows(parsed.columns, hot.getData() as unknown[][]));
  }, [parsed, onDataChange, readOnly]);

  const emitRowSelect = useCallback(
    (rowIndex: number) => {
      if (!parsed || !onRowSelect || rowIndex < 0) return;
      const hot = hotRef.current?.hotInstance;
      if (!hot) return;
      const rows = matrixToRows(parsed.columns, hot.getData() as unknown[][]);
      onRowSelect(rows[rowIndex] ?? null);
    },
    [parsed, onRowSelect]
  );

  useEffect(() => {
    if (!parsed || readOnly) return;
    const hot = hotRef.current?.hotInstance;
    if (hot) hot.loadData(parsed.data);
  }, [parsed, readOnly]);

  if (!parsed || !schema) {
    return <div className="grid-placeholder">Нет данных для отображения</div>;
  }

  return (
    <div className="excel-grid-wrap">
      <HotTable
        ref={hotRef}
        data={parsed.data}
        colHeaders={parsed.colHeaders}
        columns={columnsConfig}
        rowHeaders={true}
        stretchH="all"
        height={height}
        licenseKey="non-commercial-and-evaluation"
        manualColumnResize={true}
        manualRowResize={true}
        contextMenu={!readOnly}
        copyPaste={true}
        fillHandle={!readOnly}
        filters={true}
        dropdownMenu={true}
        columnSorting={true}
        readOnly={readOnly}
        afterChange={afterChange}
        afterSelectionEnd={(row) => emitRowSelect(row)}
        className="htCustom"
      />
    </div>
  );
}
