const express = require("express");
const app = express();

app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");

dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(6000, () => {
      console.log("http://localhost/6000");
    });
  } catch (e) {
    console.log(`Db error ${e.message}`);
    process.exit(1);
  }
};

initializeAndServer();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// register API

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  if (password.length > 6) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const selectQuery = `SELECT * FROM user WHERE username = '${username}';`;
    const DbUser = await db.get(selectQuery);

    if (DbUser === undefined) {
      const createQuery = `
        INSERT INTO 
            user (name, username, password, gender)
        VALUES 
            ( '${name}',
            '${username}',
            '${hashedPassword}',
            '${gender}' );`;

      await db.run(createQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } else {
    response.status(400);
    response.send("Password is too short");
  }
});

// login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPasswordMatch = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get latest tweet

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const getQuery = `
        SELECT 
            username,
            tweet,
            date_time
        FROM 
            (User INNER JOIN Follower ON User.user_id = Follower.following_user_id) AS T
            INNER JOIN Tweet ON T.user_id = Tweet.user_id
        ORDER BY date_time desc
        LIMIT 4;`;
    const getTweet = await db.all(getQuery);
    response.send(
      getTweet.map((each) => ({
        username: each.username,
        tweet: each.tweet,
        dateTime: each.date_time,
      }))
    );
  }
);

// user following API

app.get("/user/following/", authenticationToken, async (request, response) => {
  const getQuery = `
        SELECT 
            name
        FROM 
            User INNER JOIN Follower ON User.user_id = Follower.following_user_id;`;
  const getTweet = await db.all(getQuery);
  response.send(getTweet);
});

// followers API

app.get("/user/follower/", authenticationToken, async (request, response) => {
  const getQuery = `
        SELECT 
            name
        FROM 
            User INNER JOIN Follower ON User.user_id = Follower.follower_id;`;
  const getTweet = await db.all(getQuery);
  response.send(getTweet);
});

//

module.exports = app;
