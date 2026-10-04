import Icon from "@/components/Icon";

// Things to bring and Leave No Trace.
export default function PackingAndEthics({ climb }) {
  return (
    <>
      <div className="two-col">
        {/* Things to Bring */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="backpack" size={17} />
            </span>
            <h3>Things to Bring</h3>
          </div>
          <div className="section-body">
            {climb.thingsToBring?.length > 0 ? (
              <ul className="info-list">
                {climb.thingsToBring.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <ul className="info-list">
                <li>Day pack / Overnight pack</li>
                <li>Water, 2&ndash;3 litres per day</li>
                <li>Snacks / Trail food</li>
                <li>Packed meals</li>
                <li>Mess kit</li>
                <li>Sunscreen / Umbrella</li>
                <li>Jacket (preferably rainproof)</li>
                <li>Rain gear</li>
                <li>Emergency blanket</li>
                <li>Individual first aid kit</li>
                <li>Personal toiletries</li>
                <li>Head lamp</li>
                <li>Camera / Mobile phone</li>
                <li>Plastic bag / Trash bag</li>
              </ul>
            )}
          </div>
        </div>

        {/* Leave No Trace */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="leaf" size={17} />
            </span>
            <h3>Leave No Trace</h3>
          </div>
          <div className="section-body">
            <div className="lnt-header">
              <div className="lnt-badge">7</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  Principles
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--ink-soft)",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Leave No Trace
                </div>
              </div>
            </div>
            <ul className="info-list">
              <li>Plan ahead and prepare</li>
              <li>Travel and camp on durable surfaces</li>
              <li>Dispose of waste properly</li>
              <li>Leave what you find</li>
              <li>Minimise campfire impact</li>
              <li>Respect wildlife</li>
              <li>Be considerate of other visitors</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
