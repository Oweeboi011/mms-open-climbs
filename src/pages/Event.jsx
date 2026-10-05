import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DonationDriveInfo from "@/components/DonationDriveInfo";
import EventFeesCard from "@/components/EventFeesCard";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import MountaineeringGuideModal from "@/components/MountaineeringGuideModal";
import RegisterCta from "@/components/RegisterCta";
import RegistrationPolicyInfo from "@/components/RegistrationPolicyInfo";
import { useAuth } from "@/contexts/AuthContext";
import Announcements from "@/pages/event/Announcements";
import ClimbOfficers from "@/pages/event/ClimbOfficers";
import ClimbResources from "@/pages/event/ClimbResources";
import EventHero from "@/pages/event/EventHero";
import ItinerarySection from "@/pages/event/ItinerarySection";
import MountainProfile from "@/pages/event/MountainProfile";
import PackingAndEthics from "@/pages/event/PackingAndEthics";
import ParticipantsBody from "@/pages/event/ParticipantsBody";
import PhotoCarousel from "@/pages/event/PhotoCarousel";
import PhotoLightbox from "@/pages/event/PhotoLightbox";
import PreClimbMeetings from "@/pages/event/PreClimbMeetings";
import RequirementsCard from "@/pages/event/RequirementsCard";
import SignInModal from "@/pages/event/SignInModal";
import TrailMapSection from "@/pages/event/TrailMapSection";
import WaterSource from "@/pages/event/WaterSource";
import WeatherSection from "@/pages/event/WeatherSection";
import useWeatherForecast from "@/hooks/useWeatherForecast";
import { getClimb, getClimbPrivate } from "@/services/climbs";
import { findUserRegistrationsForClimb } from "@/services/registrations";
import { getEffectiveStatus } from "@/utils/climbStatus";
import { getSlotSummary } from "@/utils/slotSummary";
import { getClimbCoords, getMapEmbed, getTrailEmbeds, getTrailMapEntries } from "@/utils/eventMaps";
import SectionCard from "@/components/SectionCard";

export default function Event() {
  const { climbId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();

  const [climb, setClimb] = useState(null);
  const [privateInfo, setPrivateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyReg, setAlreadyReg] = useState(false);
  const [regStatus, setRegStatus] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedTrailIdx, setSelectedTrailIdx] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const weather = useWeatherForecast(climb);
  const contentRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const climbDoc = await getClimb(climbId);
        if (!climbDoc) {
          navigate("/");
          return;
        }
        setClimb(climbDoc);

        if (currentUser) {
          const [reg] = await findUserRegistrationsForClimb(climbId, currentUser.uid);
          let isRegistered = false;
          if (reg) {
            if (reg.status !== "cancelled") {
              isRegistered = true;
              setAlreadyReg(true);
              setRegStatus(reg.status);
            }
          }

          // Pre-climb meeting details and resource links are registrants
          // (+ admin) only — the climbPrivate security rule enforces this
          // server-side too, so this fetch simply won't return data for
          // anyone else.
          if (isRegistered || isAdmin) {
            const priv = await getClimbPrivate(climbId);
            if (priv) {
              setPrivateInfo(priv);
              // Maintained server-side (syncParticipantList): members can't
              // query other people's registrations directly.
              setParticipants(priv.participants || []);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [climbId, currentUser, isAdmin, navigate]);

  useEffect(() => {
    if (!contentRef.current) return;
    const cards = contentRef.current.querySelectorAll(".section-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  });

  if (loading) return <LoadingSpinner fullPage />;
  if (!climb) return null;

  const { isFull } = getSlotSummary(climb);
  const isOpen = climb.status === "open";
  const isCancelled = getEffectiveStatus(climb) === "cancelled";
  const isPostponed = climb.cancellationStatus === "postponed";

  const registerCta = (
    <RegisterCta
      climbId={climbId}
      isCancelled={isCancelled}
      isPostponed={isPostponed}
      isOpen={isOpen}
      alreadyReg={alreadyReg}
      regStatus={regStatus}
      currentUser={currentUser}
      isFull={isFull}
    />
  );

  const mapCoords = getClimbCoords(climb);

  const trailMapEntries = getTrailMapEntries(climb);
  const activeTrailIdx = Math.min(selectedTrailIdx, Math.max(trailMapEntries.length - 1, 0));
  const activeTrail = trailMapEntries[activeTrailIdx];
  const { allTrails: allTrailsEmbed, komoot: komootEmbed } = getTrailEmbeds(activeTrail);
  const activeTrailMapEmbed = activeTrail ? getMapEmbed(activeTrail.googleMapsUrl, null) : null;

  return (
    <div>
      <Header />

      <nav className="back-nav">
        <button className="back-btn" onClick={() => navigate("/")}>
          &#8592; Back to Schedule
        </button>
      </nav>

      <EventHero
        climb={climb}
        climbId={climbId}
        currentUser={currentUser}
        isCancelled={isCancelled}
        isPostponed={isPostponed}
        registerCta={registerCta}
      />

      <main className="content" ref={contentRef}>
        <MountainProfile climb={climb} />

        <RequirementsCard climb={climb} />

        <PreClimbMeetings privateInfo={privateInfo} />

        <ClimbResources privateInfo={privateInfo} />

        <Announcements climb={climb} />

        <TrailMapSection
          activeTrail={activeTrail}
          activeTrailIdx={activeTrailIdx}
          activeTrailMapEmbed={activeTrailMapEmbed}
          allTrailsEmbed={allTrailsEmbed}
          climb={climb}
          currentUser={currentUser}
          komootEmbed={komootEmbed}
          setSelectedTrailIdx={setSelectedTrailIdx}
          setShowSignInModal={setShowSignInModal}
          trailMapEntries={trailMapEntries}
        />

        <PhotoCarousel
          carouselIndex={carouselIndex}
          climb={climb}
          setCarouselIndex={setCarouselIndex}
          setLightboxIndex={setLightboxIndex}
        />

        <PhotoLightbox climb={climb} lightboxIndex={lightboxIndex} setLightboxIndex={setLightboxIndex} />

        <WaterSource climb={climb} />

        <WeatherSection climb={climb} mapCoords={mapCoords} weather={weather} />

        <ClimbOfficers climb={climb} currentUser={currentUser} setShowSignInModal={setShowSignInModal} />

        <EventFeesCard climb={climb} onOpenGuide={() => setGuideOpen(true)} />
        <RegistrationPolicyInfo climb={climb} className="policy-info section-card" />

        <DonationDriveInfo climb={climb} />

        <PackingAndEthics climb={climb} />

        <ItinerarySection climb={climb} currentUser={currentUser} setShowSignInModal={setShowSignInModal} />

        {/* Participants */}
        <SectionCard icon="activity" title="Participants">
          <ParticipantsBody
            climb={climb}
            participants={participants}
            currentUser={currentUser}
            canSee={alreadyReg || isAdmin}
            onSignIn={() => setShowSignInModal(true)}
          />
        </SectionCard>
      </main>

      <Footer />

      {guideOpen && <MountaineeringGuideModal onClose={() => setGuideOpen(false)} />}

      <SignInModal climbId={climbId} setShowSignInModal={setShowSignInModal} showSignInModal={showSignInModal} />
    </div>
  );
}
