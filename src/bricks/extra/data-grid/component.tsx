"use client";

/**
 * ag-Grid DataGrid — the "ggrid": a high-powered data grid (sort/filter/resize, pagination,
 * virtual scroll over large datasets). ag-Grid is imperative (createGrid + a GridApi), so
 * we init once on a ref and push rows/columns via setGridOption. v33+ Theming API
 * (themeQuartz) injects styles, so no CSS import is needed.
 */
import * as React from "react";
import {
  createGrid,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type GridApi,
  type ColDef,
} from "ag-grid-community";
import { useElementData } from "@/state/hooks";
import type { DataGridProps } from "./schema";

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = Record<string, unknown>;

function toColDefs(columns: DataGridProps["columns"], rows: Row[]): ColDef[] {
  const cols: DataGridProps["columns"] = columns.length
    ? columns
    : Object.keys(rows[0] ?? {}).map((field) => ({ field }));
  return cols.map((c) => ({
    field: c.field,
    headerName: c.headerName ?? c.field,
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 100,
  }));
}

export function DataGrid({ columns, rows, bindKey, height, pagination }: DataGridProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const api = React.useRef<GridApi | null>(null);
  const live = useElementData<Row[] | undefined>(bindKey, undefined);
  const data = Array.isArray(live) ? live : rows;

  React.useEffect(() => {
    if (!ref.current) return;
    api.current = createGrid(ref.current, {
      theme: themeQuartz,
      columnDefs: toColDefs(columns, data),
      rowData: data,
      pagination,
      paginationPageSize: 25,
      paginationPageSizeSelector: [25, 50, 100],
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
    // create once; subsequent data/column changes are pushed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    api.current?.setGridOption("rowData", data);
    api.current?.setGridOption("columnDefs", toColDefs(columns, data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columns]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
