import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

test("renders learn react link", async () => {
  render(<App />);
  window.postMessage(
    JSON.stringify({
      source: "bigquery-runner",
      payload: {
        event: "rows",
        payload: {
          header: [
            "order_id",
            "items.product_id",
            "items.quantity",
            "items.name",
            "items.price",
          ],
          rows: [
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 0,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 1,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: 1,
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
          ],
          page: { rowsPerPage: 100, current: 2 },
          numRows: "123000",
        },
      },
    }),
    "*"
  );

  await waitFor(() => {
    const els = screen.getAllByText(/wallet/i);
    els.forEach((el) => expect(el).toBeInTheDocument());
  });
});
