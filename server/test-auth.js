import dotenv from 'dotenv';
dotenv.config();

async function testAuth() {
  console.log("CLIENT_ID:", process.env.GITHUB_CLIENT_ID);
  console.log("CLIENT_SECRET:", process.env.GITHUB_CLIENT_SECRET ? "exists" : "missing");
  
  // Simulate the token exchange with a fake code to see if it throws or returns JSON
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: "fake_code_12345",
      }),
    });
    const tokenData = await tokenResponse.json();
    console.log("Response:", tokenData);
  } catch (err) {
    console.error("Error:", err);
  }
}
testAuth();
