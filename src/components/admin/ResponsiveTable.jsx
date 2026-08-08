import { useEffect, useRef } from "react";

// Admin tables are wide — a dozen columns is normal — and on a narrow screen
// that used to mean scrolling sideways to find half the data. Below the
// stacking breakpoint (see .admin-table rules in globals.css) each row becomes
// a labelled card instead, so every field stays visible.
//
// The labels come from the table's own <thead>, copied onto each cell as
// `data-label` and re-applied whenever rows change, so pages don't have to
// repeat their column names on every <td>. Cells that span columns (group
// headers, expanded detail panels) are left alone.
export default function ResponsiveTable({ children, className = "", style }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const table = wrapRef.current?.querySelector("table");
    if (!table) return;

    const applyLabels = () => {
      const labels = [...table.querySelectorAll("thead th")].map((th) =>
        th.textContent.trim(),
      );
      table.querySelectorAll("tbody tr").forEach((row) => {
        [...row.children].forEach((cell, i) => {
          if (cell.colSpan > 1) return;
          const label = labels[i];
          if (label) cell.setAttribute("data-label", label);
          else cell.removeAttribute("data-label");
        });
      });
    };

    applyLabels();
    // Rows come and go as data loads, filters change and rows expand.
    const observer = new MutationObserver(applyLabels);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  });

  return (
    <div
      ref={wrapRef}
      className={`admin-table-wrap ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
