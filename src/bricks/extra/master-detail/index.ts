import { defineBrick } from "@/bricks/types";
import { masterDetailSchema } from "./schema";
import { MasterDetail } from "./component";

export const masterDetailBrick = defineBrick({
  name: "MasterDetail",
  description:
    "A master-detail mini-SPA: a selectable list (items) on the left and the matching detail on the right. Provide `items` (label + optional subtitle) and ONE child composition per item, in order — each child is that item's detail (can be any bricks). Use for browse-then-inspect UIs, record viewers, dashboards with drill-down.",
  tags: ["spa", "master-detail", "list-detail", "navigation", "drilldown", "records", "browse"],
  schema: masterDetailSchema,
  acceptsChildren: true,
  Component: MasterDetail,
});
