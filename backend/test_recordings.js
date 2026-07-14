import fetch from "node-fetch";

async function run() {
  const clerkId = "user_3G9AP8EN7XVMR2wngrDrUn1hkgK";
  
  console.log("Fetching recordings list...");
  const res1 = await fetch(`http://localhost:5000/api/meetings/recordings`, {
    headers: {
      "x-test-bypass": clerkId
    },
    redirect: "manual"
  });

  const status1 = res1.status;
  const text1 = await res1.text();
  console.log("List Status:", status1);
  console.log("List Response:", text1.slice(0, 200));

  let data1;
  try {
    data1 = JSON.parse(text1);
  } catch(e) {}

  if (data1 && data1.sessions && data1.sessions.length > 0) {
    const sessionId = data1.sessions[0]._id;
    console.log(`\nFetching detail for session ${sessionId}...`);
    const res2 = await fetch(`http://localhost:5000/api/meetings/recordings/${sessionId}`, {
      headers: {
        "x-test-bypass": clerkId
      },
      redirect: "manual"
    });

    const status2 = res2.status;
    const data2 = await res2.json();
    console.log("Detail Status:", status2);
    console.log("Detail Body (keys only):", Object.keys(data2));
    if (data2.session) {
      console.log("Session fields:", Object.keys(data2.session));
      console.log("Session summary:", data2.session.summary ? "Exists" : "Empty");
      console.log("Session transcriptSegments count:", data2.session.transcriptSegments?.length || 0);
    }
    console.log("Recordings array:", JSON.stringify(data2.recordings, null, 2));
  } else {
    console.log("No completed sessions found to test detail route.");
  }
}

run().catch(console.error);
