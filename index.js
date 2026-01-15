const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const server = createServer(app);
const helmet = require("helmet");

// const port =process.env.PORT || 48000;

// middlewer
app.use(cors());
app.use(express.json());
app.use(helmet());

const io = new Server(server, {
  cors: {
    origin: ["https://chatsnest.vercel.app"],
    methods: ["GET", "POST"], 
  },
});

const uri = process.env.DB_uri;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const mydb = client.db("flexshipitChats");
    const messagesCollection = mydb.collection("chats");
    const usersCollection = mydb.collection("users");
    const smgCollection = mydb.collection("smg");

    app.post("/users", async (req, res) => {
      try {
        const newUser = req.body;
        newUser.createAt = new Date();
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "internel server error?" });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const email = req.query.email;
        const query = {};
        if (email) {
          query.email = email;
        }

        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch {
        res.status(500).send({ message: "internel server error?" });
      }
    });

    app.post("/messages", async (req, res) => {
      try {
        const newSMG = req.body;
        newSMG.time = new Date();
        const result = await smgCollection.insertOne(newSMG);
        res.send(result);
      } catch {
        res.status(500).send({ message: "internel server error?" });
      }
    });

    app.get("/messages", async (req, res) => {
      try {
        const result = await smgCollection.find().toArray();
        res.send(result);
      } catch {
        res.status(500).send({ message: "internel server error?" });
      }
    });

    app.get("/health", (req, res) => {
      res.status(200).send("OK");
    });

    const chatsRoom = "chatRoom";

    io.on("connection", (socket) => {
      // console.log("User connected:", socket.id);

      socket.on("userName", async (userName) => {
        await socket.join(chatsRoom);

        socket.to(chatsRoom).emit("roomNotice", userName);

        // send old messages ONLY ON JOIN
        const messages = await messagesCollection
          .find()
          .sort({ _id: 1 })
          // .limit(50)
          .toArray();

        socket.emit("oldMessages", messages);
      });

      socket.on("sendMessage", async (message) => {
        message.time = new Date();
        await messagesCollection.insertOne(message);

        // send ONLY new message
        io.to(chatsRoom).emit("receiveMessage", message);
      });

      socket.on("typing", (userName) => {
        // sender বাদে সবাই পাবে
        socket.to(chatsRoom).emit("typer", userName);
      });

      socket.on("disconnect", () => {
        // console.log("User disconnected:", socket.id);
      });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("This server is running!");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

server.listen(4800, () => {
  console.log(`Example app listening on port ${4800}`);
});
