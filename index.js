require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// middlewares

app.use(cookieParser());

// verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorized Access'})
  }
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if(error) {
      return res.status(401).send({message: 'Unauthorized Access'})

    }
    req.user = decoded;
    next();
  })
}

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
// mongo information
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.98vvu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    
    const blogsCollection = client.db("blogSpotter").collection("Blogs");
    const commentsCollection = client.db("blogSpotter").collection("Comments");
    const wishlist = client.db("blogSpotter").collection("Wishlist");
    // auth related apis
    app.post('/jwt', async(req, res) => {
      const user = req.body;
      console.log(process.env.JWT_SECRET);
      const token = jwt.sign(user, process.env.JWT_SECRET, {expiresIn:'10h'});
      res
      .cookie('token', token,{
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({success: true});

  })
  // logout
  app.post('/logout', (req, res) =>{
    res.clearCookie('token',{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({success: true})
})
    // posting a blog
    app.post('/blogs', async(req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    })
  //  getting blogs
    app.get('/blogs', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const search = req.query.search || "";  // Get the search query, default to empty string if not provided
      const category = req.query.category || "";  // Get the category, default to empty string if not provided
    
      let filter = {};
    
      // If there's a search query, filter the blogs by title (or other fields like content)
      if (search) {
        filter.title = { $regex: search, $options: "i" };  // Case-insensitive search by title
      }
    
      // If a category is selected, filter by category
      if (category) {
        filter.category = category;
      }
    
      try {
        const result = await blogsCollection.find(filter)
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching blogs", error: error.message });
      }
    });
    // getting blog by id
    app.get('/blogs/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await blogsCollection.find(query).toArray();
      res.send(result)
    })
    // getting blog by id
    app.get('/update/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await blogsCollection.find(query).toArray();
      console.log(result);
      res.send(result)
    })
  
    // updating information
    app.patch('/update/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
    
      // Ensure the ID and data are valid
      if (!id || !data || Object.keys(data).length === 0) {
        return res.status(400).send({ message: "Invalid data provided for update." });
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
        console.error("Error updating blog:", error);
        res.status(500).send({ message: "Internal server error." });
      }
    });
    
  
    // blogs counts
    app.get('/blogsCount', async (req, res) => {
      const count = await blogsCollection.estimatedDocumentCount();
      res.send({ count });
    })
    // posting comments
    app.post('/comments', async(req, res) =>{
      const comment = req.body;
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    })
    // getting comments
    app.get('/comments/:id', async (req, res) => {
      const id = req.params.id;
      const query = {blogId : id}
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    })

    // wishlist
    app.post('/wishlist', async(req, res) =>{
      const wish = req.body;
      const result = await wishlist.insertOne(wish);
      res.send(result);
    })
    // getting data
    app.get('/wishlist', verifyToken, async(req, res) =>{
      const email = req.query.email;
      // console.log(email);
      const query = { email: email }
      const result = await wishlist.find(query).toArray();
      console.log(result);
      res.send(result);
    })
    // deleting from wishlist
    // app.delete('/wishlist/:id', async(req, res) =>{
    //   const query = { _id: new ObjectId(req.params.id) };
    //   const result = await wishlist.deleteOne(query);
    //   res.send(result);
    // })

    
    
    app.delete('/wishlist/:id', async (req, res) => {
      try {
        const query = { _id: new ObjectId(req.params.id) }; // Ensure ObjectId is imported from 'mongodb'
        const result = await wishlist.deleteOne(query); // Replace `wishlist` with your actual collection reference
        res.status(200).json(result);
      } catch (error) {
        console.error("Error deleting wishlist item:", error);
        res.status(500).json({ error: "Failed to delete item" });
      }
    });
    
    // getting data for featured 
   
    app.get('/featured', async (req, res) => {
      try {
        // Use blogsCollection instead of db.blogsCollection
        const topBlogs = await blogsCollection.aggregate([
          {
            $addFields: {
              stringLength: { $strLenCP: "$longDescription" } // Calculate the string length
            }
          },
          {
            $sort: { stringLength: -1 } // Sort by string length in descending order
          },
          {
            $limit: 10 // Get the top 10 results
          },
          {
            $project: { // Remove the temporary stringLength field from the response
              stringLength: 0
            }
          }
        ]).toArray(); // Convert the aggregation cursor to an array
    
        res.status(200).json(topBlogs); // Send the result as a JSON response
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // six post
    app.get('/recent-blogs', async (req, res) => {
      try {
        const result = await blogsCollection
          .find()
          .sort({ postedTime: -1 }) // Sort by postedTime (most recent first)
          .limit(6) // Limit to 6 blogs
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch recent blogs", error });
      }
    });
    

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) =>{
    res.send('Blog Spotter is running');
})

app.listen(port, () => {
    console.log(`Blog Spotter is running at port: ${port}`);
})