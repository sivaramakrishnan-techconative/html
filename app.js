const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const app = express();
const port = 4000;
const baseUrl = "https://www.wavemakeronline.com/"
const projectId = 'WMPRJ2c91808889a96400018a26070b7b2e68'

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.post("/settingUpload", async (req, res) => {
  try {
    const requestBody = req.body;
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: `${baseUrl}studio/services/projects/${projectId}/restservice/settings`,
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "POST",
      data: requestBody,
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
})
app.post("/restimport", async (req, res) => {
  try {
    const requestBody = req.body;
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: `${baseUrl}studio/services/projects/${projectId}/restservices/invoke?optimizeResponse=true`,
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "POST",
      data: requestBody,
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    console.log(data);
    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.get("/get-default-provider", async (req, res) => {
  try {
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: `${baseUrl}studio/services/oauth2/providers/default`,
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "GET",
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/getprovider", async (req, res) => {
  try {
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: `${baseUrl}studio/services/projects/${projectId}/oauth2/providers`,
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "GET",
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/addprovider", async (req, res) => {
  try {
    const requestBody = req.body;
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: `${baseUrl}studio/services/projects/${projectId}/oauth2/providers`,
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "POST",
      data: requestBody,
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/authorizationUrl/:id", async (req, res) => {
  try {
    const specificCookie = req.cookies.auth_cookie;
    const providerId = req.params.id;
    console.log(specificCookie);
    const configWOProxy = {
      url:
        `${baseUrl}studio/services/projects/${projectId}/oauth2/` +
        providerId +
        "/authorizationUrl",
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "GET",
    };
    const response = await axios.request(configWOProxy);
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/oauth2/google/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "authorization code");
  const clientId =
    "943762134929-41se2le56kl4vmtqc3a7b7cc19gv2b1t.apps.googleusercontent.com";
  const clientSecret = "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";
  const redirectUri = "http://localhost:4000/oauth2/google/callback";
  const tokenURL = "https://oauth2.googleapis.com/token"
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/amazon/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "token");
  const clientId =
    "amzn1.application-oa2-client.5fecbc41830f456d8505e23ad38a7398";
  const clientSecret =
    "amzn1.oa2-cs.v1.3b010267d9626b63426d5225c1b4821eede357a967c44859a4739f67815c0331";
  const redirectUri = "http://localhost:4000/oauth2/amazon/callback";
  const tokenURL = "https://api.amazon.com/auth/o2/token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/dropbox/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "token");
  const clientId = "6qqt07bsiguw2xr";
  const clientSecret = "jx45et6r120qiip";
  const redirectUri = "http://localhost:4000/oauth2/dropbox/callback";
  const tokenURL = "https://api.dropboxapi.com/oauth2/token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/github/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "authorizationCode");
  const clientId = "27a243ef056c2769e833";
  const clientSecret = "9c2e770c4fb0d9cdc16bc3604a88228a430eeaea";
  const redirectUri = "http://localhost:4000/oauth2/github/callback";
  const tokenURL = "https://github.com/login/oauth/access_token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
  // try {
  //   const tokenResponse = await fetch(tokenURL, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/x-www-form-urlencoded",
  //       Accept: "application/json", // Specify the desired response format
  //     },
  //     body: `code=${authorizationCode}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&grant_type=authorization_code`,
  //   });

  //   if (tokenResponse.ok) {
  //     const tokenData = await tokenResponse.json(); // Parse the JSON response
  //     const accessToken = tokenData.access_token;

  //     console.log("Access Token:", accessToken);

  //     const script = `
  //     <script>
  //       window.opener.postMessage({ accessToken: '${accessToken}' }, 'http://localhost:3000');
  //       window.close();
  //     </script>
  //   `;

  //     res.send(script);
  //   } else {
  //     const script = `
  //     <script>
  //       window.opener.postMessage({ error: '${tokenResponse.statusText}' }, 'http://localhost:3000');
  //     </script>
  //   `;

  //     res.send(script);
  //     console.error(
  //       "Error exchanging authorization code for access token:",
  //       tokenResponse.statusText
  //     );
  //   }
  // } catch (error) {
  //   console.error("An error occurred:", error);
  // }
});

app.get("/oauth2/facebook/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "code");
  const clientId = "1473684906731992";
  const clientSecret = "cae0a08bf72b4f25a5eee71f368fac5c";
  const redirectUri = "http://localhost:4000/oauth2/facebook/callback";
  const tokenURL = "https://graph.facebook.com/v17.0/oauth/access_token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/instagram/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "code");
  const clientId = "318764100563488";
  const clientSecret = "6cae2df16696d9eda0010f2e1f011a76";
  const redirectUri = "https://31f3-117-206-122-8.ngrok-free.app/oauth2/instagram/callback";
  const tokenURL = "https://api.instagram.com/oauth/access_token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/outlook/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "token");
  const clientId = "f682450d-e7e4-465b-ac7d-594983768b21";
  const clientSecret = "wui8Q~oOc_TuKp-LFb_wVUU5ao4.abreAorOHc7t";
  const redirectUri = "http://localhost:4000/oauth2/outlook/callback";
  const tokenURL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/salesforce/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "code");
  const clientId =
    "3MVG9pRzvMkjMb6kTELr5rYG37tFnMQMF6wzpS.AOtpmiEnLmH6k9I7xpAOh.dC_miJzsjYxqJb6NWedQ1hUt";
  const clientSecret =
    "29815352DD814B2337D96ACDCCAFD7344035A0E76E5B25FED98C32017F252FB6";
  const redirectUri = "http://localhost:4000/oauth2/salesforce/callback";
  const tokenURL = "https://login.salesforce.com/services/oauth2/token";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/oauth2/linkedin/callback", async (req, res) => {
  const authorizationCode = req.query.code;
  console.log(authorizationCode, "token");
  const clientId = "86rh0h4enp46vz";
  const clientSecret = "ABKxJudpga7ONoir";
  const redirectUri = "http://localhost:4000/oauth2/linkedin/callback";
  const tokenURL = "https://www.linkedin.com/uas/oauth2/accessToken";
  getToken(
    authorizationCode,
    clientId,
    clientSecret,
    redirectUri,
    tokenURL,
    res
  );
});

app.get("/studio/oAuthCallback.html", async (req, res) => {
  const url = req.url
  var code = url.match(/code=([^&#]*)/);
  var access_token = url.match(/access_token=([^&#]*)/), decodedURI, stateObj, parsedObj, dest;
  access_token = access_token ? access_token[1] : undefined;
  code = code ? code[1] : undefined;
  decodedURI = decodeURIComponent(url);
  stateObj = decodedURI.match(/\{([^)]+)\}/)[1];
  // stateObj = stateObj.replace(/&#34;/g, '"');
  console.log(stateObj)
  parsedObj = JSON.parse('{' + stateObj + '}');
  var valueToSet = parsedObj.flow === 'implicit' ? access_token : code;
  dest = '://services/oauth/' + parsedObj.providerId + '?access_token=' + valueToSet;
  if (parsedObj.requestSourceType === "MOBILE") {
    url = parsedObj.scheme + dest;
  } else if (parsedObj.requestSourceType === "WAVELENS") {
    url = "com.wavemaker.wavelens" + dest;
  } else {
    // localStorage.setItem(parsedObj.providerId + parsedObj.suffix, valueToSet);
    // if (window.opener) {
    //     window.opener.postMessage("oauth_success", window.location.origin);
    // }
    // window.close();
  }

  const script = `<script>
  localStorage.setItem('${parsedObj.providerId + parsedObj.suffix}', '${valueToSet}');
  if (window.opener) {
      window.opener.postMessage({ code: '${valueToSet}' }, 'http://localhost:3000')
  }
  window.close();
  </script>`

  res.send(script);
  // window.opener.postMessage("oauth_success", window.location.origin);

  // const code = req.query.code;
  // const state = req.query.state
  // console.log(code, "code");
  // if (code) {
  //   const script = `
  //   <script>
  //     window.opener.postMessage({ code: '${code}' }, 'http://localhost:3000');
  //     window.close();
  //   </script>
  // `;

  //   res.send(script);
  // }
});

async function getToken(
  authorizationCode,
  clientId,
  clientSecret,
  redirectUri,
  tokenURL,
  res
) {

  const tokenResponse = await fetch(tokenURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `code=${authorizationCode}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&grant_type=authorization_code`,
  });
  if (tokenResponse.ok) {
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData?.access_token; 
    console.log("Access Token:", accessToken);
    const dataString = JSON.stringify(tokenData);
    const script = `
    <script>
      window.localStorage.setItem("google.access_token","${accessToken}");
      window.opener.postMessage({ tokenData: '${dataString}' }, 'http://localhost:3000');
      window.close();
    </script>
  `;

    res.send(script);
  } else {
    const script = `
    <script>
      window.opener.postMessage({ error: '${tokenResponse.statusText}' }, 'http://localhost:3000');
    </script>
  `;

    res.send(script);
    console.error(
      "Error exchanging authorization code for access token:",
      tokenResponse.statusText
    );
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
