import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import AnnouncementsEditor from "@/pages/admin/climbForm/AnnouncementsEditor";
import BasicInfoFields from "@/pages/admin/climbForm/BasicInfoFields";
import FeesEditor from "@/pages/admin/climbForm/FeesEditor";
import GcashFields from "@/pages/admin/climbForm/GcashFields";
import ItineraryEditor from "@/pages/admin/climbForm/ItineraryEditor";
import MountainProfileFields from "@/pages/admin/climbForm/MountainProfileFields";
import OfficersEditor from "@/pages/admin/climbForm/OfficersEditor";
import PreClimbMeetingsEditor from "@/pages/admin/climbForm/PreClimbMeetingsEditor";
import RequiredDocsEditor from "@/pages/admin/climbForm/RequiredDocsEditor";
import ResourcesEditor from "@/pages/admin/climbForm/ResourcesEditor";
import useClimbForm from "@/pages/admin/climbForm/useClimbForm";

export default function AdminClimbForm() {
  const {
    addDay, addEntry, addListItem, docUploading, error, form, gcashUploading, handleDocUpload,
    handleGcashQrUpload, handleSubmit, handleTrailImageUpload, isEdit, loading, moveEntry,
    moveListItem, navigate, removeDay, removeEntry, removeListItem, saving, set, setForm,
    setTrailUrlInput, trailImgUploading, trailUrlInput, updateDay, updateEntry, updateListItem,
    users,
  } = useClimbForm();

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/climbs">Climbs</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{isEdit ? "Edit" : "New Climb"}</span>
        </div>
        <div className="admin-page-header">
          <div className="admin-page-title">
            {isEdit ? "Edit Climb" : "New Climb"}
          </div>
          <Link to="/admin" className="btn btn-outline btn-sm">
            &larr; Back to Admin
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <BasicInfoFields form={form} set={set} setForm={setForm} />

          <MountainProfileFields
            addListItem={addListItem}
            form={form}
            handleTrailImageUpload={handleTrailImageUpload}
            removeListItem={removeListItem}
            set={set}
            setTrailUrlInput={setTrailUrlInput}
            trailImgUploading={trailImgUploading}
            trailUrlInput={trailUrlInput}
            updateListItem={updateListItem}
          />

          <PreClimbMeetingsEditor
            addListItem={addListItem}
            form={form}
            removeListItem={removeListItem}
            updateListItem={updateListItem}
          />

          <ResourcesEditor
            addListItem={addListItem}
            form={form}
            removeListItem={removeListItem}
            updateListItem={updateListItem}
          />

          <AnnouncementsEditor
            addListItem={addListItem}
            form={form}
            removeListItem={removeListItem}
            updateListItem={updateListItem}
          />

          <ItineraryEditor
            addDay={addDay}
            addEntry={addEntry}
            form={form}
            moveEntry={moveEntry}
            moveListItem={moveListItem}
            removeDay={removeDay}
            removeEntry={removeEntry}
            setForm={setForm}
            updateDay={updateDay}
            updateEntry={updateEntry}
          />

          <FeesEditor
            addListItem={addListItem}
            form={form}
            moveListItem={moveListItem}
            removeListItem={removeListItem}
            updateListItem={updateListItem}
          />

          <OfficersEditor
            addListItem={addListItem}
            form={form}
            moveListItem={moveListItem}
            removeListItem={removeListItem}
            setForm={setForm}
            updateListItem={updateListItem}
            users={users}
          />

          <GcashFields
            form={form}
            gcashUploading={gcashUploading}
            handleGcashQrUpload={handleGcashQrUpload}
            set={set}
          />

          <RequiredDocsEditor
            docUploading={docUploading}
            form={form}
            handleDocUpload={handleDocUpload}
            set={set}
          />

          {/* Submit */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner spinner-sm" /> Saving…
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Climb"
              )}
            </button>
            <button
              className="btn btn-outline btn-lg"
              type="button"
              onClick={() => navigate("/admin/climbs")}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
