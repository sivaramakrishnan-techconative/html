const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const app = express();
const port = 4000;

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(cookieParser());
app.use(bodyParser.json());

app.post("/restimport", async (req, res) => {
  console.log(req.body);
  try {
    const requestBody = req.body;
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: "https://www.wavemakeronline.com/studio/services/projects/WMPRJ2c91808889a96400018a1809115326df/restservices/invoke?optimizeResponse=true",
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

app.get("/get-default-provider", async (req, res) => {
  try {
    const specificCookie = req.cookies.auth_cookie;
    console.log(specificCookie);
    const configWOProxy = {
      url: "https://www.wavemakeronline.com/studio/services/oauth2/providers/default",
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
      url: "https://www.wavemakeronline.com/studio/services/projects/WMPRJ2c91808889a96400018a1809115326df/oauth2/providers",
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
      url: "https://www.wavemakeronline.com/studio/services/projects/WMPRJ2c91808889a96400018a1809115326df/oauth2/providers",
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
        "https://www.wavemakeronline.com/studio/services/projects/WMPRJ2c91808889a96400018a1809115326df/oauth2/" +
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
  console.log(authorizationCode);
  const clientId =
    "238489563324-6rdc711u4jskjs78o1p2b0qkvgcbhbda.apps.googleusercontent.com";
  const clientSecret = "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";
  const redirectUri = "http://localhost:4000/oauth2/google/callback";
  try {
    const tokenResponse = await fetch(
      "https://accounts.google.com/o/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `code=${authorizationCode}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&grant_type=authorization_code`,
      }
    );

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      console.log("Access Token:", accessToken);

      const script = `
      <script>
        window.opener.postMessage({ accessToken: '${accessToken}' }, 'http://localhost:3000');
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
  } catch (error) {
    console.error("An error occurred:", error);
  }
});




app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
