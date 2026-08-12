import Icon from "@/components/Icon";
import { renderMarkdownLite } from "@/utils/markdownLite";
import {
  MOUNTAINEERING_CHECKLIST,
  MOUNTAINEERING_GUIDE_SECTIONS,
} from "@/data/mountaineeringGuide";

export default function MountaineeringGuideModal({ onClose }) {
  return (
    <div className="guide-overlay" onClick={onClose} role="presentation">
      <div
        className="guide-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Intro to Philippine mountaineering"
      >
        <div className="guide-header">
          <h3 className="guide-title">New to Mountaineering?</h3>
          <button className="guide-close" onClick={onClose} aria-label="Close">
            &#x2715;
          </button>
        </div>
        <p className="guide-intro">
          A quick primer on what climb ratings mean and what to expect before
          your first MMS climb.
        </p>

        <details className="guide-section" open>
          <summary>
            <span className="guide-section-icon">
              <Icon name={MOUNTAINEERING_CHECKLIST.icon} size={16} />
            </span>
            {MOUNTAINEERING_CHECKLIST.title}
            <span className="guide-section-arrow" aria-hidden="true">
              &#9656;
            </span>
          </summary>
          <div className="guide-section-body">
            <ul className="guide-checklist">
              {MOUNTAINEERING_CHECKLIST.items.map((item, i) => (
                <li key={i}>
                  <Icon
                    name="fileCheck"
                    size={15}
                    color="var(--green-light)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>

        {MOUNTAINEERING_GUIDE_SECTIONS.map((section) => (
          <details
            key={section.id}
            className={`guide-section${section.critical ? " guide-section-critical" : ""}`}
            open={section.critical || undefined}
          >
            <summary>
              <span className="guide-section-icon">
                <Icon name={section.icon} size={16} />
              </span>
              {section.title}
              {section.critical && (
                <span className="guide-section-badge">Must Know</span>
              )}
              <span className="guide-section-arrow" aria-hidden="true">
                &#9656;
              </span>
            </summary>
            <div className="guide-section-body">
              {section.paragraphs.map((p, i) => (
                <p key={i}>{renderMarkdownLite(p)}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((b, i) => (
                    <li key={i}>{renderMarkdownLite(b)}</li>
                  ))}
                </ul>
              )}
              {section.footnote && (
                <p className="guide-section-footnote">
                  {renderMarkdownLite(section.footnote)}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
