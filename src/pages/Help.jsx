import { useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { HELP_GROUPS, HELP_GUIDES } from "@/data/helpGuides";
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
  if (!query) return true;
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

// The runbook every member can open: step-by-step guides by task, grouped by
// who they're for, with the admin guides for admins.
export default function Help() {
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = HELP_GUIDES.filter((guide) => (!guide.adminOnly || isAdmin) && guideMatches(guide, q));
  const groups = HELP_GROUPS.map((group) => ({
    group,
    guides: visible.filter((guide) => guide.group === group),
  })).filter((g) => g.guides.length > 0);
  const href = contactHref("MMS Open Climbs help");

  return (
    <div className="privacy-page">
      <Header />
      <main className="privacy-content help-content">
        <h1>Help</h1>
        <p className="help-intro">
          Step-by-step guides for everything in MMS Open Climbs: from creating an account to paying, your
          waiver and climb day{isAdmin ? ", plus running a climb as an admin" : ""}.
        </p>

        <label className="help-search">
          <span className="sr-only">Search the guides</span>
          <input
            type="search"
            className="form-input"
            placeholder="Search the guides, e.g. waiver, refund, GCash"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {groups.length === 0 ? (
          <p className="help-empty">No guides mention &ldquo;{query.trim()}&rdquo;. Try another word.</p>
        ) : (
          <nav className="help-toc" aria-label="Guides">
            {groups.map(({ group, guides }) => (
              <div key={group} className="help-toc-group">
                <div className="help-toc-title">{group}</div>
                <div className="help-toc-links">
                  {guides.map((guide) => (
                    <a key={guide.id} href={`#${guide.id}`}>
                      {guide.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        )}

        {groups.map(({ group, guides }) => (
          <div key={group} className="help-group">
            <div className="help-group-title">{group}</div>
            {guides.map((guide) => (
              <Guide key={guide.id} guide={guide} />
            ))}
          </div>
        ))}

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
