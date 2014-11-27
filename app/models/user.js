var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: false,

  initialize: function() {
    this.on('creating', function(model) {
      var password = model.get('password');
      if (password) {
        // hash & rewrite password
        // console.log("PASS", password);
        model.set('password', bcrypt.hashSync(password));
      }
    });
  }
});

module.exports = User;
