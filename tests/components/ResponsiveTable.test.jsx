import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ResponsiveTable from "@/components/admin/ResponsiveTable";

function Table({ rows }) {
  return (
    <ResponsiveTable>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Climb</th>
            <th>Date</th>
            <th>Slots</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3}>Upcoming Climbs</td>
          </tr>
          {rows.map((r) => (
            <tr key={r.title}>
              <td>{r.title}</td>
              <td>{r.date}</td>
              <td>{r.slots}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

describe("ResponsiveTable", () => {
  it("labels each cell with its column header so stacked rows stay readable", () => {
    render(<Table rows={[{ title: "Mt. Pulag", date: "Aug 1-3", slots: "10" }]} />);
    expect(screen.getByText("Mt. Pulag")).toHaveAttribute("data-label", "Climb");
    expect(screen.getByText("Aug 1-3")).toHaveAttribute("data-label", "Date");
    expect(screen.getByText("10")).toHaveAttribute("data-label", "Slots");
  });

  it("leaves cells that span the row unlabelled", () => {
    render(<Table rows={[]} />);
    expect(screen.getByText("Upcoming Climbs")).not.toHaveAttribute("data-label");
  });

  it("labels rows added after the first render", async () => {
    function Growing() {
      const [rows, setRows] = useState([]);
      return (
        <>
          <button onClick={() => setRows([{ title: "Mt. Apo", date: "Sep 2", slots: "5" }])}>
            load
          </button>
          <Table rows={rows} />
        </>
      );
    }
    render(<Growing />);
    screen.getByText("load").click();
    await waitFor(() =>
      expect(screen.getByText("Mt. Apo")).toHaveAttribute("data-label", "Climb"),
    );
  });
});
