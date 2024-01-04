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
        request.username = payload.username;
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
    const { username } = request;
    const getLoginUserId = `
      SELECT
      user_id
      FROM User
      WHERE username = '${username}';`;

    const user = await db.get(getLoginUserId);
    const { user_id } = user;
    console.log(user_id);

    const tweetsQuery = `
        SELECT
        user.username, tweet.tweet, tweet.date_time AS dateTime
        FROM
        Follower
        INNER JOIN tweet
        ON Follower.following_user_id = tweet.user_id
        INNER JOIN user
        ON tweet.user_id = user.user_id
        WHERE
        Follower.follower_user_id = ${user_id}
        ORDER BY
        tweet.date_time DESC
        LIMIT 4;`;
    const getTweet = await db.all(tweetsQuery);
    response.send(getTweet);
  }
);

// user following API

app.get("/user/following/", authenticationToken, async (request, response) => {
  const { username } = request;

  const getLoginUserId = `
      SELECT
        user_id
      FROM User
      WHERE username = '${username}';`;

  const user = await db.get(getLoginUserId);
  const { user_id } = user;

  const getQuery = `
        SELECT 
            name
        FROM 
            Follower INNER JOIN User ON User.user_id = Follower.following_user_id
        WHERE
        Follower.follower_user_id = ${user_id};`;

  const getTweet = await db.all(getQuery);
  response.send(getTweet);
});

// followers API

app.get("/user/followers/", authenticationToken, async (request, response) => {
  const { username } = request;
  const getLoginUserId = `
      SELECT
        user_id
      FROM User
      WHERE username = '${username}';`;

  const user = await db.get(getLoginUserId);
  const { user_id } = user;
  const getQuery = `
        SELECT 
            name
        FROM 
            Follower INNER JOIN User ON User.user_id = Follower.follower_user_id
        WHERE
        Follower.following_user_id = ${user_id};`;
  const getTweet = await db.all(getQuery);
  response.send(getTweet);
});

// get specific tweet

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;

  const getLoginUserId = `
      SELECT
        user_id
      FROM user 
      WHERE username = '${username}';`;

  const getUserID = await db.get(getLoginUserId);
  const { user_id } = getUserID;

  const getUser = `
    SELECT *
    FROM Follower
    WHERE follower_user_id = ${user_id};`;

  const user = await db.get(getUser);
  console.log(user);

  if (user !== undefined) {
    const getQuery = `
        SELECT 
            Tweet.tweet,
            count(like_id) AS likes,
            count(Reply.reply) AS replies,
            Tweet.date_time AS dateTime
        FROM 
            (Follower INNER JOIN Tweet ON Tweet.user_id = Follower.following_user_id) AS T
            INNER JOIN Reply ON Reply.tweet_id = T.tweet_id
            INNER JOIN Like ON Like.tweet_id = T.tweet_id
        WHERE
        Follower.follower_user_id = ${user_id}
        AND Tweet.tweet_id = ${tweetId};`;

    const getTweet = await db.get(getQuery);
    response.send(getTweet);
  } else {
    response.send("Invalid Request");
  }
});

// get likes API
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getLoginUserId = `
      SELECT
        user_id
      FROM user 
      WHERE username = '${username}';`;

    const getUserID = await db.get(getLoginUserId);
    const { user_id } = getUserID;

    const getUser = `
    SELECT *
    FROM Follower
    WHERE follower_user_id = ${user_id};`;

    const user = await db.get(getUser);
    console.log(user);

    if (user !== undefined) {
      const getQuery = `
        SELECT 
            name
        FROM 
            (Follower INNER JOIN Tweet ON Tweet.user_id = Follower.following_user_id) AS T
            INNER JOIN user ON user.user_id = T.user_id
            INNER JOIN Like ON Like.tweet_id = T.tweet_id
        WHERE
        Follower.follower_user_id = ${user_id}
        AND Tweet.tweet_id = ${tweetId};`;

      const getTweet = await db.get(getQuery);
      response.send(getTweet);
    } else {
      response.send("Invalid Request");
    }
  }
);

// get replies

app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;

    const getLoginUserId = `
      SELECT
        user_id
      FROM user 
      WHERE username = '${username}';`;

    const getUserID = await db.get(getLoginUserId);
    const { user_id } = getUserID;

    const getUser = `
    SELECT *
    FROM Follower
    WHERE follower_user_id = ${user_id};`;

    const user = await db.get(getUser);
    console.log(user);

    if (user !== undefined) {
      const getQuery = `
        SELECT 
            name,
            reply
        FROM 
            (Follower INNER JOIN Tweet ON Tweet.user_id = Follower.follower_user_id) AS T
            INNER JOIN Reply ON Reply.tweet_id = T.tweet_id
            INNER JOIN user ON user.user_id = T.user_id
        WHERE
        Follower.following_user_id = ${user_id}
        AND Tweet.tweet_id = ${tweetId};`;

      const getTweet = await db.get(getQuery);
      response.send(getTweet);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// get tweet of all user

app.get("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;

  const getLoginUserId = `
      SELECT
        user_id
      FROM user 
      WHERE username = '${username}';`;

  const getUserID = await db.get(getLoginUserId);
  const { user_id } = getUserID;

  const getQuery = `
        SELECT 
            Tweet.tweet,
            count(like_id) AS likes,
            count(Reply.reply) AS replies,
            Tweet.date_time AS dateTime
        FROM 
            Tweet NATURAL JOIN Like NATURAL JOIN Reply
        WHERE
            Tweet.user_id = ${user_id};`;

  const getTweet = await db.all(getQuery);
  response.send(getTweet);
});

// upload tweet API

app.post("/user/tweets/", authenticationToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;

  const getLoginUserId = `
      SELECT
        user_id
      FROM user 
      WHERE username = '${username}';`;

  const getUserID = await db.get(getLoginUserId);
  const { user_id } = getUserID;

  const date = new Date();

  const uploadTweet = `
      INSERT INTO
      Tweet (tweet, user_id, date_time)
      VALUES 
      ('${tweet}', ${user_id}, ${date});`;

  await db.run(uploadTweet);
  response.send("Created a Tweet");
});

// delete tweet API

app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getLoginUserId = `
      SELECT
        tweet_id
      FROM user NATURAL JOIN Tweet
      WHERE username = '${username}';`;

    const getUserID = await db.get(getLoginUserId);
    const { user_id } = getUserID;

    if (tweet_id === tweetId) {
      const deleteQuery = `
  DELETE FROM
    Tweet
  WHERE
    tweet_id = ${tweetId};`;
      await database.run(deletePlayerQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
