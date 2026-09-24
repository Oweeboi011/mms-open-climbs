import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { contactHref, contactLabel } from "@/data/orgContact";
import {
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_VERSION,
} from "@/data/privacyNotice";

export default function Privacy() {
  const href = contactHref("Privacy request — MMS Open Climbs");
  return (
    <div className="privacy-page">
      <Header />
      <main className="privacy-content">
        <h1>Privacy Notice</h1>
        <p className="privacy-version">Version {PRIVACY_NOTICE_VERSION}</p>
        {PRIVACY_NOTICE_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body && <p>{section.body}</p>}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section>
          <h2>Contact</h2>
          <p>
            For privacy requests, contact{" "}
            {href ? <a href={href}>{contactLabel()}</a> : contactLabel()}.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
