var options = {
  valueNames: [ 'name', 'born' ]
};

var values = [ {
  name: "Martina Elm",
  born: 1986
}];

var userList = new List('users', options, values);

userList.add({
  name: "Gustaf Lindqvist",
  born: 1983
});