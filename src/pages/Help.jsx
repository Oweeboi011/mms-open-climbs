import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { HELP_GUIDES } from "@/data/helpGuides";
import { contactHref, contactLabel } from "@/data/orgContact";

// "**Register Now**" → <strong>Register Now</strong>; everything else as text.
function StepText({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

// The runbook every member can open: step-by-step guides by task, plus the
// admin guide for admins.
export default function Help() {
  const { isAdmin } = useAuth();
  const guides = HELP_GUIDES.filter((guide) => !guide.adminOnly || isAdmin);
  const href = contactHref("MMS Open Climbs help");

  return (
    <div className="privacy-page">
      <Header />
      <main className="privacy-content help-content">
        <h1>Help</h1>
        <p className="help-intro">Step-by-step guides for using MMS Open Climbs.</p>

        <nav className="help-toc" aria-label="Guides">
          {guides.map((guide) => (
            <a key={guide.id} href={`#${guide.id}`}>
              {guide.title}
            </a>
          ))}
        </nav>

        {guides.map((guide) => (
          <section key={guide.id} id={guide.id} className="help-guide">
            <h2>{guide.title}</h2>
            {guide.intro && <p>{guide.intro}</p>}
            <ol className="help-steps">
              {guide.steps.map((step) => (
                <li key={step}>
                  <StepText text={step} />
                </li>
              ))}
            </ol>
          </section>
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
