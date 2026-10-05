import Icon from "@/components/Icon";

// The white card with a coloured title bar used down the event page and in
// fee / donation panels. Styles: .section-card / .section-header /
// .section-body in globals.css.
export default function SectionCard({ icon, title, children, className = "" }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <div className="section-header">
        <span className="icon">
          <Icon name={icon} size={17} />
        </span>
        <h3>{title}</h3>
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}
