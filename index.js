require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cookieParser());
// verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    // console.log('Token not found in cookies.');
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      // console.log('Token verification failed:', error.message);
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    // console.log('Token verified successfully:', decoded);
    next();
  });
};

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://blog-spotter.web.app",
      "https://blog-spotter.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
// mongo information
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.98vvu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const blogsCollection = client.db("blogSpotter").collection("Blogs");
    const commentsCollection = client.db("blogSpotter").collection("Comments");
    const wishlist = client.db("blogSpotter").collection("Wishlist");
    // auth related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(process.env.JWT_SECRET);
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "10h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // logout
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // posting a blog
    app.post("/blogs", verifyToken, async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });
   
    app.get("/blogs", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const search = req.query.search || ""; // Get the search query, default to empty string if not provided
      const category = req.query.category || ""; // Get the category, default to empty string if not provided

      let filter = {};

      // If there's a search query, filter the blogs by title (or other fields like content)
      if (search) {
        filter.title = { $regex: search, $options: "i" }; // Case-insensitive search by title
      }

      // If a category is selected, filter by category
      if (category) {
        filter.category = category;
      }

      try {
        const result = await blogsCollection
          .find(filter)
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Error fetching blogs", error: error.message });
      }
    });

    // getting blog by id (for details)
    app.get("/blogs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });
    // getting blog by id
    app.get("/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    // updating information
    app.patch("/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      // Ensure the ID and data are valid
      if (!id || !data || Object.keys(data).length === 0) {
        return res
          .status(400)
          .send({ message: "Invalid data provided for update." });
      }

      const filter = { _id: new ObjectId(id) };

      // Dynamically update only the fields provided in the request
      const updatedDoc = {
        $set: { ...data }, // Spread operator to handle all provided fields dynamically
      };

      try {
        const result = await blogsCollection.updateOne(filter, updatedDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Blog not found." });
        }

        res.send({
          message: "Blog updated successfully.",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        // console.error("Error updating blog:", error);
        res.status(500).send({ message: "Internal server error." });
      }
    });

    // blogs counts
    app.get("/blogsCount", async (req, res) => {
      const count = await blogsCollection.estimatedDocumentCount();
      res.send({ count });
    });
    // posting comments
    app.post("/comments", async (req, res) => {
      const comment = req.body;
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    });
    // getting comments
    app.get("/comments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { blogId: id };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/wishlist", async (req, res) => {
      const { blogId, userEmail } = req.body;

      try {
        // Check if the blog is already in the wishlist for the user
        const existingWish = await wishlist.findOne({ blogId, userEmail });

        if (existingWish) {
          // If it exists, return a response indicating that it already exists
          return res.status(409).send({ message: "Blog already in wishlist." });
        }

        // If it doesn't exist, insert the new wish
        const result = await wishlist.insertOne(req.body);
        res.send(result);
      } catch (error) {
        // console.error("Error adding to wishlist:", error);
        res.status(500).send({ message: "Failed to add to wishlist." });
      }
    });

    //getting data from wishlist
    app.get("/wishlist", verifyToken, async (req, res) => {
      const query = { userEmail: req.query.email };

      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await wishlist.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    // deleting from wishlist
    app.delete("/wishlist/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) }; // Ensure ObjectId is imported from 'mongodb'
      const result = await wishlist.deleteOne(query); // Replace `wishlist` with your actual collection reference
      res.send(result);
    });

    // getting data for featured
    app.get("/featured", async (req, res) => {
      try {
        // Use blogsCollection instead of db.blogsCollection
        const topBlogs = await blogsCollection
          .aggregate([
            {
              $addFields: {
                stringLength: { $strLenCP: "$longDescription" }, // Calculate the string length
              },
            },
            {
              $sort: { stringLength: -1 }, // Sort by string length in descending order
            },
            {
              $limit: 10, // Get the top 10 results
            },
            {
              $project: {
                // Remove the temporary stringLength field from the response
                stringLength: 0,
              },
            },
          ])
          .toArray(); // Convert the aggregation cursor to an array

        res.status(200).json(topBlogs); // Send the result as a JSON response
      } catch (error) {
        // console.error("Error fetching blogs:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // six post
    app.get("/recent-blogs", async (req, res) => {
      try {
        const result = await blogsCollection
          .find()
          .sort({ postedTime: -1 }) // Sort by postedTime (most recent first)
          .limit(6) // Limit to 6 blogs
          .toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch recent blogs", error });
      }
    });
    // popular categories
    app.get("/popular-categories", async (req, res) => {
      try {
        const result = await blogsCollection
          .aggregate([
            {
              $group: {
                _id: "$category", // Group by category
                count: { $sum: 1 }, // Count the occurrences
              },
            },
            {
              $sort: { count: -1 }, // Sort by count in descending order
            },
            {
              $limit: 3, // Limit to top 3 categories
            },
          ])
          .toArray();

        // Map the result to include category name and count
        const popularCategories = result.map((item) => ({
          name: item._id,
          count: item.count,
        }));

        res.send(popularCategories);
      } catch (err) {
        // console.error("Error fetching popular categories:", err);
        res.status(500).send({ message: "Failed to fetch popular categories" });
      }
    });

    // trending blogs

    app.get("/trending-topics", async (req, res) => {
      const { ObjectId } = require("mongodb");

      try {
        const result = await blogsCollection
          .aggregate([
            {
              $lookup: {
                from: "Comments", // Join with Comments collection
                let: { blogId: "$_id" }, // Pass Blogs._id as a variable
                pipeline: [
                  {
                    $addFields: {
                      blogIdObj: { $toObjectId: "$blogId" }, // Convert blogId to ObjectId
                    },
                  },
                  {
                    $match: {
                      $expr: { $eq: ["$blogIdObj", "$$blogId"] }, // Match converted blogId
                    },
                  },
                ],
                as: "comments",
              },
            },
            {
              $addFields: {
                commentCount: { $size: "$comments" }, // Count the comments
              },
            },
            {
              $sort: { commentCount: -1 }, // Sort by most comments
            },
            {
              $limit: 5, // Limit to top 5 blogs
            },
            {
              $project: {
                _id: 1,
                title: 1,
                category: 1,
                shortDescription: 1,
                imageUrl: 1,
                commentCount: 1,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (err) {
        // console.error("Error fetching trending topics:", err);
        res.status(500).send({ message: "Failed to fetch trending topics" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Blog Spotter is running");
});

app.listen(port, () => {
  console.log(`Blog Spotter is running at port: ${port}`);
});
