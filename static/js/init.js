


// external js: isotope.pkgd.js

// init Isotope
// store filter for each group
var filters = {};

// bind filter button click
$('.filters-button-group').on( 'click', 'a', function() {
  var $this = $(this);
  // get group key
  var $buttonGroup = $this.parents('.button-group');
  var filterGroup = $buttonGroup.attr('data-filter-group');
  // set filter for group
  filters[ filterGroup ] = $this.attr('data-filter');
  // combine filters
  var filterValue = concatValues( filters );
  $('.card').isotope({ filter: filterValue });
});

// change is-checked class on buttons
$('.button-group').each( function( i, buttonGroup ) {
  var $buttonGroup = $( buttonGroup );
  $buttonGroup.on( 'click', 'button', function() {
    $buttonGroup.find('.is-checked').removeClass('is-checked');
    $( this ).addClass('is-checked');
  });
});


// flatten object by concatting values
function concatValues( obj ) {
  var value = '';
  for ( var prop in obj ) {
    value += obj[ prop ];
  }
  return value;
}

$('.nav-pin').pushpin({ top:$('#beggining').height() });


$(document).ready(function(){
    $('.scrollspy').scrollSpy();
  });

$(document).ready(function(){
  $('ul.tabs').tabs();
});
