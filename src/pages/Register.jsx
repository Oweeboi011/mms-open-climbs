import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import RegistrationPolicyInfo from "@/components/RegistrationPolicyInfo";
import ConfirmSubmitModal from "@/pages/register/ConfirmSubmitModal";
import DonationPledgeSection from "@/pages/register/DonationPledgeSection";
import EmergencyContactSection from "@/pages/register/EmergencyContactSection";
import FeeBreakdownCard from "@/pages/register/FeeBreakdownCard";
import GcashPaymentSection from "@/pages/register/GcashPaymentSection";
import GcashQrModal from "@/pages/register/GcashQrModal";
import MedicalSection from "@/pages/register/MedicalSection";
import PersonalInfoSection from "@/pages/register/PersonalInfoSection";
import RegisterBlocked from "@/pages/register/RegisterBlocked";
import RegisterSuccess from "@/pages/register/RegisterSuccess";
import RequiredDocsSection from "@/pages/register/RequiredDocsSection";
import FormErrorSummary from "@/pages/register/FormErrorSummary";
import TrailPhotosStrip from "@/pages/register/TrailPhotosStrip";
import WaiverSection from "@/pages/register/WaiverSection";
import useRegistrationForm from "@/pages/register/useRegistrationForm";

export default function Register() {
  const {
    amountPaid, bindField, blockedReason, clearFieldError, climb, climbId, currentUser,
    doSubmit, docFiles, error, fieldErrors, form, handleSubmit, inputClass, loading, navigate,
    optionalFeeSelections, paymentFiles, paymentNote, paymentPreviews, paymentUploading,
    pledge, privacyConsent, qrModalOpen, setAmountPaid, setDocFiles, setField,
    setOptionalFeeSelections, setPaymentFiles, setPaymentNote, setPaymentPreviews, setPledge,
    setPrivacyConsent, setQrModalOpen, setShowConfirm, setSigName, setWaiverAgreed,
    showConfirm, sigName, submitting, successMissingDocs, successRegId, successUnpaid,
    waiverAgreed,
  } = useRegistrationForm();

  if (loading) return <LoadingSpinner fullPage />;

  if (!climb) {
    return (
      <div className="register-page">
        <Header />
        <main className="register-content">
          <div className="alert alert-error" role="alert">
            {error || "This climb could not be loaded."}
          </div>
          <Link to="/" className="btn btn-primary">
            Browse Climbs
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (blockedReason) {
    return (
      <RegisterBlocked blockedReason={blockedReason} climb={climb} climbId={climbId} />
    );
  }

  if (successRegId) {
    return (
      <RegisterSuccess
        climb={climb}
        currentUser={currentUser}
        successMissingDocs={successMissingDocs}
        successRegId={successRegId}
        successUnpaid={successUnpaid}
      />
    );
  }

  return (
    <div className="register-page">
      <Header />

      <nav className="back-nav">
        <button className="back-btn" onClick={() => navigate(-1)}>
          &#8592; Back
        </button>
      </nav>

      <main className="register-content">
        <div className="register-climb-banner">
          <div>
            <div className="register-climb-name">{climb.title}</div>
            <div className="register-climb-date">
              &#128197; {climb.dateLabel} &nbsp;|&nbsp; &#128205;{" "}
              {climb.location}
            </div>
          </div>
        </div>

        <TrailPhotosStrip climb={climb} />
        <FormErrorSummary error={error} fieldErrors={fieldErrors} />

        {climb.maxParticipants > 0 &&
          (climb.registrationCount ?? 0) >= climb.maxParticipants && (
            <div className="alert alert-warning" role="status">
              This climb is currently full. You can still register — you&rsquo;ll
              be placed on the waitlist and notified if a slot opens.
            </div>
          )}

        <form onSubmit={handleSubmit} noValidate>
          <PersonalInfoSection
            bindField={bindField}
            fieldErrors={fieldErrors}
            form={form}
            inputClass={inputClass}
            setField={setField}
          />

          <EmergencyContactSection
            bindField={bindField}
            fieldErrors={fieldErrors}
            form={form}
            inputClass={inputClass}
            setField={setField}
          />

          <MedicalSection form={form} setField={setField} />

          <RequiredDocsSection
            bindField={bindField}
            clearFieldError={clearFieldError}
            climb={climb}
            fieldErrors={fieldErrors}
            inputClass={inputClass}
            setDocFiles={setDocFiles}
          />

          <WaiverSection
            bindField={bindField}
            clearFieldError={clearFieldError}
            climb={climb}
            fieldErrors={fieldErrors}
            inputClass={inputClass}
            privacyConsent={privacyConsent}
            setPrivacyConsent={setPrivacyConsent}
            setSigName={setSigName}
            setWaiverAgreed={setWaiverAgreed}
            sigName={sigName}
            waiverAgreed={waiverAgreed}
          />

          <FeeBreakdownCard
            climb={climb}
            form={form}
            optionalFeeSelections={optionalFeeSelections}
            pledge={pledge}
            setOptionalFeeSelections={setOptionalFeeSelections}
          />

          <div className="register-form-card">
            <div className="form-section-title">Payment Deadline &amp; Cancellation</div>
            <RegistrationPolicyInfo climb={climb} />
          </div>

          <DonationPledgeSection climb={climb} pledge={pledge} setPledge={setPledge} />

          <GcashPaymentSection
            amountPaid={amountPaid}
            bindField={bindField}
            clearFieldError={clearFieldError}
            climb={climb}
            fieldErrors={fieldErrors}
            inputClass={inputClass}
            paymentFiles={paymentFiles}
            paymentNote={paymentNote}
            paymentPreviews={paymentPreviews}
            setAmountPaid={setAmountPaid}
            setPaymentFiles={setPaymentFiles}
            setPaymentNote={setPaymentNote}
            setPaymentPreviews={setPaymentPreviews}
            setQrModalOpen={setQrModalOpen}
          />

          {/* Not gated on waiverAgreed: a dead button with no message was the
              most common "I filled it out and nothing happened". Let
              validate() say what's missing and scroll the user to it. */}
          <button
            className="btn btn-primary btn-block btn-lg"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner spinner-sm" />{" "}
                {paymentUploading ? "Uploading payment…" : "Submitting…"}
              </>
            ) : (
              "Submit Registration"
            )}
          </button>
        </form>
      </main>

      <Footer />

      <ConfirmSubmitModal
        amountPaid={amountPaid}
        climb={climb}
        doSubmit={doSubmit}
        docFiles={docFiles}
        form={form}
        optionalFeeSelections={optionalFeeSelections}
        paymentFiles={paymentFiles}
        pledge={pledge}
        setShowConfirm={setShowConfirm}
        showConfirm={showConfirm}
      />

      <GcashQrModal climb={climb} qrModalOpen={qrModalOpen} setQrModalOpen={setQrModalOpen} />
    </div>
  );
}
