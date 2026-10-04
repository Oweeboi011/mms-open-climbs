/**
 * Tests for the ClimbFeedback page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { getDoc, setDoc } from "firebase/firestore";
import { renderAtRoute, makeMemberAuth, climbFixture } from "@tests/helpers";
import { makeSnapshot } from "@tests/setup";
import ClimbFeedback from "@/pages/ClimbFeedback";

function mockDocs({ climb = climbFixture, feedback = null } = {}) {
  getDoc.mockImplementation((ref) => {
    if (ref.path.includes("climbs/")) {
      return Promise.resolve(makeSnapshot(climbFixture.id, climb));
    }
    return Promise.resolve(makeSnapshot("feedback-1", feedback));
  });
}

function render(authOverrides = {}) {
  return renderAtRoute(
    <ClimbFeedback />,
    "/feedback/:climbId",
    `/feedback/${climbFixture.id}`,
    makeMemberAuth(authOverrides),
  );
}

describe("ClimbFeedback page", () => {
  beforeEach(() => {
    mockDocs();
  });

  it("shows the climb title and a star rating form", async () => {
    render();
    await waitFor(() => {
      expect(screen.getByText(/Mt\. Pulag/)).toBeInTheDocument();
      expect(screen.getByText("Submit Feedback")).toBeInTheDocument();
    });
  });

  it("requires a rating before submitting", async () => {
    render();
    await waitFor(() => screen.getByText("Submit Feedback"));
    fireEvent.click(screen.getByText("Submit Feedback"));
    await waitFor(() =>
      expect(
        screen.getByText("Please choose a star rating."),
      ).toBeInTheDocument(),
    );
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("submits a rating and comments", async () => {
    render();
    await waitFor(() => screen.getByText("Submit Feedback"));

    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.change(screen.getByPlaceholderText(/What went well/), {
      target: { value: "Great climb!" },
    });
    fireEvent.click(screen.getByText("Submit Feedback"));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    const [, payload] = setDoc.mock.calls[0];
    expect(payload).toMatchObject({
      climbId: climbFixture.id,
      rating: 4,
      comments: "Great climb!",
    });
    await waitFor(() =>
      expect(screen.getByText(/Thanks for the feedback/)).toBeInTheDocument(),
    );
  });

  it("shows already-submitted state when feedback already exists", async () => {
    mockDocs({ feedback: { rating: 5, comments: "Loved it" } });
    render();
    await waitFor(() => {
      expect(screen.getByText(/Thanks for the feedback/)).toBeInTheDocument();
      expect(screen.getByText(/Loved it/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Submit Feedback")).not.toBeInTheDocument();
  });
});
