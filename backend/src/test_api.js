import fetch from "node-fetch";

async function run() {
  const teamId = "6a4caf93de0e9ec924b3b198";
  const clerkId = "user_3G9AP8EN7XVMR2wngrDrUn1hkgK";
  
  console.log("Fetching team...");
  const res = await fetch(`http://localhost:5000/api/teams/${teamId}`, {
    headers: {
      "x-test-bypass": clerkId
    }
  });

  const status = res.status;
  const url = res.url;
  const text = await res.text();

  console.log("Status:", status);
  console.log("URL:", url);
  console.log("Body:", text);
}

run().catch(console.error);
