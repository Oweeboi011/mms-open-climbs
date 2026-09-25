export function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ReorderButtons({ index, count, onMove, label = "item" }) {
  return (
    <span className="reorder-buttons">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        title="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
        title="Move down"
      >
        ↓
      </button>
    </span>
  );
}
