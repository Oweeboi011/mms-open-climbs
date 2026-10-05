import Icon from "@/components/Icon";
import SectionCard from "@/components/SectionCard";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import "./event.css";

export default function RequirementsCard({ climb }) {
  const required = REQUIRED_DOC_TYPES.filter((docType) => climb[docType.requiresField]);
  if (required.length === 0) return null;
  return (
    <SectionCard icon="alert" title="Requirements">
      <div className="event-callout">
        <div className="event-callout-title">
          <Icon name="alert" size={13} />
          Required Before Climb Day
        </div>
        <ul className="info-list event-callout-list">
          {required.map((docType) => (
            <li key={docType.key}>
              {docType.requirementLabel}
              {climb[docType.sampleUrlField] && (
                <>
                  {" — "}
                  <a href={climb[docType.sampleUrlField]} target="_blank" rel="noopener noreferrer">
                    &#128196; {docType.downloadButtonLabel}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
