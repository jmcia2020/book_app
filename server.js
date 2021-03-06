'use strict';
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public')); // loads the public folder (css)
app.use(express.urlencoded({ extended: true }));
const client = new pg.Client(process.env.DATABASE_URL);

client.on('error', err => console.error(err));

app.set('view engine', 'ejs'); //tell express to load ejs this unlocks the response render

app.get('/', getBooks);
app.get('/searches/new', makeBookSearch);
app.post('/searches', getResults);
app.post('/books', saveBook);

// ====== Fail safe routes ======
app.get('*', (request, response) => response.status(404).send('This route does not exist'));
app.get((error, req, res) => handleError(error, res)); // handle errors

// ====== Functions ======
function getBooks(req, res) { //home page
  const sqlQuery = 'SELECT * FROM books';
  return client.query(sqlQuery)
    .then(resultBooks => {
      console.log(resultBooks.rows);
      res.render('pages/index', { books: resultBooks.rows });
    });
}


function makeBookSearch(req, res) { // search for book
  res.render('pages/searches/new.ejs');
}


// ====== Constructor Function ======
//for titles | image, title, author, and desc
function Book(info) {
  const placeHolderImage = `https://i.imgur.com/J5LVHEL.jpg`;

  let httpRegex = /^(http:\/\/)/g;

  this.title = info.title ? info.title : 'No title available';
  this.image_url = info.imageLinks ? info.imageLinks.thumbnail.replace(httpRegex, 'https://') : placeHolderImage;
  this.author = info.authors ? info.authors : 'No author available';
  this.isbn = info.isbn ? info.isbn : 'No isbn available';
  this.description = info.description ? info.description : 'No description available';
}

function getResults(req, res) {
  let url = `https://www.googleapis.com/books/v1/volumes?q=`;
  if (req.body.searchType === 'title') { url += `+intitle:${req.body.searchBar}`; }
  if (req.body.searchType === 'author') { url += `+inauthor:${req.body.searchBar}`; }
  superagent.get(url)
    .then(books => books.body.items.map(book => new Book(book.volumeInfo)))
    .then(results => res.render('pages/searches/show', { results: results }))
    .catch(err => handleError(err, res));

  console.log(req.body);
}

function saveBook(req, res) {
  const { author, title, isbn, image_url, description } = req.body;
  console.log('req.body', req.body);
  const saveFavorite = `INSERT INTO books (author, title, isbn, image_url, description) VALUES ($1, $2, $3, $4, $5) RETURNING id;`;
  const parameters = [author, title, isbn, image_url, description];
  return client.query(saveFavorite, parameters)
    .then(result => {
      let id = result.rows[0].id;
      console.log('id', id);
      res.redirect(`/`);
    })
    .catch(err => {
      handleError(err, res);
      console.err('Error in saveBook', err);
    });
}


// ====== Error Handler(s) ======
function handleError(error, response) {
  response.render('pages/error', { error: error });
}

// ====== PORT Listener ======
client.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
  });


