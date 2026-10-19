import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { HELP_GUIDES, HELP_TABS } from "@/data/helpGuides";
import { contactHref, contactLabel } from "@/data/orgContact";

// "**Register Now**" → <strong>Register Now</strong>; everything else as text.
function StepText({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

const stepText = (step) => (typeof step === "string" ? step : step.text);
const plain = (text) => text.replace(/\*\*/g, "").toLowerCase();

// Everything a guide says, for the search box.
function guideMatches(guide, query) {
  const words = [guide.title, guide.intro || "", ...guide.steps.flatMap((s) => [stepText(s), ...(s.details || [])])];
  return words.some((w) => plain(w).includes(query));
}

function Guide({ guide }) {
  return (
    <section id={guide.id} className="help-guide">
      <h2>{guide.title}</h2>
      {guide.intro && (
        <p className="help-guide-intro">
          <StepText text={guide.intro} />
        </p>
      )}
      <ol className="help-steps">
        {guide.steps.map((step) => (
          <li key={stepText(step)}>
            <StepText text={stepText(step)} />
            {step.details && (
              <ul className="help-details">
                {step.details.map((detail) => (
                  <li key={detail}>
                    <StepText text={detail} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuideList({ guides }) {
  return (
    <>
      <nav className="help-toc-links" aria-label="Guides in this tab">
        {guides.map((guide) => (
          <a key={guide.id} href={`#${guide.id}`}>
            {guide.title}
          </a>
        ))}
      </nav>
      {guides.map((guide) => (
        <Guide key={guide.id} guide={guide} />
      ))}
    </>
  );
}

// The tab a link like /help#admins or /help#paying should open.
function tabFromHash(hash, tabs, guides) {
  const id = hash.replace(/^#/, "");
  if (tabs.some((t) => t.id === id)) return id;
  const guide = guides.find((g) => g.id === id);
  return tabs.find((t) => t.group === guide?.group)?.id || tabs[0].id;
}

// The runbook, in tabs: a refresher for everyone, members, climb officers and
// (for admins) every admin activity, plus FAQ, troubleshooting and a glossary.
export default function Help() {
  const { isAdmin } = useAuth();
  const { hash } = useLocation();
  const tabs = HELP_TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const guides = HELP_GUIDES.filter((guide) => !guide.adminOnly || isAdmin);
  const [active, setActive] = useState(() => tabFromHash(hash, tabs, guides));
  const [query, setQuery] = useState("");
  const tabButtonsRef = useRef({});
  const q = query.trim().toLowerCase();
  const href = contactHref("MMS Open Climbs help");

  function selectTab(id, focus = false) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) tabButtonsRef.current[id]?.focus();
  }

  function onTabKeyDown(e, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      selectTab(tabs[e.key === "Home" ? 0 : tabs.length - 1].id, true);
    } else if (step) {
      e.preventDefault();
      selectTab(tabs[(index + step + tabs.length) % tabs.length].id, true);
    }
  }

  const activeTab = tabs.find((t) => t.id === active) || tabs[0];
  const results = q ? guides.filter((g) => guideMatches(g, q)) : [];

  return (
    <div className="privacy-page">
      <Header />
      <main className="privacy-content help-content">
        <h1>Help</h1>
        <p className="help-intro">
          A refresher on everything in MMS Open Climbs. Pick the tab for what you&rsquo;re doing, or search.
        </p>

        <label className="help-search">
          <span className="sr-only">Search the guides</span>
          <input
            type="search"
            className="form-input"
            placeholder="Search every guide, e.g. waiver, refund, GCash"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {q ? (
          <div className="help-results">
            <p className="help-results-count" role="status">
              {results.length === 0
                ? `No guides mention “${query.trim()}”. Try another word.`
                : `${results.length} guide${results.length === 1 ? "" : "s"} mention “${query.trim()}”`}
            </p>
            {results.map((guide) => (
              <div key={guide.id}>
                <div className="help-result-tab">{guide.group}</div>
                <Guide guide={guide} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="help-tabs" role="tablist" aria-label="Help topics">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  ref={(el) => (tabButtonsRef.current[tab.id] = el)}
                  type="button"
                  role="tab"
                  id={`help-tab-${tab.id}`}
                  aria-selected={tab.id === activeTab.id}
                  aria-controls={`help-panel-${tab.id}`}
                  tabIndex={tab.id === activeTab.id ? 0 : -1}
                  className={`help-tab${tab.id === activeTab.id ? " is-active" : ""}`}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                >
                  {tab.group}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`help-panel-${activeTab.id}`}
              aria-labelledby={`help-tab-${activeTab.id}`}
              className="help-panel"
            >
              <p className="help-panel-intro">{activeTab.intro}</p>
              <GuideList guides={guides.filter((g) => g.group === activeTab.group)} />
            </div>
          </>
        )}

        <p className="help-contact">
          Still stuck? Contact your climb officers
          {href ? (
            <>
              , or <a href={href}>{contactLabel()}</a>
            </>
          ) : null}
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
