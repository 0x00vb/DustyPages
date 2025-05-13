/**
 * RustyPages API Server
 * Handles user authentication and book synchronization with MongoDB
 */

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');

var app = express();
var port = process.env.PORT || 3000;
var JWT_SECRET = process.env.JWT_SECRET || 'rusty-pages-secret-key';  // Better to use environment variable in production

// Basic rate limiting
var requestCounts = {};
var RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
var RATE_LIMIT_MAX = 100; // Max 100 requests per minute per IP

function rateLimit(req, res, next) {
  var ip = req.ip;
  var now = Date.now();
  
  requestCounts[ip] = requestCounts[ip] || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > requestCounts[ip].resetTime) {
    requestCounts[ip] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
  } else {
    requestCounts[ip].count++;
    if (requestCounts[ip].count > RATE_LIMIT_MAX) {
      return res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
    }
  }
  
  next();
}

// MongoDB Connection
var MONGODB_URI = "mongodb+srv://valentinobalatti4:Valenba2004@cluster0.yz2yqcw.mongodb.net/rustypages";

console.log('Connecting to MongoDB...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(function() {
  console.log('Connected to MongoDB successfully');
})
.catch(function(error) {
  console.error('MongoDB connection error:', error);
});

// Middleware
app.use(bodyParser.json({ limit: '100mb' })); // Increased limit for book data
app.use(cors({
  origin: "http://localhost:5500", // Include protocol
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(rateLimit);

// Request logging middleware
app.use(function(req, res, next) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Define schemas
var userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

var bookSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  author: String,
  format: String,
  position: Number,
  lastRead: Number,
  added: Number,
  data: { 
    type: String,
    required: true,
    get: function(value) {
      // Return the raw value
      return value;
    },
    set: function(value) {
      // If it's already a string, make sure it's not the string "undefined"
      if (typeof value === 'string') {
        return value === 'undefined' ? '{}' : value;
      }
      
      // If it's null or undefined, return empty object
      if (value === null || value === undefined) {
        return '{}';
      }
      
      // Otherwise try to stringify it
      try {
        if (typeof value === 'object') {
          return JSON.stringify(value);
        } else {
          return String(value);
        }
      } catch (err) {
        console.error('Error processing book data:', err);
        return '{}';
      }
    }
  } // Base64 encoded book data or stringified JSON
}, { 
  strict: false // Allow additional fields without strict validation
});

// Create indexes
bookSchema.index({ userId: 1, id: 1 }, { unique: true });

// Define models
var User = mongoose.model('User', userSchema);
var Book = mongoose.model('Book', bookSchema);

// Authentication middleware
function authenticateToken(req, res, next) {
  var authHeader = req.headers['authorization'];
  var token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, JWT_SECRET, function(err, user) {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// Routes
app.post('/api/register', function(req, res) {
  var { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  // Hash password
  bcrypt.hash(password, 10, function(err, hashedPassword) {
    if (err) {
      console.error('Error hashing password');
      return res.status(500).json({ success: false, message: 'Error registering user' });
    }
    
    var newUser = new User({
      username: username,
      password: hashedPassword
    });
    
    newUser.save()
      .then(function() {
        res.status(201).json({ success: true, message: 'User registered successfully' });
      })
      .catch(function(error) {
        if (error.code === 11000) {
          res.status(400).json({ success: false, message: 'Username already exists' });
        } else {
          console.error('Error registering user');
          res.status(500).json({ success: false, message: 'Error registering user' });
        }
      });
  });
});

app.post('/api/login', function(req, res) {
  var { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  
  User.findOne({ username: username })
    .then(function(user) {
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
      }
      
      bcrypt.compare(password, user.password, function(err, isMatch) {
        if (err || !isMatch) {
          return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        
        var token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token: token, userId: user._id });
      });
    })
    .catch(function(error) {
      console.error('Error during login');
      res.status(500).json({ success: false, message: 'Error during login' });
    });
});

// Book routes
app.get('/api/books', authenticateToken, function(req, res) {
  // Return only metadata by default to improve performance
  var includeData = req.query.includeData === 'true';
  
  var projection = includeData ? {} : { data: 0 };
  
  Book.find({ userId: req.user.userId }, projection)
    .then(function(books) {
      res.json({ success: true, books: books });
    })
    .catch(function(error) {
      console.error('Error fetching books');
      res.status(500).json({ success: false, message: 'Error fetching books' });
    });
});

// Get a single book with full data
app.get('/api/books/:id', authenticateToken, function(req, res) {
  var bookId = req.params.id;
  
  Book.findOne({ userId: req.user.userId, id: bookId })
    .then(function(book) {
      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }
      res.json({ success: true, book: book });
    })
    .catch(function(error) {
      console.error('Error fetching book');
      res.status(500).json({ success: false, message: 'Error fetching book' });
    });
});

app.post('/api/books', authenticateToken, function(req, res) {
  var bookData = req.body;
  bookData.userId = req.user.userId;
  
  if (!bookData.id || !bookData.title) {
    return res.status(400).json({ success: false, message: 'Book ID and title are required' });
  }
  
  // Ensure we have timestamps
  if (!bookData.added) {
    bookData.added = Date.now();
  }
  
  if (!bookData.lastRead) {
    bookData.lastRead = Date.now();
  }
  
  // Make sure data property is present
  if (!bookData.data) {
    console.warn('Book data is missing, setting default empty value');
    bookData.data = '{}';
  }
  
  // Check for existing book first 
  Book.findOne({ userId: req.user.userId, id: bookData.id })
    .then(function(existingBook) {
      if (existingBook) {
        // Update existing book
        console.log('Updating existing book:', bookData.title);
        
        // Don't replace the data field if it's not provided in the request
        if (bookData.data === '{}' && existingBook.data && existingBook.data !== '{}') {
          bookData.data = existingBook.data;
        }
        
        return Book.findOneAndUpdate(
          { userId: req.user.userId, id: bookData.id },
          bookData,
          { new: true }
        );
      } else {
        // Create new book
        console.log('Creating new book:', bookData.title);
        var book = new Book(bookData);
        return book.save();
      }
    })
    .then(function(book) {
      return res.status(200).json({ success: true, message: 'Book saved successfully', book: { 
        id: book.id,
        title: book.title,
        lastRead: book.lastRead,
        added: book.added
      }});
    })
    .catch(function(error) {
      console.error('Error saving book:', error);
      res.status(500).json({ success: false, message: 'Error saving book', error: error.message });
    });
});

app.put('/api/books/:id', authenticateToken, function(req, res) {
  var bookId = req.params.id;
  var bookData = req.body;
  bookData.userId = req.user.userId;
  
  // Update the lastRead timestamp if not provided
  if (!bookData.lastRead) {
    bookData.lastRead = Date.now();
  }
  
  Book.findOne({ userId: req.user.userId, id: bookId })
    .then(function(existingBook) {
      if (!existingBook) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }
      
      // Don't replace the data field if it's not provided or empty in the request
      if ((!bookData.data || bookData.data === '{}') && existingBook.data && existingBook.data !== '{}') {
        bookData.data = existingBook.data;
      }
      
      // Preserve the added date
      if (!bookData.added && existingBook.added) {
        bookData.added = existingBook.added;
      }
      
      return Book.findOneAndUpdate(
        { userId: req.user.userId, id: bookId },
        bookData,
        { new: true }
      );
    })
    .then(function(updatedBook) {
      if (updatedBook) {
        return res.json({ 
          success: true, 
          message: 'Book updated successfully',
          book: {
            id: updatedBook.id,
            title: updatedBook.title,
            lastRead: updatedBook.lastRead,
            position: updatedBook.position
          }
        });
      } else {
        return res.status(404).json({ success: false, message: 'Error: Book not found after update' });
      }
    })
    .catch(function(error) {
      console.error('Error updating book:', error);
      res.status(500).json({ success: false, message: 'Error updating book' });
    });
});

app.delete('/api/books/:id', authenticateToken, function(req, res) {
  var bookId = req.params.id;
  
  Book.findOneAndDelete({ userId: req.user.userId, id: bookId })
    .then(function(deletedBook) {
      if (!deletedBook) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }
      return res.json({ 
        success: true, 
        message: 'Book deleted successfully',
        bookId: bookId
      });
    })
    .catch(function(error) {
      console.error('Error deleting book:', error);
      res.status(500).json({ success: false, message: 'Error deleting book' });
    });
});

// Batch sync endpoint for efficient synchronization
app.post('/api/sync', authenticateToken, function(req, res) {
  var { added, updated, deleted } = req.body;
  var userId = req.user.userId;
  var promises = [];
  
  // Process added books
  if (added && added.length) {
    added.forEach(function(book) {
      book.userId = userId;
      
      // Ensure book data is present
      if (!book.data) {
        book.data = '{}';
      }
      
      var newBook = new Book(book);
      promises.push(newBook.save());
    });
  }
  
  // Process updated books
  if (updated && updated.length) {
    updated.forEach(function(book) {
      book.userId = userId;
      
      var updatePromise = Book.findOne({ userId: userId, id: book.id })
        .then(function(existingBook) {
          if (existingBook) {
            // Don't replace the data field if it's not provided in the request
            if ((!book.data || book.data === '{}') && existingBook.data && existingBook.data !== '{}') {
              book.data = existingBook.data;
            }
            
            return Book.findOneAndUpdate(
              { userId: userId, id: book.id },
              book,
              { new: true }
            );
          }
          return null; // Book doesn't exist
        });
      
      promises.push(updatePromise);
    });
  }
  
  // Process deleted books
  if (deleted && deleted.length) {
    deleted.forEach(function(bookId) {
      promises.push(Book.findOneAndDelete({ userId: userId, id: bookId }));
    });
  }
  
  Promise.all(promises)
    .then(function() {
      return Book.find({ userId: userId }, { data: 0 }); // Return updated book list without data
    })
    .then(function(books) {
      return res.json({ success: true, books: books });
    })
    .catch(function(error) {
      console.error('Error during sync:', error);
      res.status(500).json({ success: false, message: 'Error during sync' });
    });
});

// Error handling middleware
app.use(function(err, req, res, next) {
  console.error('Server error:', err.message);
  res.status(500).json({ success: false, message: 'Server error' });
});

// Start server
app.listen(port, function() {
  console.log('Server running on port ' + port);
});

// Export for testing
module.exports = app; 