import { describe, it, expect } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeMemberAuth } from "@tests/helpers";
import MyDetails from "@/pages/MyDetails";
import { getDoc, setDoc } from "firebase/firestore";
import { makeSnapshot } from "@tests/setup";

const saved = {
  mobile: "+63 917 555 0101",
  ecName: "Ana Cruz",
  ecMobile: "+63 918 555 0101",
  ecRelationship: "Sister",
  experienceLevel: "intermediate",
  memberType: "member",
  medicalConditions: "Asthma",
  sourceClimbTitle: "Mt. Batulao",
};

describe("My Details page", () => {
  it("shows the member's saved details", async () => {
    getDoc.mockResolvedValue(makeSnapshot("user-1", saved));
    renderWithProviders(<MyDetails />, makeMemberAuth());
    expect(await screen.findByDisplayValue("+63 917 555 0101")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ana Cruz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Asthma")).toBeInTheDocument();
    expect(screen.getByLabelText("Participant Type")).toHaveValue("member");
    expect(screen.getByLabelText("Experience Level")).toHaveValue("intermediate");
  });

  it("saves edits to the member's own record", async () => {
    getDoc.mockResolvedValue(makeSnapshot("user-1", saved));
    renderWithProviders(<MyDetails />, makeMemberAuth());
    const mobile = await screen.findByDisplayValue("+63 917 555 0101");
    fireEvent.change(mobile, { target: { value: " +63 999 000 0000 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save My Details" }));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const [ref, data, options] = setDoc.mock.calls.at(-1);
    expect(ref.path).toBe("memberDetails/user-1");
    expect(data).toMatchObject({ mobile: "+63 999 000 0000", ecName: "Ana Cruz", sourceClimbTitle: "" });
    expect(options).toEqual({ merge: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  it("starts empty for a member with nothing saved yet", async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined, id: "user-1" });
    renderWithProviders(<MyDetails />, makeMemberAuth());
    expect(await screen.findByLabelText("Mobile Number")).toHaveValue("");
    expect(screen.getByLabelText("Participant Type")).toHaveValue("joiner");
  });

  it("explains when saving fails", async () => {
    getDoc.mockResolvedValue(makeSnapshot("user-1", saved));
    setDoc.mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(<MyDetails />, makeMemberAuth());
    await screen.findByDisplayValue("Ana Cruz");
    fireEvent.click(screen.getByRole("button", { name: "Save My Details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save your details");
  });
});
