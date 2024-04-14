const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken")
const { request } = require("http");

const dbPath = path.join(__dirname, "swivl.db");

let db = null;
app.use(express.json())

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
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

app.get("/",async(request,response)=>{
    response.send("Hi, From Home Route use a different API's mentioned in the Github Repo Readme File.")
})

app.post("/register",async(request,response)=>{
    const {username, password, name, email}=request.body 
    const hashedPassword=await bcrypt.hash(password,10);
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser=await db.get(selectUserQuery) ;
    if(dbUser===undefined){
        const apiQuery=`
        INSERT INTO user (username, password, name, email)
        VALUES (
            '${username}',
            '${hashedPassword}',
            '${name}',
            '${email}'
        );
        `
        const userDeatils=await db.run(apiQuery);
        const userId=userDeatils.lastID;
        response.send(`User Created Successful with the user id - ${userId}`);
    }
    else{
        response.send("User already Exists")
    }
})

app.get("/register",async(request,response)=>{
    const apiQuery=`SELECT username,password,name,email FROM user;`
    const userDetails=await db.all(apiQuery)
    response.send(userDetails);
})

app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });
app.get("/profile/:username", async(request,response)=>{
    const {username}=request.params;
    const selectProfileQuery=`SELECT username, name, email FROM user WHERE username='${username}'`
    const dbResults=await db.get(selectProfileQuery);
    if(dbResults!==undefined){
        response.send(dbResults);
    }
    else{
        response.send("Profile not Exists")
    }
})

app.put("/profile/:username",async(request,response)=>{
    const {username}=request.params;
    const {name, email}=request.body;
    const dbUserQuery=`SELECT * FROM user WHERE username='${username}'`
    const dbUserResults=await db.get(dbUserQuery)
    if(dbUserResults===undefined){
        response.send("Profile not Exists")
    }
    else{
        const updateUserDetails=`UPDATE user SET name='${name}', email='${email}' WHERE username='${username}';`
        await db.run(updateUserDetails);
        response.send("Profile Updated Successful");
    }
})

app.delete("/profile/:username", async(request,response)=>{
    const {username}=request.params;
    const dbUserQuery=`SELECT * FROM user WHERE username='${username}'`
    const dbUserResults=await db.get(dbUserQuery)
    if(dbUserResults!==undefined) {
        const deleteQuery = `
            DELETE FROM user
            WHERE username = '${username}'
        `;
        await db.run(deleteQuery);
        response.send("Profile Deleted Successful")
    }
    else{
        response.send("Profile not Exists")
    }
})

app.post("/diary_entry",authenticateToken,async(request,response)=>{
    const {diary_id, title, description, date, location, photos} = request.body;
    const addDiaryQuery=`
    INSERT INTO diary_entry (diary_id, title, description, date, location, photos)
    VALUES (
        ${diary_id},
        '${title}',
        '${description}',
        '${date}',
        '${location}',
        '${photos}'
    );
    `
    await db.run(addDiaryQuery);
    response.send("Diary Entry added Successful");
})

app.get("/diary_entry",authenticateToken,async(request,response)=>{
    const apiQuery=`SELECT * FROM diary_entry`
    const dbResults=await db.all(apiQuery)
    response.send(dbResults);
})

app.put("/diary_entry/:diary_id",authenticateToken,async(request,response)=>{
    const {diary_id}=request.params 
    const {title, description, date, location, photos} = request.body;
    const updateQuery=`
    UPDATE diary_entry SET title='${title}', description='${description}',
    date='${date}',location='${location}',photos='${photos}'
    WHERE diary_id=${diary_id};
    `
    await db.run(updateQuery);
    response.send(`Diary Entry Updated Successful with the diary id - ${diary_id}`)
})

app.delete("/diary_entry/:diary_id",authenticateToken,async(request,response)=>{
    const {diary_id}=request.params;
    const deleteUserQuery=`DELETE FROM diary_entry where diary_id=${diary_id}`
    await db.run(deleteUserQuery)
    response.send("Diary Entry Deleted Successful")
})