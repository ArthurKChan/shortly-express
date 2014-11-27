var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: 'never gonna give you up',
  resave: false,
  saveUninitialized: true
}));

app.get('/', util.checkLoggedIn,
function(req, res) {
  res.render('index');
});

app.get('/create', util.checkLoggedIn,
function(req, res) {
  res.render('index');
});

app.get('/links', util.checkLoggedIn,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', util.checkLoggedIn,
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login',
function(req, res) {
  if(util.isLoggedIn(req)){ res.redirect(303, '/');}
  res.render('login');
});

app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  db.knex('users')
    .where('username', '=', username)
    .then(function(users) {
      var user = users[0];
      if (user) {
        if (bcrypt.compareSync(password, user.password)) {
          util.createSession(req, user.username, function() {
            res.redirect('/');
          });
        } else {
          res.redirect(303, '/login');
        }
      } else {
        res.redirect(303, '/login');
      }
    });
});

app.get('/logout',
function(req, res) {
  req.session.destroy();
  res.redirect(303, '/login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/signup',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      res.send(409, found.attributes.username + ' already exists');
    } else {
      // var password = bcrypt.hashSync(password);
      var user = new User({
        username: username,
        password: password
      });

      user.save().then(function(newUser) {
        Users.add(newUser);
        // redirect to '/'
        res.redirect('/');
        // res.send(200, newUser.username);
      });
    }
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
