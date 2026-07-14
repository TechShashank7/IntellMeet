import fetch from "node-fetch";
import fs from "fs";

async function run() {
  const clerkId = "user_3G9AP8EN7XVMR2wngrDrUn1hkgK";
  // First, find a valid meeting ID
  console.log("Fetching recordings list...");
  const res1 = await fetch(`http://127.0.0.1:5000/api/meetings/recordings`, {
    headers: {
      "x-test-bypass": clerkId
    }
  });

  const data1 = await res1.json();
  if (!data1.sessions || data1.sessions.length === 0) {
    console.log("No completed sessions found.");
    return;
  }

  const sessionId = data1.sessions[0]._id;
  
  console.log(`\nFetching PDF for session ${sessionId}...`);
  const res = await fetch(`http://127.0.0.1:5000/api/meetings/${sessionId}/export`, {
    headers: {
      "x-test-bypass": clerkId
    }
  });

  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("Content-Disposition:", res.headers.get("content-disposition"));

  if (res.status === 200) {
    const buffer = await res.arrayBuffer();
    const filePath = `test_notes_${sessionId}.pdf`;
    fs.writeFileSync(filePath, Buffer.from(buffer));
    console.log(`Saved PDF to ${filePath}`);
    const stats = fs.statSync(filePath);
    console.log(`File size: ${stats.size} bytes`);
    
    // Check PDF header
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(5);
    fs.readSync(fd, header, 0, 5, 0);
    console.log(`File header: ${header.toString()}`);
    fs.closeSync(fd);
  } else {
    console.log("Response text:", await res.text());
  }
}

run().catch(console.error);
