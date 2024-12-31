# Blog Spotter Server

## Purpose
The Blog Spotter server is designed to provide a backend for a blogging platform. It manages user authentication, blog posts, comments, and wishlist functionalities. The server ensures secure communication and efficient data handling for the application.

## Technologies Used
- **Node.js** with **Express.js** for server-side logic.
- **MongoDB** for database management.
- **JWT** (JSON Web Tokens) for authentication.
- **dotenv** for environment variable management.
- **cookie-parser** for handling cookies.
- **CORS** for enabling cross-origin requests.

## CRUD Operations
### Blogs
- **Create**: Add a new blog post.
- **Read**: Retrieve all blogs, single blog details, or recent blogs.
- **Update**: Edit blog information.
- **Delete**: Not implemented.

### Comments
- **Create**: Add a comment to a blog.
- **Read**: Fetch comments for a specific blog.

### Wishlist
- **Create**: Add a blog to the wishlist.
- **Read**: Retrieve wishlist items for a user.
- **Delete**: Remove a blog from the wishlist.

## Summary
This server supports a blogging platform by handling user authentication, blog and comment management, and wishlist functionality. It includes secure token-based authentication and robust data filtering and sorting to enhance user experience.