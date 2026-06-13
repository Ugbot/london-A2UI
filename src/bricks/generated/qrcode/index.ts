import { defineBrick } from "@/bricks/types";
import { schema } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "QRCode",
  description: "A scannable QR code generated from a value/URL, backed by qrcode.react.",
  tags: ["qr","qrcode","barcode","scan","link"],
  schema,
  acceptsChildren: false,
  Component,
});
