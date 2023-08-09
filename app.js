const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const app = express();
const port = 5000;

app.use(cors({
  credentials: true,
  origin: 'http://localhost:3000',
}));
app.use(cookieParser());
app.use(bodyParser.json());

app.post('/restimport', async (req, res) => {
  try {
    const requestBody = req.body
    const specificCookie = req.cookies.auth_cookie
    console.log(specificCookie)
    const configWOProxy = {
      url: "https://www.wavemakeronline.com/studio/services/projects/WMPRJ2c91808888f52524018968db801516c9/restservices/invoke?optimizeResponse=true",
      headers: { Cookie: "auth_cookie=" + specificCookie },
      method: "POST",
      data: requestBody
    }
    const response = await axios.request(configWOProxy)
    const data = response.data;
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/get", async (req, res) => {
  console.log(req.cookies)
  res.send(req.cookies)
})

app.post("/create", async (req, res) => {
  console.log(req.cookies)
  res.json(req.cookies)
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
