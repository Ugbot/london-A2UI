import { defineBrick } from "@/bricks/types";
import { dataGridSchema } from "./schema";
import { DataGrid } from "./component";

export const dataGridBrick = defineBrick({
  name: "DataGrid",
  description:
    "A high-powered data grid (ag-Grid) — sortable, filterable, resizable columns with pagination + virtual scroll over large datasets. Bind a row array via bindKey; columns are inferred from the data if not given. Use for tabular data heavier than the basic Table.",
  tags: ["table", "grid", "data", "aggrid", "sort", "filter", "rows", "spreadsheet", "viz"],
  schema: dataGridSchema,
  acceptsChildren: false,
  Component: DataGrid,
});
